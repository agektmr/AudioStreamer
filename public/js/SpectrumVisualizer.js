/*
 * params {
 *   elem
 *   width
 *   height
 *   smoothingTimeConstant
 *   buffer_length
 *   inputs
 *   outputs
 * }
 */
var SpectrumVisualizer = function(audioContext, params) {
  this.ac = audioContext;
  this.canvas = document.createElement('canvas');
  this.canvas.setAttribute('width', params.width || 400);
  this.canvas.setAttribute('height', params.height || 200);
  this.cc = this.canvas.getContext('2d');
  params.elem.appendChild(this.canvas);

  this.width = parseInt(this.canvas.width);
  this.height = parseInt(this.canvas.height);

  this.inputs = params.inputs || 2;
  this.outputs = params.outputs || 2;
  this.analyser = this.ac.createAnalyser();
  this.analyser.smoothingTimeConstant = params.smoothingTimeConstant || 0.3;
  this.js = this.ac.createJavaScriptNode(
    params.buffer_length || 2048,
    this.inputs,
    this.outputs
  );
  this.js.onaudioprocess = function(event) {
    var freqByteData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqByteData);
    this._draw(freqByteData);
    for (var i = 0; i < this.inputs; i++) {
      event.outputBuffer.getChannelData(i).set(event.inputBuffer.getChannelData(i));
    }
  }.bind(this);
};
SpectrumVisualizer.prototype = {
  connect: function(source, destination) {
    source.connect(this.analyser);
    this.analyser.connect(this.js);
    this.js.connect(destination);
  },
  disconnect: function() {
    if (this.source) this.source.disconnect();
    this.analyser.disconnect();
    this.js.disconnect();
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