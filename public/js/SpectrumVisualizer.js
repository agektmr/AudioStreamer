var SpectrumVisualizer = function(elem, width, height) {
  this.canvas = document.createElement('canvas');
  this.canvas.setAttribute('width', width);
  this.canvas.setAttribute('height', height);
  this.ctx = this.canvas.getContext('2d');
  elem.appendChild(this.canvas);

  this.width = Number(this.canvas.width);
  this.height = Number(this.canvas.height);
};
SpectrumVisualizer.prototype = {
  draw: function(freq) {
    var length = freq.length;
    this.clear();

    // Draw rectangle for each frequency bin.
    this.ctx.beginPath();
    for (var i = 0; i < this.width; i++) {
      var index = ~~(length / this.width * i);
      var value =  ~~(this.height - ((freq[index] || 0) / 256 * this.height));
      if (i == 0) this.ctx.moveTo(0, value);
      this.ctx.lineTo(i + 1, value);
    }
    this.ctx.stroke();
  },
  clear: function() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
};