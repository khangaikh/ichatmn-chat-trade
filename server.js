var express = require('express')
, app = express()
, server = require('http').createServer(app)
, io = require("socket.io").listen(server)
, dl  = require('delivery')
, fs  = require('fs')
, npid = require("npid")
, uuid = require('node-uuid')
, Room = require('./room.js')
, _ = require('underscore')._;

var multer  = require('multer');
var done=false;

app.configure(function() {
	app.set('port', process.env.OPENSHIFT_NODEJS_PORT || 3001);
  	app.set('ipaddr', process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(__dirname + '/public'));
	app.use('/components', express.static(__dirname + '/components'));
	app.use('/js', express.static(__dirname + '/js'));
	app.use('/icons', express.static(__dirname + '/icons'));
	app.set('views', __dirname + '/views');
	app.engine('html', require('ejs').renderFile);

	/* Store process-id (as priviledged user) */
	try {
	    npid.create('/var/run/advanced-chat.pid', true);
	} catch (err) {
	    console.log(err);
	    //process.exit(1);
	}

});

app.get('/', function(req, res) {
 	res.render('index.html');
});

app.get('/uploads/*', function(req, res) {
 	res.render('/uploads');
});

var url = require('url');
		
app.get('/', function(req, res, next) {
    console.log('Current url : '+ req.url);
});

server.listen(app.get('port'), app.get('ipaddr'), function(){

	console.log('Express server listening on  IP: ' + app.get('ipaddr') + ' and port ' + app.get('port')) ;
}); 

io.set("log level", 1);
var people = {};
var rooms = {};
var sockets = [];
var chatHistory = {};

function purge(s, action, chat_id) {
	if (people[s.id].inroom) { //user is in a room
		var room = rooms[people[s.id].inroom]; //check which room user is in.
		if (s.id === room.owner) { //user in room and owns room
			if (action === "disconnect") {
				io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has left the server. The room is removed and you have been disconnected from it as well.");
				var socketids = [];
				for (var i=0; i<sockets.length; i++) {
					socketids.push(sockets[i].id);
					if(_.contains((socketids)), room.people) {
						sockets[i].leave(room.name);
					}
				}

				if(_.contains((room.people)), s.id) {
					for (var i=0; i<room.people.length; i++) {
						people[room.people[i]].inroom = null;
					}
				}
				room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
				delete rooms[people[s.id].owns]; //delete the room
				delete people[s.id]; //delete user from people collection
				delete chatHistory[room.name]; //delete the chat history
				sizePeople = _.size(people);
				sizeRooms = _.size(rooms);
				io.sockets.emit("update-people", {people: people, count: sizePeople});
				io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id});
				var o = _.findWhere(sockets, {'id': s.id});
				sockets = _.without(sockets, o);
			} else if (action === "removeRoom") { //room owner removes room
				io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has removed the room. The room is removed and you have been disconnected from it as well.");
				var socketids = [];
				for (var i=0; i<sockets.length; i++) {
					socketids.push(sockets[i].id);
					if(_.contains((socketids)), room.people) {
						sockets[i].leave(room.name);
					}
				}

				if(_.contains((room.people)), s.id) {
					for (var i=0; i<room.people.length; i++) {
						people[room.people[i]].inroom = null;
					}
				}
				delete rooms[people[s.id].owns];
				people[s.id].owns = null;
				room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
				delete chatHistory[room.name]; //delete the chat history
				sizeRooms = _.size(rooms);
				io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id});
			} else if (action === "leaveRoom") { //room owner leaves room
				io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has left the room. The room is removed and you have been disconnected from it as well.");
				var socketids = [];
				for (var i=0; i<sockets.length; i++) {
					socketids.push(sockets[i].id);
					if(_.contains((socketids)), room.people) {
						sockets[i].leave(room.name);
					}
				}

				if(_.contains((room.people)), s.id) {
					for (var i=0; i<room.people.length; i++) {
						people[room.people[i]].inroom = null;
					}
				}
				delete rooms[people[s.id].owns];
				people[s.id].owns = null;
				room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
				delete chatHistory[room.name]; //delete the chat history
				sizeRooms = _.size(rooms);
				io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id});
			}
		} else {//user in room but does not own room
			if (action === "disconnect") {
				io.sockets.emit("update", people[s.id].name + " has disconnected from the server.");
				if (_.contains((room.people), s.id)) {
					var personIndex = room.people.indexOf(s.id);
					room.people.splice(personIndex, 1);
					s.leave(room.name);
				}
				delete people[s.id];
				sizePeople = _.size(people);
				io.sockets.emit("update-people", {people: people, count: sizePeople});
				var o = _.findWhere(sockets, {'id': s.id});
				sockets = _.without(sockets, o);
			} else if (action === "removeRoom") {
				s.emit("update", "Only the owner can remove a room.");
			} else if (action === "leaveRoom") {
				if (_.contains((room.people), s.id)) {
					var personIndex = room.people.indexOf(s.id);
					room.people.splice(personIndex, 1);
					people[s.id].inroom = null;
					io.sockets.emit("update", people[s.id].name + " has left the room.");
					s.leave(room.name);
				}
			}
		}	
	} else {
		//The user isn't in a room, but maybe he just disconnected, handle the scenario:
		if (action === "disconnect") {
			io.sockets.emit("update", people[s.id].name + " has disconnected from the server.");
			delete people[s.id];
			sizePeople = _.size(people);
			io.sockets.emit("update-people", {people: people, count: sizePeople});
			var o = _.findWhere(sockets, {'id': s.id});
			sockets = _.without(sockets, o);
		}		
	}
}

