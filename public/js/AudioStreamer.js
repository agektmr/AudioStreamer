var AudioStreamer = (function() {
  var listenerBuffer = [[], []],
      BUFFER_LENGTH = 2048,
      ws_host = window.location.href.replace(/(http|https)(:\/\/.*?)\//, 'ws$2'),
      ac = new webkitAudioContext();

  var AudioPlayer = function() {
    var that = this;
    this.type = 'Listener';
    this.audioBuffer = [[], []];
    this.isPlaying = false;

    this.js = ac.createJavaScriptNode(BUFFER_LENGTH, 2, 2);
    this.js.onaudioprocess = function(event) {
      var l = that.audioBuffer[0].shift() || new Float32Array(BUFFER_LENGTH);
      var r = that.audioBuffer[1].shift() || new Float32Array(BUFFER_LENGTH);
      event.outputBuffer.getChannelData(0).set(l);
      event.outputBuffer.getChannelData(1).set(r);
      that.visualize();
    };

    this.analyser = ac.createAnalyser();
    this.analyser.smoothingTimeConstant = 0.3;

    this.trailing = 0; // Stop playing a few audioprocess after decay
    this.processor = ac.createJavaScriptNode(BUFFER_LENGTH, 2, 2);
    this.processor.onaudioprocess = function(event) {
      var l = event.inputBuffer.getChannelData(0);
      var r = event.inputBuffer.getChannelData(1);
      if (that.type == 'Player') {
        if (that.audioBuffer[0].length == 0) {
          if (that.trailing++ > 3) {
            that.trailing = 0;
            that.stop();
          }
        } else {
          var buffer = new Float32Array(BUFFER_LENGTH * 2);
          for (var i = 0; i < BUFFER_LENGTH; i++) {
            buffer[i] = l[i];
          }
          for (var i = 0; i < BUFFER_LENGTH; i++) {
            buffer[BUFFER_LENGTH+i] = r[i];
          }
          that.socket.send(buffer.buffer);
        } 
        return;
      }
      event.outputBuffer.getChannelData(0).set(l);
      event.outputBuffer.getChannelData(1).set(r);
    }
  };
  AudioPlayer.prototype = {
    load: function(source, visualizer, socket) {
      // stock audio source to source as array of arraybuffers
      this.visualizer = visualizer || null;
      this.socket = socket || null;
      if (source.getChannelData) {
        this.source = [[], []];
        for (var i = 0; i < source.getChannelData(0).length; i++) {
          var index = ~~(i/BUFFER_LENGTH);
          if (i%BUFFER_LENGTH == 0) {
            this.source[0][index] = new Float32Array(BUFFER_LENGTH);
            this.source[1][index] = new Float32Array(BUFFER_LENGTH);
          }
          this.source[0][index][i%BUFFER_LENGTH] = source.getChannelData(0)[i];
          this.source[1][index][i%BUFFER_LENGTH] = source.getChannelData(1)[i];
        }
        this.type = 'Player';
      } else {
        this.audioBuffer = source;
        this.type = 'Listener';
      }
    },
    listen: function() {
      this.js.connect(this.analyser);
      this.analyser.connect(this.processor);
      this.processor.connect(ac.destination);
    },
    play: function() {
      this.js.connect(this.analyser);
      this.analyser.connect(this.processor);
      this.processor.connect(ac.destination);
      for (var i = 0; i < this.source[0].length; i++) {
        this.audioBuffer[0][i] = this.source[0][i];
        this.audioBuffer[1][i] = this.source[1][i];
      }
      this.isPlaying = true;
    },
    stop: function() {
      this.js.disconnect();
      this.analyser.disconnect();
      this.processor.disconnect();
      this.isPlaying = false;
    },
    visualize: function(that) {
      if (typeof this.visualizer != null) {
        var freqByteData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(freqByteData);
        this.visualizer.draw(freqByteData);
      }
    }
  };

  var AudioStreamer = function(host, visualizer, callback) {
    var that = this;
    ws_host = host;
    listenerBuffer[0] = [];
    listenerBuffer[1] = [];
    this.audioReady = false;
    this.onctrlmsg = null;
    this.heartbeat = null;

    this.listener = new WebSocket(ws_host+'/listen');
    this.listener.onopen = function() {
      that.listener.binaryType = 'arraybuffer';
      console.debug('listner established.');
      if (typeof callback == 'function') {
        callback();
      };
      that.heartbeat = setInterval(as.sendHeartBeat.bind(that), 30 * 1000);
    };
    this.listener.onmessage = function(msg) {
      if (typeof msg.data == 'string' && typeof that.onctrlmsg == 'function') {
        // string
        that.onctrlmsg(msg.data);
      } else {
        // binary
        var binary = new Float32Array(msg.data);
        var l = new Float32Array(BUFFER_LENGTH);
        var r = new Float32Array(BUFFER_LENGTH);
        for (var i = 0; i < BUFFER_LENGTH; i++) {
          l[i] = binary[i];
          r[i] = binary[BUFFER_LENGTH + i];
        }
        listenerBuffer[0].push(l);
        listenerBuffer[1].push(r);
        console.debug('listener received a message');
      }
    };
    this.listener.onclose = function() {
      clearInterval(that.heartbeat);
      console.debug('listner closed.');
    };
    this.listener.onerror = function() {
      console.error('listner error.');
    };
    this.audioListener = new AudioPlayer();
    this.audioListener.load(listenerBuffer, visualizer);
    this.audioListener.listen();
    this.player = null;
  };
  AudioStreamer.prototype = {
    nameSelf: function(name) {
      this.listener.send(name);
    },
    sendText: function(text) {
      this.listener.send(text);
    },
    sendHeartBeat: function() {
      this.listener.send('heartbeat');
    },
    loadAudio: function(file, visualizer, callback) {
      var that = this;
      var reader = new FileReader();
      reader.onload = function(e) {
        ac.decodeAudioData(e.target.result, function(buffer) {
          that.audioReady = true;
          that.player = new WebSocket(ws_host+'/play');
          that.player.onopen = function() {
            console.debug('player established.');
          };
          that.player.onmessage = function() {
           console.debug('player received a message.'); 
          };
          that.player.onclose = function() {
           console.debug('player closed.'); 
          };
          that.player.onerror = function() {
           console.debug('player error.'); 
          };
          that.audioPlayer = new AudioPlayer();
          that.audioPlayer.load(buffer, visualizer, that.player);
          callback();
        }, function() {
          errorCallback('failed to load audio.');
        });
      };
      reader.readAsArrayBuffer(file);
    },
    play: function() {
      var that = this;
      this.audioPlayer.play();
    },
    stop: function() {
      if (this.audioSource) {
        this.audioSource.noteOff(0);
        this.audioSource = null;
      };
    },
    rewind: function() {
    },
    disconnect: function() {
      if (this.listener.close) {
        this.listener.close();
        console.debug('listener disconnected.');
      };
      if (this.player && this.player.close) {
        this.player.close();
        console.debug('player disconnected.');
      };
    }
  };

  return function(host, visualizer, callback) {
    return new AudioStreamer(host, visualizer, callback);
  };
})();
