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
var SpectrumVisualizer = (function() {
  var visualizers = [],
      requestAnimationFrame = window.requestAnimationFrame ||
                              window.webkitRequestAnimationFrame ||
                              window.mozRequestAnimationFrame;
  var WIDTH = 500, HEIGHT = 256,
      average = 0, previous = 0;
  var analyse = function() {
    // var now = window.performance.now();
    // average = (average + (now - previous))/2;
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
    // previous = now;
    requestAnimationFrame(analyse);
  };

  var clear = function() {
    this.cc.clearRect(0, 0, WIDTH, HEIGHT);
  };

  var draw = function(freq) {
    var length = freq.length;
    clear.call(this);
    var command = '';

    // Draw rectangle for each frequency bin.
    command += 'cc.beginPath();';
    for (var i = 0; i < WIDTH; i++) {
      var index = ~~(length / WIDTH * i);
      var value =  ~~(HEIGHT - ((freq[index] || 0) / 256 * HEIGHT));
      if (i === 0) {
        command += 'cc.moveTo(0, '+value+');';
      }
      command += 'cc.lineTo('+(i+1)+', '+value+');';
    }
    command += 'cc.stroke();';
    var drawFunc = new Function("cc", command);
    drawFunc(this.cc);
  };

  /*
   * params {
   *   elem
   *   smoothingTimeConstant
   * }
   */
  var SpectrumVisualizer = function(audioContext, params) {
    var canvas;
    this.ac = audioContext;
    if (params.elem.querySelector('canvas')) {
      canvas = params.elem.querySelector('canvas');
    } else {
      canvas = document.createElement('canvas');
      params.elem.appendChild(canvas);
    }
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.cc = canvas.getContext('2d');

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
  };
})();