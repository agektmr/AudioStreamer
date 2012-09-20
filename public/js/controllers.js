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

var AudioStreamerCtrl = function($scope) {
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
    $scope.$apply();
    if (!sticky) {
      setTimeout(function() {
        $scope.notification = '';
        $scope.$apply();
      }, 3000);
    };
  };

  $('#text').keydown(function(e) {
    if (e.keyCode == 13) {
      $scope.send_message();
      e.stopPropagation();
      e.preventDefault();
    }
  });
};

var AudioCtrl = function($scope) {
  $scope.playing = false;
  $scope.loading = false;
  $scope.play_stop_button = 'Play';
  $scope.connect_audio_input_button = 'Connect microphone';
  $scope.input_connected = false;
  $scope.load_audio = function(e) {
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
    e.preventDefault();
    e.stopPropagation();
  };
  $scope.connect_audio_input = function(e) {
    navigator.webkitGetUserMedia({audio:true}, function(stream) {
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
    } else {
      $scope.streamer.play();
      $scope.play_stop_button = 'Stop';
    }
  };

  var player = document.querySelector('#player');
  player.ondragenter = function(e) {
    // $('#player').css('backgroundColor', '#eee');
  };
  player.ondragleave = function(e) {
    // $('#player').css('backgroundColor', '#fff');
  };
  player.ondragover = function(e) {
    e.preventDefault();
  };
  player.ondrop = $scope.load_audio;
};