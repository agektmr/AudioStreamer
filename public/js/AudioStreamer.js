/*
Copyright 2012 Eiji Kitamura

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Author: Eiji Kitamura (agektmr@gmail.com)
*/
'use strict';

var AudioStreamer = (function() {
  var BUFFER_LENGTH = 2048,
      ws_host = window.location.href.replace(/(http|https)(:\/\/.*?)\//, 'ws$2');

  /*
   * user_id: user id of original sender (null if initialization)
   * name: name of sender
   * type: message type ('connection'|'connected'|'message'|'heartbeat'|'start_music')
   * message: message body (array of {user_id: *, name: *} if type is 'connection' and from server)
   *
   * { // connection (client to server)
   *   user_id: null,
   *   name: 'agektmr',
   *   type: 'connection',
   *   message: null
   * }

   * { // connection (server to client)
   *   user_id: 0,
   *   name: 'agektmr',
   *   type: 'connection',
   *   message: [
   *     {user_id: 1, name: 'test'},
   *     {user_id: 2, name: 'test2'}
   *   ]
   * }
   *
   * { // connected
   *   user_id: 0,
   *   name: 'agektmr',
   *   type: 'connected',
   *   message: null
   * }
   *
   * { // message
   *    user_id: 0,
   *    name: 'agektmr',
   *    type: 'message',
   *    message: 'hello!'
   * }
   *
   * { // start_music
   *    user_id: 0,
   *    name: 'agektmr',
   *    type: 'start_music',
   *    message: null
   * }
   */
  var TextMessage = {
    createMessage: function(type, message) {
      if (type != 'connection' &&
          type != 'message' &&
          type != 'heartbeat')
        throw 'message type is unknown';
      var msg = {
        user_id: AttendeeManager.getUserId(),
        name: AttendeeManager.getName(),
        type: type,
        message: message || ''
      };
      return JSON.stringify(msg);
    },
    parseMessage: function(msg) {
      try {
        var parsed = JSON.parse(msg);
        return parsed;
      } catch(e) {
        throw e;
      }
    }
  };

  // TODO: kill this
  var AttendeeManager = (function() {
    var _user_id = null,
        _name = '',
        _attendees = [];
    return {
      setUserId: function(user_id) {
        _user_id = user_id;
      },
      getUserId: function() {
        return _user_id;
      },
      setName: function(name) {
        _name = name;
      },
      getName: function() {
        return _name;
      },
      setAttendees: function(attendees) {
        var deletion = _attendees.filter(function(_attendee) {
          return attendees.every(function(attendee) {
            return (attendee.user_id != _attendee.user_id);
          });
        });
        var addition = attendees.filter(function(attendee) {
        });
        _attendees = attendees;
      },
      getAttendees: function() {
        return _attendees;
      },
      addAudioPlayer: function(user_id, destination) {
      },
      removeAudioPlayer: function(user_id) {
      }
    };
  })();

  var AudioSource = function() {
    this.buffer = [[], []];
    this.js = audioContext.createScriptProcessor(BUFFER_LENGTH, 2, 2);
    this.js.onaudioprocess = this.onaudioprocess.bind(this);
    this.socket = null;
    this.getBufferCallback = null;
  };
  AudioSource.prototype = {
    onaudioprocess: function(event) {
      if (typeof this.getBufferCallback === 'function')
        this.getBufferCallback();

      var buffers = [],
          that = this;
      for (var ch = 0; ch < this.buffer.length; ch++) {
        buffers.push(this.buffer[ch].shift() || new Float32Array(BUFFER_LENGTH));
      }
      if (this.socket) { // only player have socket set
        binarize.pack({
          user_id:AttendeeManager.getUserId(),
          ch_num:buffers.length,
          buffer_length:BUFFER_LENGTH,
          buffer_array:buffers
        }, function(buffer) {
          that.socket.send(buffer);
        });
      }
      for (ch = 0; ch < buffers.length; ch++) {
        event.outputBuffer.getChannelData(ch).set(buffers[ch]);
      }
    },
    connect: function(destination) {
      this.js.connect(destination);
    },
    disconnect: function() {
      this.js.disconnect();
    },
    connectSocket: function(socket) {
      this.socket = socket;
    },
    setBuffer: function(buffer) {
      for (var ch = 0; ch < buffer.length; ch++) {
        this.buffer[ch].push(buffer[ch]);
      }
    }
  };

  var InputSource = function(stream) {
    this.stream = stream;
    this.media = audioContext.createMediaStreamSource(stream);
    this.js = audioContext.createScriptProcessor(BUFFER_LENGTH, 2, 2);
    this.js.onaudioprocess = this.onaudioprocess.bind(this);
    this.media.connect(this.js);
    this.socket = null;
  };
  InputSource.prototype = {
    onaudioprocess: function(event) {
      var buffers = [],
          that = this;
      for (var i = 0; i < event.inputBuffer.numberOfChannels; i++) {
        buffers[i] = event.inputBuffer.getChannelData(i);
      }
      if (this.socket) { // only player have socket set
        binarize.pack({
          user_id:AttendeeManager.getUserId(),
          ch_num:buffers.length,
          buffer_length:BUFFER_LENGTH,
          buffer_array:buffers
        }, function(buffer) {
          that.socket.send(buffer);
        });
      }
      for (i = 0; i < buffers.length; i++) {
        event.outputBuffer.getChannelData(i).set(buffers[i]);
      }
    },
    connect: function(destination) {
      this.js.connect(destination);
    },
    disconnect: function() {
      this.media.mediaStream.stop();
      this.js.disconnect();
    },
    connectSocket: function(socket) {
      this.socket = socket;
    }
  };

  var AudioPlayer = function(source, destination, onplayend) {
    this.source = source;
    if (typeof onplayend === 'function')
      this.onplayend = onplayend;
    this.destination = destination;
    this.isPlaying = false;
    this.buffer = [[], []]; // temprary buffer for playback
    this.sound = []; // storage for whole audio
  };
  AudioPlayer.prototype = {
    listen: function() {
      this.source.connect(this.destination);
    },
    play: function() {
      for (var ch = 0; ch < this.sound.length; ch++) {
        for (var i = 0; i < this.sound[ch].length; i++) {
          this.buffer[ch].push(this.sound[ch][i]);
        }
      }
      this.source.connect(this.destination);
      this.isPlaying = true;
    },
    stop: function() {
      this.source.disconnect();
      this.isPlaying = false;
    },
    setBuffer: function(buffer) {
      this.sound = buffer;
      this.source.getBufferCallback = this.getBuffer.bind(this);
    },
    getBuffer: function() {
      var buffer = [];
      for (var ch = 0; ch < this.buffer.length; ch++) {
        buffer[ch] = this.buffer[ch].shift();
      }
      this.source.setBuffer(buffer);
      if (this.buffer[0].length === 0) {
        this.onplayend();
      }
    }
  };

  var AudioStreamer = function(host, callback) {
    var that = this;
    ws_host = host;
    this.listenerBuffer = [[],[]];
    this.buffer = [];
    this.source = null;
    this.audioReady = false;
    this.onctrlmsg = null;
    this.onMessage = null;
    this.heartbeat = null;

    this.websocket = new WebSocket(ws_host+'/socket');
    this.websocket.onopen = function() {
      that.websocket.binaryType = 'arraybuffer';
      if (typeof callback == 'function') {
        callback();
      }
      that.heartbeat = setInterval(that.sendHeartBeat.bind(that), 30 * 1000);
    };
    this.websocket.onmessage = function(req) {
      var msg = '';
      try {
        if (typeof req.data == 'string') {
          // string
          msg = TextMessage.parseMessage(req.data);
          if (msg.type == 'connected') {
            AttendeeManager.setUserId(msg.user_id);
            return;
          }
          if (msg.type == 'connection') {
            AttendeeManager.setAttendees(msg.message);
          }
          that.onMessage(msg);
        } else {
          // binary
          binarize.unpack(req.data, function(msg) {
            if (msg.user_id == AttendeeManager.getUserId()) return; // skip if audio is originated from same user
            var buffers = [];
            for (var ch = 0; ch < msg.ch_num; ch++) {
              buffers[ch] = msg.buffer_array[ch];
            }
            that.audioListener.source.setBuffer(buffers);
          });
        }
      } catch(e) {
        throw e;
      }
    };
    this.websocket.onclose = function() {
      clearInterval(that.heartbeat);
    };
    this.websocket.onerror = function() {
      console.log('connection error.');
    };

    this.audioMerger = audioContext.createChannelMerger();
    // this is currently only one listener. TODO: Create listener per user
    var listenerSource = new AudioSource();
    this.audioListener = new AudioPlayer(listenerSource, this.audioMerger);
    this.audioListener.listen();
    // TODO: move visual element to outside
    var elem = document.getElementById('visualizer');
    this.visualizer = new SpectrumVisualizer(audioContext, {
      elem: elem
    });
    this.visualizer.connect(this.audioMerger, audioContext.destination);
  };
  AudioStreamer.prototype = {
    nameSelf: function(name) {
      AttendeeManager.setName(name);
      var msg = TextMessage.createMessage('connection');
      this.websocket.send(msg);
    },
    sendText: function(text) {
      var msg = TextMessage.createMessage('message', text);
      this.websocket.send(msg);
    },
    sendHeartBeat: function() {
      var msg = TextMessage.createMessage('heartbeat');
      this.websocket.send(msg);
    },
    connectPlayer: function(stream, callback, onplayend) {
      if (this.audioPlayer) this.audioPlayer.stop();
      this.visualizer.disconnect();
      this.audioReady = true;

      this.source = new InputSource(stream);
      this.source.connectSocket(this.websocket);
      this.audioPlayer = new AudioPlayer(this.source, this.audioMerger, onplayend);
      this.visualizer.connect(this.audioMerger, audioContext.destination);
      this.audioPlayer.play();
      callback();
    },
    updatePlayer: function(file, callback, onplayend) {
      if (file.type.indexOf('audio') !== 0)
          throw 'this is not an audio file.';
      var that = this;
      if (this.audioPlayer) this.audioPlayer.stop();
      this.visualizer.disconnect();
      this.audioReady = false;

      this.source = new AudioSource();
      this.source.connectSocket(this.websocket);
      this.audioPlayer = new AudioPlayer(this.source, this.audioMerger, onplayend);

      var reader = new FileReader();
      reader.onload = function(e) {
        audioContext.decodeAudioData(e.target.result, function(buffer) {
          var buffers = [];
          for (var ch = 0; ch < buffer.numberOfChannels; ch++) {
            buffers[ch] = [];
            for (var i = 0; i < buffer.length; i++) {
              var index = ~~(i/BUFFER_LENGTH);
              var offset = i%BUFFER_LENGTH;
              if (offset === 0) buffers[ch][index] = new Float32Array(BUFFER_LENGTH);
              buffers[ch][index][offset] = buffer.getChannelData(ch)[i];
            }
          }
          that.audioPlayer.setBuffer(buffers);
          that.audioReady = true;
          that.visualizer.connect(that.audioMerger, audioContext.destination);
          callback();
        }, function() {
          throw 'failed to load audio.';
        });
      };
      reader.readAsArrayBuffer(file);
    },
    play: function() {
      this.websocket.send(JSON.stringify({
        user_id:  AttendeeManager.getUserId(),
        name: AttendeeManager.getName(),
        type: 'start_music'
      }));
      this.audioPlayer.play();
    },
    stop: function() {
      if (this.audioPlayer) this.audioPlayer.stop();
    },
    disconnect: function() {
      if (this.websocket.close) {
        this.stop();
        this.audioListener.stop();
        this.websocket.close();
        clearInterval(this.heartbeat);
        console.debug('socket disconnected.');
      }
    }
  };

  return function(host, callback) {
    return new AudioStreamer(host, callback);
  };
})();