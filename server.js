/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , WebSocketServer = require('ws').Server;

var app = module.exports = express.createServer();

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', routes.index);
// app.get('/play', routes.play);

var sessions = [],
    user_id = 0;
var getUsersList = function() {
  var users_list = [];
  for (var i = 0; i < sessions.length; i++) {
    var user = {
      user_id: sessions[i].user_id,
      name: sessions[i].name
    }
    users_list.push(user);
  }
  return users_list;
};

app.listen(3000, function() {
  var socket = new WebSocketServer({server:app, path:'/socket'});
  socket.on('connection', function(ws) {
    var _name = '';
    var _user_id = user_id++;
    console.log('listener opened a connection.');
    ws.on('message', function(req, flags) {
      if (flags.binary) {
        var length = req.length;
        var binary = new Uint8Array(length);
        for (var i = 0; i < length; i++) {
          binary[i] = req.readUInt8(i);
        };
        for (var i = 0; i < sessions.length; i++) {
          sessions[i].socket.send(binary, {binary:true, mask:false});
        };
      } else {
console.log(req);
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
            }
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
          case 'heartbeat':
            console.log('received heartbeat.');
            return;
          default:
            console.log('received invalid message.');
            return;
        }
        for (var i = 0; i < sessions.length; i++) {
          var listener = sessions[i];
          listener.socket.send(JSON.stringify(res));
        }
      }
    })
    ws.on('close', function() {
      console.log(_name+' closed the connection.');
      for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].socket == ws) {
          sessions.splice(i, 1);
        }
      }
      for (var i = 0; i < sessions.length; i++) {
        var msg = {
          user_id: _user_id,
          name: _name,
          type: 'connection',
          users_list: getUsersList()
        };
        sessions[i].socket.send(msg);
      }
    });
    ws.on('error', function() {
    });
  })
});

console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);