var AudioStreamer = (function() {
  var listenerBuffer = [],
      BUFFER_LENGTH = 2048,
      ws_host = window.location.href.replace(/(http|https)(:\/\/.*?)\//, 'ws$2'),
      ac = null
  if (window.webkitAudioContext) {
    ac = new webkitAudioContext();
  } else {
    alert('You need Chrome to play with this demo');
    return;
  };

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

  var AudioMessage = (function() {
    /*
     * JSON Schema (extended with TypedArray)
     * {
     *   "name": "AudioMessage",
     *   "properties": {
     *     "user_id": {
     *       "type": "Uint32Array",
     *       "description": "user id of original sender",
     *       "required": true
     *     },
     *     "ch_num": {
     *       "type": "Uint8Array",
     *       "description": "number of channels",
     *       "required": true
     *     }
     *     "buffer_length": {
     *       "type": "Uint32Array",
     *       "descriptoin": "audio buffer length",
     *       "required": true
     *     },
     *     "buffer_array": {
     *       "type": "array",
     *       "description": "concatenated array of audio buffers through all channels",
     *       "required": true
     *       "items": {
     *         "type": "Float32Array",
     *         "description": "audio buffer"
     *       }
     *     }
     *   }
     * }
     */
    return {
      createMessage: function(msg_obj) {
        var bl = msg_obj.buffer_length;
        var ch_num = msg_obj.buffer_array.length;
        var ab = new ArrayBuffer(4 + 1 + 4 + (bl * ch_num * 4));
        var view = new DataView(ab);
        var offset = 0;
        view.setUint32(offset, msg_obj.user_id);
        offset += 4;
        view.setUint8(offset, ch_num);
        offset += 1;
        view.setUint32(offset, bl);
        offset += 4;
        for (var i = 0; i < ch_num; i++) {
          for (var j = 0; j < bl; j++) {
            view.setFloat32(offset, msg_obj.buffer_array[i][j]);
            offset += 4;
          }
        }
        return new Uint8Array(view.buffer);
      },
      parseMessage: function(bin_msg) {
        try {
          var offset = 0;
          var msg_obj = {};
          var view = new DataView(bin_msg);
          msg_obj.user_id = view.getUint32(0);
          offset += 4;
          msg_obj.ch_num = view.getUint8(4);
          offset += 1;
          msg_obj.buffer_length = view.getUint32(5);
          offset += 4;
          msg_obj.buffer_array = new Array(msg_obj.ch_num);
          for (var i = 0; i < msg_obj.ch_num; i++) {
            msg_obj.buffer_array[i] = new Float32Array(msg_obj.buffer_length)
            for (var j = 0; j < msg_obj.buffer_length; j++) {
              msg_obj.buffer_array[i][j] = view.getFloat32(offset);
              offset += 4;
            }
          }
          return msg_obj;
        } catch (e) {
          throw e;
        }
      }
    }
  })();

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
          })
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

  var AudioPlayer = function(destination) {
    var that = this;
    this.destination = destination;
    this.type = 'Listener';
    // audioBuffer is source of streaming buffers
    this.audioBuffer = [[], []];
    // source is inventory of audio buffers
    this.source = [];
    this.isPlaying = false;
    this.onPlayEnd = null;

    this.js = ac.createJavaScriptNode(BUFFER_LENGTH, 2, 2);
    this.js.onaudioprocess = function(event) {
      var buffers = [];
      for (var i = 0; i < that.audioBuffer.length; i++) {
        buffers.push(that.audioBuffer[i].shift() || new Float32Array(BUFFER_LENGTH));
      }
      if (that.type == 'Player') {
        if (that.audioBuffer[0].length == 0) {
          that.stop();
        } else {
          var msg = AudioMessage.createMessage({
            user_id:AttendeeManager.getUserId(),
            buffer_length:BUFFER_LENGTH,
            buffer_array:buffers
          });
          that.socket.send(msg.buffer);
        } 
      }
      for (var i = 0; i < buffers.length; i++) {
        event.outputBuffer.getChannelData(i).set(buffers[i]);
      }
    };
  };
  AudioPlayer.prototype = {
    load: function(source, socket) {
      this.socket = socket || null;
      if (source.getChannelData) {
        this.source = [];
        for (var ch = 0; ch < source.numberOfChannels; ch++) {
          this.source[ch] = [];
          for (var i = 0; i < source.length; i++) {
            var index = ~~(i/BUFFER_LENGTH);
            var offset = i%BUFFER_LENGTH;
            if (offset == 0) this.source[ch][index] = new Float32Array(BUFFER_LENGTH);
            this.source[ch][index][offset] = source.getChannelData(ch)[i];
          }
        }
        this.type = 'Player';
      } else {
        this.audioBuffer = source;
        this.type = 'Listener';
      }
    },
    listen: function() {
      this.js.connect(this.destination);
    },
    play: function() {
      this.js.connect(this.destination);
      for (var ch = 0; ch < this.source.length; ch++) {
        for (var i = 0; i < this.source[ch].length; i++) {
          this.audioBuffer[ch][i] = this.source[ch][i];
        }
      }
      this.isPlaying = true;
    },
    stop: function() {
      this.js.disconnect();
      this.isPlaying = false;
      if (typeof this.onPlayEnd == 'function') this.onPlayEnd();
    }
  };

  var AudioStreamer = function(host, callback) {
    var that = this;
    ws_host = host;
    listenerBuffer = [[],[]];
    this.audioReady = false;
    this.onctrlmsg = null;
    this.onMessage = null;
    this.heartbeat = null;

    this.websocket = new WebSocket(ws_host+'/socket');
    this.websocket.onopen = function() {
      that.websocket.binaryType = 'arraybuffer';
      console.debug('socket established.');
      if (typeof callback == 'function') {
        callback();
      };
      that.heartbeat = setInterval(as.sendHeartBeat.bind(that), 30 * 1000);
    };
    this.websocket.onmessage = function(req) {
      try {
        if (typeof req.data == 'string' && typeof that.onctrlmsg == 'function') {
console.debug(req.data);
          // string
          var msg = TextMessage.parseMessage(req.data);
          switch (msg.type) {
          case 'connected':
            AttendeeManager.setUserId(msg.user_id);
            break;
          case 'connection':
            AttendeeManager.setAttendees(msg.message);
            that.onctrlmsg(msg);
            break;
          case 'message':
            that.onMessage(msg.name+': '+msg.message);
            break;
          case 'start_music':
            that.onMessage(msg.name+' started playing music');
            break;
          }
        } else {
          // binary
          var msg = AudioMessage.parseMessage(req.data);
          if (msg.user_id == AttendeeManager.getUserId()) return; // skip if audio is originated from same user
          for (var ch = 0; ch < msg.ch_num; ch++) {
            listenerBuffer[ch].push(msg.buffer_array[ch]);
          }
        }
      } catch(e) {
        throw e;
      }
    };
    this.websocket.onclose = function() {
      clearInterval(that.heartbeat);
      alert('connection closed.');
    };
    this.websocket.onerror = function() {
      alert('connection error.');
    };

    this.audioMerger = ac.createChannelMerger();
    this.audioListener = new AudioPlayer(this.audioMerger);
    this.audioListener.load(listenerBuffer);
    this.audioListener.listen();
    // TODO: move visual element to outside
    this.visualizer = new SpectrumVisualizer(ac, {
      elem: document.getElementById('visualizer'),
      width: 600,
      height: 150
    });
    this.visualizer.connect(this.audioMerger, ac.destination);
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
    updatePlayer: function(file, callback, playEndCallback) {
      var that = this;
      var reader = new FileReader();
      reader.onload = function(e) {
        ac.decodeAudioData(e.target.result, function(buffer) {
          that.audioReady = true;
          if (that.audioPlayer) that.audioPlayer.stop();
          that.visualizer.disconnect();
          that.audioPlayer = new AudioPlayer(that.audioMerger);
          if (playEndCallback) that.audioPlayer.onPlayEnd = playEndCallback;
          that.audioPlayer.load(buffer, that.websocket);
          that.visualizer.connect(that.audioMerger, ac.destination);
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
      };
    }
  };

  return function(host, callback) {
    return new AudioStreamer(host, callback);
  };
})();