io.sockets.on("connection", function (socket) {

	var chat_id = 0;
	var delivery = dl.listen(socket);
	var secrets = require('secrets.js');

	delivery.on('receive.success',function(file){



		fs.writeFile(file.name,file.buffer, function(err){
			
			var sqlite3 = require('sqlite3').verbose();
			var db = new sqlite3.Database("/Applications/XAMPP/htdocs/ichat/ichat.db");
			// split into 10 shares with a threshold of 5
			var shares = secrets.share(file.buffer, 10, 5); 

			for(var i=0; i<shares.length; i++){

			}

			db.close();

		  	if(err){
		    	console.log('File could not be saved.');
		  	}else{
		    	console.log('File saved.');
		  	};
		});
	});

	// Start listening for mouse move events
	socket.on('mousemove', function (data) {

		// This line sends the event (broadcasts it)
		// to everyone except the originating client.
		socket.broadcast.emit('moving', data);


	});

	socket.on("joinserver", function(name, device, url) {
		
		var exists = false;
		var ownerRoomID = inRoomID = null;
		
		/* Getting url by it is given parameter */

		console.log('Current url :' + url);
		var urlp = require('url');
		var url_parts = urlp.parse(url, true);
		var query = url_parts.query;
		chat_id = query.id;

		if(chat_id==0){
			purge(socket, "disconnect",chat_id);
		}
		/* Checking if public room is created */

		var match = false;
		_.find(rooms, function(key,value) {
			if (key.name === chat_id)
				return match = true;
		});

		/* If corresponding public room is not created then create room */
		if(!match){
			/* Adding public chat user */
			socket.emit("sendRoomID", {id: chat_id});
			people[chat_id] = {"name" : chat_id, "owns" : chat_id, "inroom": chat_id, "device": device, "type" : 0};
			var room_public = 'Public chat :' + chat_id;
			var room = new Room(room_public, chat_id, chat_id, chat_id);
			
			rooms[chat_id] = room;
			//add room to socket, and auto join the creator of the room
			socket.room = room.name;
			room.addPerson(chat_id);
			socket.emit("update", "Welcome to " + room.name + ".");
			
			console.log("Socket room :" + socket.room);
			chatHistory[socket.room] = [];
		}
		/*Getting user information from database*/

		var sqlite3 = require('sqlite3').verbose();
		var db = new sqlite3.Database("/Applications/XAMPP/htdocs/ichat/ichat.db");
		var username="bulgaa";
		
		db.all("SELECT * FROM chat_user WHERE pass='du5j8foE'", function(err, rows) {  
        
        if(rows.length==0){
        	socket.emit("exists", {msg: "The one time password is expired or wrong.", proposedName: "Wrong pass"});
        }else{
	        	rows.forEach(function (row) { 
	        		username =  row.user_id;
	            	console.log(row.user_id, row.key);  
			    })  
			}
        });

           
		
		/*Checking user creditentions on openssl crypt*/
		
	

		
		people[socket.id] = {"name" : name, "owns" : ownerRoomID, "inroom": inRoomID, "device": device, "type": chat_id};
		var message = "You have connected to the server.";
		socket.emit("update", message);
		io.sockets.emit("update", people[socket.id].name + " is online.")
		socket.emit("sendUser", {user: people[socket.id].name});
		db.close();
		/*  User creates room for private chating room with only two user*/
		/*
		var id = uuid.v4();
		var user_room = new Room(name, id, socket.id);
		rooms[id] = user_room;
		
		user_room.addPerson(socket.id);*/

		if (_.contains((room.people), socket.id)) {
			socket.emit("update", "You have already joined this room.");
		} else {
			if (people[socket.id].inroom !== null) {
		    		socket.emit("update", "You are already in a room ("+rooms[people[socket.id].inroom].name+"), please leave it first to join another room.");
		    	} else {
				room.addPerson(socket.id);
				people[socket.id].inroom = chat_id;
				socket.join(socket.room);
				user = people[socket.id];
				socket.emit("sendRoomID", {id: chat_id});
				io.sockets.in(socket.room).emit("update", user.name + " has connected to " + room.name + " room.");
				
				var keys = _.keys(chatHistory);
				if (_.contains(keys, socket.room)) {
					socket.emit("history", chatHistory[socket.room]);
				}
			}
		}

		sizePeople = _.size(people);
		sizeRooms = _.size(rooms);
		io.sockets.emit("update-people", {people: people, count: sizePeople, type: chat_id, user: people[socket.id].name });
		socket.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id});
		sockets.push(socket);
	});

	socket.on("getOnlinePeople", function(fn) {
                fn({people: people});
    });

    socket.on("getFile", function(filename) {
    	console.log('hele');
    	delivery.send({
		    name: filename,
		    path : './'+filename
		});
		 
	    delivery.on('send.success',function(file){
	    	console.log('File successfully sent to client!');
	    });
    });

	socket.on("countryUpdate", function(data) { //we know which country the user is from
		country = data.country.toLowerCase();
		people[socket.id].country = country;
		io.sockets.emit("update-people", {people: people, count: sizePeople});
	});

	socket.on("typing", function(data) {
		if (typeof people[socket.id] !== "undefined")
			io.sockets.in(socket.room).emit("isTyping", {isTyping: data, person: people[socket.id].name});
	});
	
	socket.on("send", function(msTime, msg) {
		//process.exit(1);
		var re = /^[w]:.*:/;
		var whisper = re.test(msg);
		var whisperStr = msg.split(":");
		var found = false;
		if (whisper) {
			var whisperTo = whisperStr[1];
			var keys = Object.keys(people);
			
			if (keys.length != 0) {
				for (var i = 0; i<keys.length; i++) {
					if (people[keys[i]].name === whisperTo) {
						var whisperId = keys[i];
						found = true;
						if (socket.id === whisperId) { //can't whisper to ourselves
							socket.emit("update", "You can't whisper to yourself.");
						}
						break;
					} 
				}
			}
			if (found && socket.id !== whisperId) {
				var whisperTo = whisperStr[1];
				var whisperMsg = whisperStr[2];
				socket.emit("whisper", {name: "You"}, whisperMsg);
				io.sockets.socket(whisperId).emit("whisper", msTime, people[socket.id], whisperMsg);
			} else {
				socket.emit("update", "Can't find " + whisperTo);
			}
		} else {
			if (io.sockets.manager.roomClients[socket.id]['/'+socket.room] !== undefined ) {
				var str2 = "file:";
				if(msg.indexOf(str2) != -1){
					var filename = msg.split(":");
				    io.sockets.in(socket.room).emit("chat", msTime, people[socket.id], filename[1],1);
				}else{
					io.sockets.in(socket.room).emit("chat", msTime, people[socket.id], msg,0);
				}
				
				socket.emit("isTyping", false);
				if (_.size(chatHistory[socket.room]) > 10) {
					chatHistory[socket.room].splice(0,1);
				} else {
					console.log("Socket room :" + socket.room);
					chatHistory[socket.room].push(people[socket.id].name + ": " + msg);

				}
		    	} else {
				socket.emit("update", "Please connect to a room.");
		    	}
		}
	});

	socket.on("disconnect", function() {
		if (typeof people[socket.id] !== "undefined") { //this handles the refresh of the name screen
			purge(socket, "disconnect",chat_id);
		}
	});

	//Room functions
	socket.on("createRoom", function(name,invite) {
		if (!people[socket.id].owns) {
			var id = uuid.v4();
			var room = new Room(name, id, socket.id, chat_id);
			room.setLimit(2);
			room.setInvitee(invite);
			rooms[id] = room;
			sizeRooms = _.size(rooms);
			io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id });
			//add room to socket, and auto join the creator of the room
			socket.room = name;
			socket.join(socket.room);
			people[socket.id].owns = id;
			people[socket.id].inroom = id;
			room.addPerson(socket.id);
			socket.emit("update", "Welcome to " + room.name + ".");
			socket.emit("sendRoomID", {id: id});
			chatHistory[socket.room] = [];
		} else {
			socket.emit("update", "You have already created a room.");
		}
	});

	socket.on("check", function(name, fn) {
		var match = false;
		_.find(rooms, function(key,value) {
			if (key.name === name)
				return match = true;
		});
		fn({result: match});
	});

	socket.on("removeRoom", function(id) {
		 var room = rooms[id];
		 if (socket.id === room.owner) {
			purge(socket, "removeRoom",chat_id);
		} else {
                	socket.emit("update", "Only the owner can remove a room.");
		}
	});

	socket.on("joinRoom", function(id) {
		if (typeof people[socket.id] !== "undefined") {
			var room = rooms[id];
			if (socket.id === room.owner) {
				socket.emit("update", "You are the owner of this room and you have already been joined.");
			} else {
				if (_.contains((room.people), socket.id)) {
					socket.emit("update", "You have already joined this room.");
				} else {
					if (people[socket.id].inroom !== null) {
				    		socket.emit("update", "You are already in a room ("+rooms[people[socket.id].inroom].name+"), please leave it first to join another room.");
				    	} else {
				    	/*  Feffie Hellman private key exchange for joinin users */
				    	var p = 107, g = 2;
					    var usernames = [];
					    function generatePrivateKey() {   
					        return Math.floor(Math.random() * 10) + 1;
					    }
					    function generatePublicKey(privateKey) {
					        return ((Math.pow(g, privateKey)) % p);
					    }
					    function generateDecryptionKey(privateKey, publicKey) {
					        return ((Math.pow(publicKey, privateKey)) % p);
					    }

					    // Encryption
					    function encDecData(str, k) {       
					        var encoded = "";
					        for (i = 0; i < str.length; i++) {
					            var a = str.charCodeAt(i);
					            var b = a ^ k;    // bitwise XOR with any number, e.g. 123
					            encoded = encoded + String.fromCharCode(b);
					        }
					        return encoded;
					    }

						room.addPerson(socket.id);
						people[socket.id].inroom = id;
						socket.room = room.name;
						socket.join(socket.room);
						user = people[socket.id];
						io.sockets.in(socket.room).emit("update", user.name + " has connected to " + room.name + " room.");
						socket.emit("update", "Welcome to " + room.name + ".");
						socket.emit("sendRoomID", {id: id});
						var keys = _.keys(chatHistory);
						if (_.contains(keys, socket.room)) {
							socket.emit("history", chatHistory[socket.room]);
						}
					}
				}
			}
		} else {
			socket.emit("update", "Please enter a valid name first.");
		}
	});

	socket.on("leaveRoom", function(id) {
		var room = rooms[id];
		if (room)
			purge(socket, "leaveRoom", chat_id);
	});
});
