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
	app.set('port', process.env.OPENSHIFT_NODEJS_PORT || 8000);
  	app.set('ipaddr', process.env.OPENSHIFT_NODEJS_IP || "159.203.105.181");
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

var SPEKE = require('./node_modules/speke/index');

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
function similar(a,b) {
    var lengthA = a.length;
    var lengthB = b.length;
    var equivalency = 0;
    var minLength = (a.length > b.length) ? b.length : a.length;    
    var maxLength = (a.length < b.length) ? b.length : a.length;    
    for(var i = 0; i < minLength; i++) {
        if(a[i] == b[i]) {
            equivalency++;
        }
    }
    var weight = equivalency / maxLength;
    return parseInt(weight * 100);
}
io.sockets.on("connection", function (socket) {

	var chat_id = 0;
	var delivery = dl.listen(socket);
	var secrets = require('secrets.js');
	var StringDecoder = require('string_decoder').StringDecoder;
	var decoder = new StringDecoder('utf8');

	delivery.on('receive.success',function(file){
		var params = file.params;
		console.log("Room id 1: "+params);
		//When file is recieved
		fs.writeFile(file.name,file.buffer, function(err){
			
			var sqlite3 = require('sqlite3').verbose();
			var db = new sqlite3.Database("/opt/lampp/htdocs/ichatmn-web/ichat.db");
			
			//First encrypt config
			var crypto = require('crypto'),
			    algorithm = 'aes-256-ctr',
			    password = 'file.name';

			//Second 
			var decoder = new StringDecoder('utf8');
			var textChunk = decoder.write(file.buffer);
			var cipher = crypto.createCipher(algorithm,password)
  			var crypted = Buffer.concat([cipher.update(textChunk),cipher.final()]);

			// split into 10 shares with a threshold of 5
			var shares = secrets.share(crypted.toString(), 10, 5); 

			for(var i=0; i<shares.length; i++){
				/*db.run("INSERT INTO image_parts (image_id, content, share_no) VALUES (?,?,?)", {
			          1: file.name,
			          2: shares[i],
			          3: i
			      	});
			      	db.close();*/
			}

		//	db.close();

		  	if(err){
		    	console.log('File could not be saved.->');
		    	console.log(err);
		  	}else{
		    	console.log('File saved.');
		  	};
		});
	});
	
	
	
	// Start listening for mouse move events
	socket.on('mousemove', function (data) {
		socket.broadcast.emit('moving', data);
	});

	socket.on("joinserver", function(name, device, url, interest, str) {
		
		var exists = false;
		var authentication = true;
		var ownerRoomID = inRoomID = null;
		
		/* Getting url by it is given parameter */

		console.log('Current url :' + url);
		var urlp = require('url');
		var url_parts = urlp.parse(url, true);
		var query = url_parts.query;
		chat_id = query.id;
		console.log(chat_id);

		var requestData = {
            "public_key": chat_id,
            "pass": name,
            "solutions": 3
		}

		console.log("Connecting to KDS...");
   	 	var request = require("request");
   	 	request({
		    url: 'http://104.236.241.227/key_distribution/request_for_trade_login.php',
		    method: "POST",
		    json: true,
		    headers: {
		        "content-type": "application/json",
		    },
		    body: JSON.stringify(requestData)
			},function (error, response, body) {
	        if (!error) {
	            //console.log(body);
	            var sqlite3 = require('sqlite3').verbose();
				var db = new sqlite3.Database("/opt/lampp/htdocs/ichatmn-web/ichat.db");
				db.all("SELECT * FROM tickets WHERE public_key=?",chat_id, function(err, rows) {  
			        if(rows.length==0){
			        	socket.emit("exists", {msg: "The one time password is expired or wrong.", proposedName: "Wrong pass"});
			        	authentication = false;
			        	return;
			        }else{
			        	rows.forEach(function (row) { 
			        		if(interest=='Buyer'){
			        			console.log("Buyer checking in");
			        			if(row.buyer_key==name ){
			        				console.log("Here");
			        				console.log(similar(row.secret_draw_buyer,str));
			        				if(similar(row.secret_draw_buyer,str)>90){
			        					console.log("Buyer checking passed");
			        				}else{
			        					console.log("Buyer checking failed");
			        					console.log("KDS closed");
			        					socket.emit("exists", {msg: "Draw password is expired or wrong.", proposedName: "Wrong pass"});
			        					authentication = false;
			        				}

			        			}else{
			        				console.log("Buyer checking failed");
			        				console.log("KDS closed");
			        				socket.emit("exists", {msg: "The one time password is expired or wrong.", proposedName: "Wrong pass"});
			        				authentication = false;
			        			}
			        		}else{
			        			console.log("Seller checking in");
			        			if(row.seller_key==name){
			        				console.log("Seller checking passed");
			        			}else{
			        				console.log("Seller checking failed");
			        				console.log("KDS closed");
			        				socket.emit("exists", {msg: "The one time password is expired or wrong.", proposedName: "Wrong pass"});
			        				authentication = false;
			        			}
			        		}
			        		  
					    });  
					}
			    });
	        }
	        else {
	        	console.log("Failed to connect to KDS...");
	            console.log("error: " + error);
	            console.log("response.statusCode: " + response.statusCode);
	            console.log("response.statusText: " + response.statusText);
	            authentication = false;
	     	}
		});

		if (!authentication) {
			socket.emit("exists", {msg: "The one time password is expired or wrong.", proposedName: "Wrong pass"});
			return;
		}

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
			people[chat_id] = {"name" : chat_id, "owns" : chat_id, "inroom": chat_id, "device": interest, "type" : 0};
			var room_public = 'Trading chat :' + 'Buyer/Seller';
			var room = new Room(room_public, chat_id, chat_id, chat_id);
			
			rooms[chat_id] = room;
			//add room to socket, and auto join the creator of the room
			socket.room = room.name;
			room.addPerson(chat_id);
			socket.emit("update", "Welcome to " + room.name + ".");
			
			console.log("Socket room :" + socket.room);
			chatHistory[socket.room] = [];
		}
		

		
		people[socket.id] = {"name" : name, "owns" : ownerRoomID, "inroom": inRoomID, "device": interest, "type": chat_id};
		var message = "You have connected to the server.";
		socket.emit("update", message);
		io.sockets.emit("update", people[socket.id].name + " is online.")
		socket.emit("sendUser", {user: people[socket.id].name});
		
		/*  User creates room for private chating room with only two user*/
		/*
		var id = uuid.v4();
		var user_room = new Room(name, id, socket.id);
		rooms[id] = user_room;
		
		user_room.addPerson(socket.id);*/

		if (_.contains((room.people), socket.id)) {
			socket.emit("update", "You have already joined this room.");
		}else {
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


    socket.on('checkPassword', function(filename, url){
	  	console.log("File download begin");
	  	var urlp = require('url');
		var url_parts = urlp.parse(url, true);
		var query = url_parts.query;
		chat_id = query.id;
		var fileName;

	  	var delivery = dl.listen(socket);
	  	var sqlite3 = require('sqlite3').verbose();
		var db = new sqlite3.Database("/opt/lampp/htdocs/ichatmn-web/ichat.db");

	  	db.all("SELECT * FROM tickets WHERE public_key=?", chat_id, function(err, rows) {  
        
        if(rows.length==0){
        	socket.emit("exists", {msg: "The one time password is expired or wrong.", proposedName: "Wrong pass"});
        }else{
	        	rows.forEach(function (row) { 
	        		fileName =  row.secret_name; 
	        		console.log(fileName);
	        		var pathToFile = '/home/khangai/Desktop/ichatmn-chat/'+fileName;
				  	delivery.on('delivery.connect',function(delivery){

					    delivery.send({
					      name: fileName,
					      path : pathToFile
					    });

				    	delivery.on('send.success',function(file){
				      		console.log('File successfully sent to client!');
				    	});
			  		});
				  	socket.emit("getFile1",{foo:"bar"});
			    })  
			}
        });
	  	
	});

    socket.on("checkPassword1", function(filename, url) {
    	
    	console.log("File download start");
    	console.log('Current url :' + url);
		var urlp = require('url');
		var url_parts = urlp.parse(url, true);
		var query = url_parts.query;
		chat_id = query.id;
		var fileName;

		db.all("SELECT * FROM tickets WHERE public_key=?", chat_id, function(err, rows) {  
        
        if(rows.length==0){
        	socket.emit("exists", {msg: "The one time password is expired or wrong.", proposedName: "Wrong pass"});
        }else{
	        	rows.forEach(function (row) { 
	        		fileName =  row.secret_name; 
	        		console.log(fileName);
			    })  
			}
        });
		console.log("File sending");
		var pathToFile= 'localhost:3000/background.jpg';
		socket.emit("getFileDownload",pathToFile);
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
					var password = msg;
 
					// Prepares an object for both Alice and Bob, with a prime value set. 
					var alice = SPEKE.getSPEKE('modp5');
					var bob = SPEKE.getSPEKE('modp5');
					 
					// Initialize the generator, based on the password, as well as create the 
					// public and private keys. 
					alice.generateKeys(password);
					bob.generateKeys(password);
					 
					// Compute the shared secret, with Alice using Bob's public key, and Bob using 
					// Alice's public key. 
					var alice_secret = alice.computeSecret(bob.getPublicKey(), null, 'hex');
					var bob_secret = bob.computeSecret(alice.getPublicKey(), null, 'hex');
					console.log("Trade room msg in Deffie Hellman public key");
					console.log(alice.getPublicKey());
					console.log("Trade room msg in Deffie Hellman secret key");
					console.log(alice_secret);
					// We should now have the same shared secret. 
					console.log(alice_secret.length);
					if(alice_secret === bob_secret){
						io.sockets.in(socket.room).emit("chat", msTime, people[socket.id], msg,0);
					}
					
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

	socket.on("private_send", function(msTime, msg) {
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
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], filename[1], 1);
				}
				var str3 = "Notify to>";
				if(msg.indexOf(str3) != -1){
					var interest = msg.split(">");
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], interest[1], 2);
				}

				var str4 = "File upload<";
				if(msg.indexOf(str4) != -1){
					var fileupload = msg.split("<");
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], fileupload[1], 3);
				}

				var str5 = "Draw your secret key<";
				if(msg.indexOf(str5) != -1){
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], msg, 4);
				}

				var str6 = "localhost:3001?id=";
				if(msg.indexOf(str6) != -1){
				    io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], msg, 5);
				}

				else{
					io.sockets.in(socket.room).emit("private_chat", msTime, people[socket.id], msg, 0);
				}
				
				socket.emit("isTyping", false);
				if (_.size(chatHistory[socket.room]) > 10) {
					chatHistory[socket.room].splice(0,1);
				} else {
					console.log("Socket room :" + socket.room);
					chatHistory[socket.room].push(people[socket.id].name + ": " + msg);
				}
		    } 
		    else {
				socket.emit("private_update", "Please connect to a room.");
		    }
			
		}
	});

	socket.on("disconnect", function() {
		if (typeof people[socket.id] !== "undefined") { //this handles the refresh of the name screen
			purge(socket, "disconnect",chat_id);
		}
	});

	socket.on("save_key", function(curUser,roomID,dataURL) {

		var dataString = dataURL.split( "," )[ 1 ];
    	var buffer = new Buffer( dataString, 'base64');

		console.log("Image created");

		if(buffer.length<256){
			//Image is smaller than 256 bit alert draw agian
			socket.emit("private_update", "Please redraw bigger image to a set key.");
		}else{
			var sqlite3 = require('sqlite3').verbose();
			var db = new sqlite3.Database("/opt/lampp/htdocs/ichatmn-web/ichat.db");

			db.all("SELECT * FROM tickets", function(err, rows) {  
        
	        if(rows.length==0){
	        	socket.emit("exists", {msg: "The one time password is expired or wrong.", proposedName: "Wrong pass"});
	        }else{
		        	rows.forEach(function (row) { 
		        		if(row.room_id == roomID){ // ticket by room id
		        			var buyer_key = row.buyer_key;
		        			var seller_key = row.seller_key;
		        			var time = row.time;
		        			var minute = row.minute;
		        			//Since we are not checking redrawing we are not including this line
		        			//var encrypt_string = dataString +"*" + buyer_key +"*"+ seller_key +"*"+ time +"*"+minute;
		        			var encrypt_string = buyer_key +"*"+ seller_key +"*"+ time +"*"+minute;
		        			var encrypt_string_key = buyer_key +"*"+ seller_key;
		        			//Encryption with openssl with password of both users
							var crypto = require('crypto'),algorithm = 'aes-256-ctr',password = encrypt_string_key;
							var cipher = crypto.createCipheriv(algorithm, password);
							//Encrypted keys outpur would hexedeicmel 256 bit code
							var encrypted = cipher.update(encrypt_string, 'utf8', 'hex');
							encrypted += cipher.final('hex');
							console.log('Encrypted secret key: ', encrypted);
							console.log("Seller is setting up secret key"); 
							//Saving encrypted key
							db.run("UPDATE tickets SET secret_key =? WHERE room_id=?", {
					          1: encrypted,
					          2: roomID
					      	});
					      	db.close();
					      	socket.emit("update_private_msg", "Draw your secret key<");
		        		}
				    })  
				}
	        });
		socket.emit("update_private_msg", "Draw your secret key<");
			
		}
	});
	// Finishing set up process
	socket.on("finish", function(curUser,roomID) {
		//Clearing all private chat information
		//if (typeof people[socket.id] !== "undefined") { //this handles the refresh of the name screen
		//	purge(socket, "disconnect",chat_id);
			socket.emit("update_private_msg", "localhost:3001?id="+roomID+"");
		//}
	});

	//Room functions
	socket.on("createRoom", function(name,invite) {
		if (!people[socket.id].owns) {
			console.log(id + " is creating transfer");  
			var id = uuid.v4();
			var room = new Room(name, id, socket.id, chat_id);
			room.setLimit(2);
			room.setInvitee(invite);
			rooms[id] = room;
			sizeRooms = _.size(rooms);
			io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms, type: chat_id });
			//add room to socket, and auto join the creator of the room
			//socket.room = name;
			//socket.join(socket.room);
			people[socket.id].owns = id;
			people[socket.id].inroom = id;
			room.addPerson(socket.id);
			//socket.emit("update_private", "Welcome to " + room.name + ".");
			socket.emit("sendprivateRoomID", {id: id});
			chatHistory[socket.room] = [];
			console.log("Room created with id" + room); 
		} else {
			socket.emit("update", "You have already created a room.");
		}
	});

	//User save functions
	socket.on("save_user", function(interest, time, minute, pass, roomID, curUser) {
		var sqlite3 = require('sqlite3').verbose();
		var db = new sqlite3.Database("/opt/lampp/htdocs/ichatmn-web/ichat.db");
		if(interest == 1){
			console.log("Seller is setting up"); 
			db.run("INSERT INTO tickets (seller, room_id, time, minute, seller_key) VALUES (?,?,?,?,?)", {
	          1: curUser,
	          2: roomID,
	          3: time,
	          4: minute,
	          5: pass
	      	});
	      	db.close();
	      	socket.emit("update_private_msg", "Notify to>Buyer");
		}else{
			console.log("Buyer is setting up");
			db.run("INSERT INTO tickets (buyer, room_id, time, minute, buyer_key) VALUES (?,?,?,?,?)", {
	          1: curUser,
	          2: roomID,
	          3: time,
	          4: minute,
	          5: pass
	      	});
	      	db.close();
	      	socket.emit("update_private_msg", "Notify to>Seller");
		}
	
	});

	//User setting functions
	socket.on("set_user", function( pass, roomID, curUser, interest) {
		var sqlite3 = require('sqlite3').verbose();
		var db = new sqlite3.Database("/opt/lampp/htdocs/ichatmn-web/ichat.db");
		if(interest == 1){
			console.log("Seller is setting up"); 
			db.run("UPDATE tickets SET seller =?, seller_key =? WHERE room_id=?", {
	          1: curUser,
	          2: pass,
	          3: roomID
	      	});
	      	db.close();
	      	socket.emit("update_private_msg", "File upload<Seller");
		}else{
			console.log("Buyer is setting up");
			db.run("UPDATE tickets SET buyer =?, buyer_key =? WHERE room_id=?", {
	          1: curUser,
	          2: pass,
	          3: roomID
	      	});
	      	db.close();
	      	socket.emit("update_private_msg", "File upload<Seller");
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
					room.addPerson(socket.id);
					people[socket.id].inroom = id;
					//socket.room = room.name;
					//socket.join(socket.room);
					user = people[socket.id];
					io.sockets.in(socket.room).emit("update", user.name + " has connected to " + room.name + " room.");
					socket.emit("update_private", "Welcome to " + room.name + ".");
					socket.emit("sendprivateRoomID", {id: id});
					var keys = _.keys(chatHistory);
					if (_.contains(keys, socket.room)) {
						socket.emit("history", chatHistory[socket.room]);
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
