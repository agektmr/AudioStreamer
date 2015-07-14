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

/**
 * Module dependencies.
 */

var express = require('express'),
    binarize = require('binarize.js'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    routes = require('./routes'),
    path = require('path'),
    errorHandler = require('errorhandler'),
    WebSocketServer = require('ws').Server;

var app = express();

app.set('port', process.env.PORT || 8000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(bodyParser());
app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));

if (app.get('env') == 'development') {
  app.use(errorHandler({ dumpExceptions: true, showStack: true }));
} else if (app.get('env') == 'production') {
  app.use(errorHandler());
}

// Routes

app.get('/', function (req, res) {
  res.render('layout', {
    title: 'Audio Stream Experiment',
    layout: 'layout'
  });
})
// app.get('/play', routes.play);

var sessions = [],
    user_id = 0;
var getUsersList = function() {
  var users_list = [];
  for (var i = 0; i < sessions.length; i++) {
    var user = {
      user_id: sessions[i].user_id,
      name: sessions[i].name
    };
    users_list.push(user);
  }
  return users_list;
};

app.listen(8000, function() {
  console.log('opening websocket connection...');
  var socket = new WebSocketServer({server:app, path:'/socket'});
  socket.on('connection', function(ws) {
    var _name = '';
    var _user_id = user_id++; // increment user_id on connection
    console.log('a user opened a connection.');
    ws.on('open', function() {
      console.log('connection opened');
    });
    ws.on('message', function(req, flags) {
      if (flags.binary) {
        var length = req.length;
        var binary = new Uint8Array(length);
        for (var i = 0; i < length; i++) {
          binary[i] = req.readUInt8(i);
        }
        for (var j = 0; j < sessions.length; j++) {
          if (sessions[j].socket == ws) continue;
          sessions[j].socket.send(binary, {binary:true, mask:false});
        }
      } else {
        var msg = JSON.parse(req);
        var res = {
          type: msg.type
        };
        switch (msg.type) {
          case 'message':
            console.log('received a message: "'+msg.message+'"');
            res.name = _name;
            res.user_id = _user_id;
            res.message = msg.message;
            break;
          case 'connection':
            _name = msg.name;
            var user = {
              name: _name || 'No Name',
              user_id: _user_id,
              socket: ws
            };
            ws.send(JSON.stringify({
              user_id: user.user_id,
              name: user.name,
              type: 'connected'
            }));
            sessions.push(user);
            res.name = user.name;
            res.user_id = user.user_id;
            res.message = getUsersList();
            break;
          case 'start_music':
            res.name = msg.name;
            res.user_id = msg.user_id;
            res.message = msg.message || '';
            break;
          case 'heartbeat':
            console.log('received heartbeat.');
            return;
          default:
            console.log('received invalid message.');
            return;
        }
        for (var k = 0; k < sessions.length; k++) {
          sessions[k].socket.send(JSON.stringify(res));
        }
      }
    });
    ws.on('close', function() {
      console.log(_name+' closed the connection.');
      for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].socket == ws) {
          sessions.splice(i, 1);
          if (sessions.length === 0) user_id = 0; // reset user_id
        }
      }
      for (var l = 0; l < sessions.length; l++) {
        var msg = {
          user_id: _user_id,
          name: _name,
          type: 'connection',
          message: getUsersList()
        };
        sessions[l].socket.send(JSON.stringify(msg));
      }
    });
    ws.on('error', function(event) {
      console.log('error on connection:', event);
    });
  });
});

console.log("Express server listening on port %d in %s mode", app.get('port'), app.get('env'));
