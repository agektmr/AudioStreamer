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
  var canvas = document.createElement('canvas');
  canvas.setAttribute('width', params.width || 400);
  canvas.setAttribute('height', params.height || 200);
  this.cc = canvas.getContext('2d');
  params.elem.appendChild(canvas);

  this.width = parseInt(canvas.width);
  this.height = parseInt(canvas.height);

  this.analyser = this.ac.createAnalyser();
  this.analyser.smoothingTimeConstant = params.smoothingTimeConstant || 0.3;
  var analyse = function() {
    var freqByteData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqByteData);
    this._draw(freqByteData);
    webkitRequestAnimationFrame(analyse.bind(this));
  };
  analyse.call(this);
};
SpectrumVisualizer.prototype = {
  connect: function(source, destination) {
    source.connect(this.analyser);
    this.analyser.connect(destination);
  },
  disconnect: function() {
    if (this.source) this.source.disconnect();
    this.analyser.disconnect();
  },
  _draw: function(freq) {
    var length = freq.length;
    this._clear();

    // Draw rectangle for each frequency bin.
    this.cc.beginPath();
    for (var i = 0; i < this.width; i++) {
      var index = ~~(length / this.width * i);
      var value =  ~~(this.height - ((freq[index] || 0) / 256 * this.height));
      if (i == 0) this.cc.moveTo(0, value);
      this.cc.lineTo(i + 1, value);
    }
    this.cc.stroke();
  },
  _clear: function() {
    this.cc.clearRect(0, 0, this.width, this.height);
  }
};