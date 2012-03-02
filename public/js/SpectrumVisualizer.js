var SpectrumVisualizer = (function() {
  var visualizers = [],
      requestAnimationFrame = window.requestAnimationFrame ||
                              window.webkitRequestAnimationFrame ||
                              window.mozRequestAnimationFrame;
  var analyse = function() {
    for (var i = 0; i < visualizers.length; i++) {
      // remove visualizer if deleted without disconnection
      if (!visualizers[i].analyser) {
        visualizers[i--].disconnect();
        continue;
      }
      var freqByteData = new Uint8Array(visualizers[i].analyser.frequencyBinCount);
      visualizers[i].analyser.getByteFrequencyData(freqByteData);
      draw.call(visualizers[i], freqByteData);
    }
    requestAnimationFrame(analyse);
  };

  var clear = function() {
    this.cc.clearRect(0, 0, this.width, this.height);
  };

  var draw = function(freq) {
    var length = freq.length;
    clear.call(this);

    // Draw rectangle for each frequency bin.
    this.cc.beginPath();
    for (var i = 0; i < this.width; i++) {
      var index = ~~(length / this.width * i);
      var value =  ~~(this.height - ((freq[index] || 0) / 256 * this.height));
      if (i == 0) this.cc.moveTo(0, value);
      this.cc.lineTo(i + 1, value);
    }
    this.cc.stroke();
  };

  /*
   * params {
   *   elem
   *   width
   *   height
   *   smoothingTimeConstant
   * }
   */
  var SpectrumVisualizer = function(audioContext, params) {
    this.ac = audioContext;
    if (params.elem.querySelector('canvas')) {
      var canvas = params.elem.querySelector('canvas');
    } else {
      var canvas = document.createElement('canvas');
      params.elem.appendChild(canvas);
    }
    canvas.setAttribute('width', params.width || 400);
    canvas.setAttribute('height', params.height || 200);
    this.cc = canvas.getContext('2d');

    this.width = parseInt(canvas.width);
    this.height = parseInt(canvas.height);

    this.analyser = this.ac.createAnalyser();
    this.analyser.smoothingTimeConstant = params.smoothingTimeConstant || 0.3;
  };
  SpectrumVisualizer.prototype = {
    connect: function(source, destination) {
      visualizers.push(this);
      source.connect(this.analyser);
      this.analyser.connect(destination);
    },
    disconnect: function() {
      if (this.source) this.source.disconnect();
      this.analyser.disconnect();
      for (var i = 0; visualizers.length; i++) {
        if (visualizers[i] == this) {
          visualizers.splice(i);
        }
      }
    }
  };

  // start analyse interruption
  analyse();

  return function(audioContext, params) {
    return new SpectrumVisualizer(audioContext, params);
  }
})();
