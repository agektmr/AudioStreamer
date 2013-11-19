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

var WS_HOST = window.location.href.replace(/(http|https)(:\/\/.*?)\//, 'ws$2'),
    as = null;

var audioContext = window.AudioContext ? new window.AudioContext() :
                   window.webkitAudioContext ? new window.webkitAudioContext() :
                   window.mozAudioContext ? new window.mozAudioContext() :
                   window.oAudioContext ? new window.oAudioContext() :
                   window.msAudioContext ? new window.msAudioContext() :
                   undefined;
var getUserMedia = navigator.getUserMedia ? 'getUserMedia' :
                   navigator.webkitGetUserMedia ? 'webkitGetUserMedia' :
                   navigator.mozGetUserMedia ? 'mozGetUserMedia' :
                   navigator.oGetUserMedia ? 'oGetUserMedia' :
                   navigator.msGetUserMedia ? 'msGetUserMedia' :
                   undefined;

var AudioStreamerCtrl = function($scope) {
  var error_msg = [];
  if (!WebSocket) {
    error_msg.push("Your browser doesn't seem to support WebSocket.");
  }
  if (!audioContext) {
    error_msg.push("Your browser doesn't seem to support Web Audio API.");
  }
  if (!getUserMedia) {
    error_msg.push("Your browser doesn't seem to support WebRTC.");
  }

  $scope.browser_alerts = error_msg;
  $scope.websocket_started = false;
  $scope.input_started = false;
  $scope.audio_loaded = false;
  $scope.source_connected = false;

  $scope.session_button = 'connect';
  $scope.name = '';
  $scope.attendees = [];
  $scope.message = '';
  $scope.messages = [];
  $scope.notification = '';
  $scope.notification_type = 'info';
  $scope.toggle_session = function() {
    if ($scope.websocket_started) {
      $scope.streamer.disconnect();
      $scope.streamer = null;
      $scope.websocket_started = false;
      $scope.session_button = 'connect';
      $scope.notify('You are disconnected', 'success');
    } else {
      $scope.input_started = false;
      $scope.audio_loaded = false;
      $scope.source_connected = false;
      $scope.streamer = new AudioStreamer(WS_HOST, function() {
        $scope.streamer.onMessage = $scope.onmessage;
        $scope.streamer.nameSelf($scope.name || 'No Name');
        $scope.websocket_started = true;
        $scope.session_button = 'disconnect';
        $scope.notify('Welcome, '+$scope.name+'!', 'success');
        $scope.$apply();
      });
    }
  };
  $scope.onmessage = function(msg) {
    switch (msg.type) {
      case 'connected':
        return;
      case 'connection':
        $scope.attendees = msg.message;
        break;
      case 'message':
        $scope.messages.unshift(msg);
        break;
      case 'start_music':
        msg.message = 'Started playing audio';
        $scope.messages.unshift(msg);
        break;
      default:
        return;
    }
    $scope.$apply();
  };
  $scope.send_message = function() {
    var message = $scope.message;
    if (message.length > 0) {
      $scope.streamer.sendText(message);
      $scope.message = '';
      $scope.$apply();
    }
  };
  $scope.notify = function(message, type, sticky) {
    sticky = sticky || false;
    type = type || 'info';
    $scope.notification = message;
    $scope.notification_type = type;
    if (!$scope.$$phase) $scope.$apply();
    if (!sticky) {
      setTimeout(function() {
        $scope.notification = '';
        $scope.$apply();
      }, 3000);
    };
  };

  document.querySelector('#text').onkeydown = function(e) {
    if (e.keyCode == 13) {
      $scope.send_message();
      e.stopPropagation();
      e.preventDefault();
    }
  };
};

var AudioCtrl = function($scope) {
  $scope.mode = 'file';
  $scope.playing = false;
  $scope.loading = false;
  $scope.play_stop_button = 'Play';
  $scope.connect_audio_input_button = 'Connect microphone';
  $scope.input_connected = false;
  $scope.load_audio = function(e) {
    player.style.backgroundColor = '';
    e.preventDefault();
    e.stopPropagation();
    if ($scope.mode == 'file' && $scope.websocket_started) {
      var file = e.dataTransfer.files[0];
      $scope.loading = true;
      $scope.notify('loading audio. just a second...', 'info', true);
      $scope.streamer.updatePlayer(file, function() {
        $scope.notify('audio loaded. ready to play!', 'success');
        $scope.source_connected = true;
        $scope.audio_loaded = true;
        $scope.input_started = true;
        $scope.loading = false;
        $scope.$apply();
      }, $scope.play_stop);
    }
  };
  $scope.connect_audio_input = function(e) {
    navigator[getUserMedia]({audio:true}, function(stream) {
      $scope.input_connected = true;
      $scope.streamer.connectPlayer(stream, function() {
        $scope.notify('audio input started.', 'success');
        $scope.connect_audio_input_button = 'Microphone connected';
        $scope.source_connected = true;
        $scope.play_stop_button = 'Stop';
        $scope.$apply();
      }, $scope.play_stop);
    }, function(e) {
      $scope.connect_audio_input_button = 'Connect microphone';
      $scope.source_connected = false;
    });
  };
  $scope.play_stop = function() {
    if ($scope.play_stop_button == 'Stop') {
      $scope.streamer.stop();
      $scope.play_stop_button = 'Play';
      if (!$scope.$$phase) $scope.$apply();
    } else {
      $scope.streamer.play();
      $scope.play_stop_button = 'Stop';
    }
  };

  var player = document.querySelector('#player');
  player.ondragenter = function(e) {
    if ($scope.mode == 'file' && $scope.websocket_started) {
      player.style.backgroundColor = '#eee';
    }
  };
  player.ondragleave = function(e) {
    if ($scope.mode == 'file' && $scope.websocket_started) {
      player.style.backgroundColor = '';
    }
  };
  player.ondragover = function(e) {
    if ($scope.mode == 'file' && $scope.websocket_started) {
      player.style.backgroundColor = '#eee';
    }
    e.preventDefault();
  };
  player.ondrop = $scope.load_audio;
};