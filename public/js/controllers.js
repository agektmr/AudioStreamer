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
  $scope.session_standby = true;
  $scope.session_button = 'connect';
  $scope.name = '';  
  $scope.attendees = [];
  $scope.message = '';
  $scope.messages = [];
  $scope.notification = '';
  $scope.notification_type = 'info';
  $scope.toggle_session = function() {
    if (!$scope.session_standby) {
      $scope.streamer.disconnect();
      $scope.streamer = null;
      $scope.session_standby = true;
      $scope.session_button = 'connect';
      $scope.notify('You are disconnected', 'success');
    } else {
      $scope.streamer = new AudioStreamer(WS_HOST, function() {
        $scope.streamer.onMessage = $scope.onmessage;
        $scope.streamer.nameSelf($scope.name || 'No Name');
        $scope.session_standby = false;
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
  $scope.load_audio = function(e) {
    var file = e.dataTransfer.files[0];
    $scope.loading = true;
    $scope.notify('loading audio. just a second...', 'info', true);
    $scope.streamer.updatePlayer(file, function() {
      $scope.notify('audio loaded. ready to play!', 'success');
      $scope.loading = false;
      $scope.$apply();
    }, function() {
      $scope.playing = false;
      $scope.play_stop_button = 'Play';
      $scope.$apply();
    });
    e.preventDefault();
    e.stopPropagation();
  };
  $scope.play_stop = function() {
    if ($scope.playing) {
      $scope.streamer.stop();
      $scope.playing = false;
      $scope.play_stop_button = 'Play';
    } else {
      $scope.streamer.play();
      $scope.playing = true;
      $scope.play_stop_button = 'Stop';
    }
    $scope.$apply();
  };

  var player = $('#player').get(0);
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