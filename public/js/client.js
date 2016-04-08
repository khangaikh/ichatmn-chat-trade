/* HTML5 magic
- GeoLocation
- WebSpeech
*/

//WebSpeech API
var final_transcript = '';
var recognizing = false;
var last10messages = []; //to be populated later

if (!('webkitSpeechRecognition' in window)) {
  console.log("webkitSpeechRecognition is not available");
} else {
  var recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = function() {
    recognizing = true;
  };

  recognition.onresult = function(event) {
    var interim_transcript = '';
    for (var i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final_transcript += event.results[i][0].transcript;
        $('#msg').addClass("final");
        $('#msg').removeClass("interim");
      } else {
        interim_transcript += event.results[i][0].transcript;
        $("#msg").val(interim_transcript);
        $('#msg').addClass("interim");
        $('#msg').removeClass("final");
      }
    }
    $("#msg").val(final_transcript);
    };
  }

  function startButton(event) {
    if (recognizing) {
      recognition.stop();
      recognizing = false;
      $("#start_button").prop("value", "Record");
      return;
    }
    final_transcript = '';
    recognition.lang = "en-GB"
    recognition.start();
    $("#start_button").prop("value", "Recording ... Click to stop.");
    $("#msg").val();
  }
//end of WebSpeech

/*
Functions
*/
function toggleNameForm() {
   $("#login-screen").toggle();
}

function toggleChatWindow() {
  $("#main-chat-screen").toggle();
}

// Pad n to specified size by prepending a zeros
function zeroPad(num, size) {
  var s = num + "";
  while (s.length < size)
    s = "0" + s;
  return s;
}

// Format the time specified in ms from 1970 into local HH:MM:SS
function timeFormat(msTime) {
  var d = new Date(msTime);
  return zeroPad(d.getHours(), 2) + ":" +
    zeroPad(d.getMinutes(), 2) + ":" +
    zeroPad(d.getSeconds(), 2) + " ";
}

// Format the time specified in ms from 1970 into local HH:MM:SS
function hello(caller) {
  var d = new Date(msTime);
  return zeroPad(d.getHours(), 2) + ":" +
    zeroPad(d.getMinutes(), 2) + ":" +
    zeroPad(d.getSeconds(), 2) + " ";
}


$(document).ready(function() {

  var lock= new PatternLock('#patternHolder',{matrix:[5,5]});

  
  //setup "global" variables first
  var socket = io.connect("127.0.0.1:8081");
  var myRoomID = null;
  var curUser = null;
  $("#private_actions").hide();
  $("#uploadForm").hide();


  socket.on('connect', function(){

    var delivery = new Delivery(socket);
 
    delivery.on('delivery.connect',function(delivery){
      $("#upload[type=submit]").click(function(evt){
        var file = $("input[type=file]")[0].files[0];
        delivery.send(file);
        evt.preventDefault();
      });
    });
 
    delivery.on('send.success',function(fileUID){
      console.log("file was successfully sent." + fileUID.name);
      $('#uploadFile').modal('toggle');
      $("#msg").val("file:"+fileUID.name);
    });
  });
 

  $("form").submit(function(event) {
    event.preventDefault();
  });

  $("#conversation").bind("DOMSubtreeModified",function() {
    $("#conversation").animate({
        scrollTop: $("#conversation")[0].scrollHeight
      });
  });

  $("#main-chat-screen").hide();
  $("#errors").hide();
  $("#name").focus();
  $("#join").attr('disabled', 'disabled'); 
  
  if ($("#name").val() === "") {
    $("#join").attr('disabled', 'disabled');
  }

  //enter screen
  $("#login_trade").click(function() {

    var name = $("#locationpass").val();
    var interest = $("#interest").val();
  
    var myTableArray = [];

    $("#draw1 tr").each(function() {
        var arrayOfThisRow = [];
        var tableData = $(this).find('td');

        if (tableData.hasClass('highlighted')) {
            tableData.each(function() { arrayOfThisRow.push(1); });
        }else{
            tableData.each(function() { arrayOfThisRow.push(0); });
        }
        myTableArray.push(arrayOfThisRow);
    });

    var str = myTableArray.toString();

    var device = "desktop";
    if (navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) {
      device = "mobile";
    }

    if (name === "" || name.length < 2){
      $("#errors").empty();
      $("#errors").append("Please enter a correct password an key pair");
      $("#errors").show();
    } else {

      var url = window.location.href; 
      var stringUrl= url.toString();
      socket.emit("joinserver", name, device, url, interest, str);
      toggleNameForm();
      toggleChatWindow();
      $("#msg").focus();
     
    }
  });

  $("#name").keypress(function(e){
    var name = $("#name").val();
    if(name.length < 2) {
      $("#join").attr('disabled', 'disabled'); 
    } else {
      $("#errors").empty();
      $("#errors").hide();
      $("#join").removeAttr('disabled');
    }
  });

  //main chat screen
  $("#chatForm").submit(function() {
    var msg = $("#msg").val();
    if (msg !== "") {
      socket.emit("send", new Date().getTime(), msg);
      $("#msg").val("");
    }
  });

  //'is typing' message
  var typing = false;
  var timeout = undefined;

  function timeoutFunction() {
    typing = false;
    socket.emit("typing", false);
  }

  $("#msg").keypress(function(e){
    if (e.which !== 13) {
      if (typing === false && myRoomID !== null && $("#msg").is(":focus")) {
        typing = true;
        socket.emit("typing", true);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(timeoutFunction, 5000);
      }
    }
  });

  socket.on("isTyping", function(data) {
    if (data.isTyping) {
      if ($("#"+data.person+"").length === 0) {
        $("#updates").append("<li id='"+ data.person +"'><span class='text-muted'><small><i class='fa fa-keyboard-o'></i> " + data.person + " is typing.</small></li>");
        timeout = setTimeout(timeoutFunction, 5000);
      }
    } else {
      $("#"+data.person+"").remove();
    }
  });

  $("#showCreateRoom").click(function() {
    $("#createRoomForm").toggle();
  });
  $("#showCreateRoom").click(function() {
    $("#createRoomForm").toggle();
  });

  $("#createRoomBtn").click(function() {
    var roomExists = false;
    var roomName = $("#createRoomName").val();
    var invite = $("#users").val();
    socket.emit("check", roomName, function(data) {
      roomExists = data.result;
       if (roomExists) {
          $("#errors").empty();
          $("#errors").show();
          $("#errors").append("Room <i>" + roomName + "</i> already exists");
        } else {      
        if (roomName.length > 0) { //also check for roomname
          socket.emit("createRoom", roomName, invite);
          $("#errors").empty();
          $("#private_actions").show();
          $("#errors").hide();
          }
        }
    });
  });

  $("#createRoomBtn").click(function() {
      var a1 = $("#ans1").val();
      var a2 = $("#ans2").val();
      var a3 = $("#ans3").val();
      var interest = $("#interest").val();

      if(a1=="" || a2=="" || a3==""){
        alert("Please fill your answers");
        e.preventDefault();
        return;
    }else{
      socket.emit("check-question", intereset, a1, a2, a3, roomID);
      
    }
  });

  $("#requestFile").click(function() {
    alert(2);
    var url = window.location.href;
    socket.emit("checkPassword", 1,url);
    alert(3);
    
  });

  socket.on("getFile1", function(data) {
    var delivery = new Delivery(socket);

    delivery.on('receive.start',function(fileUID){
        console.log('receiving a file!');
    });
   
    delivery.on('receive.success',function(file){
        var params = file.params;
        if (file.isImage()) {
          $('img').attr('src', file.dataURL());
        };
    });
    console.log("File downloaded");
    
  });


  $("#rooms").on('click', '.joinRoomBtn', function() {
    var roomName = $(this).siblings("span").text();
    var roomID = $(this).attr("id");
    socket.emit("joinRoom", roomID);
  });

  $("#rooms").on('click', '.removeRoomBtn', function() {
    var roomName = $(this).siblings("span").text();
    var roomID = $(this).attr("id");
    socket.emit("removeRoom", roomID);
    $("#createRoom").show();
  }); 

  $("#leave").click(function() {
    var roomID = myRoomID;
    socket.emit("leaveRoom", roomID);
    $("#createRoom").show();
  });

  $("#people").on('click', '.whisper', function() {
    var name = $(this).siblings("span").text();
    $("#msg").val("w:"+name+":");
    $("#msg").focus();
  });

  $("#interest").on('change', function() {
    var val = $(this).val();
    if (val =="seller"){
      $("#uploadForm").show();
    }else{
       $("#uploadForm").hide();
    }
  });

//socket-y stuff
socket.on("exists", function(data) {
  $("#errors").empty();
  $("#errors").show();
  $("#errors").append(data.msg + " <strong>" + data.proposedName + "</strong>");
    toggleNameForm();
    toggleChatWindow();
});

socket.on("joined", function() {
  $("#errors").hide();
  if (navigator.geolocation) { //get lat lon of user
    navigator.geolocation.getCurrentPosition(positionSuccess, positionError, { enableHighAccuracy: true });
  } else {
    $("#errors").show();
    $("#errors").append("Your browser is ancient and it doesn't support GeoLocation.");
  }
  function positionError(e) {
    console.log(e);
  }

  function positionSuccess(position) {
    var lat = position.coords.latitude;
    var lon = position.coords.longitude;
    //consult the yahoo service
    $.ajax({
      type: "GET",
      url: "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20geo.placefinder%20where%20text%3D%22"+lat+"%2C"+lon+"%22%20and%20gflags%3D%22R%22&format=json",
      dataType: "json",
       success: function(data) {
        socket.emit("countryUpdate", {country: data.query.results.Result.countrycode});
      }
    });
  }
});

socket.on("history", function(data) {
  if (data.length !== 0) {
    $("#msgs").append("<li><strong><span class='text-warning'>Last 10 messages:</li>");
    $.each(data, function(data, msg) {
      $("#msgs").append("<li><span class='text-warning'>" + msg + "</span></li>");
    });
  } else {
    $("#msgs").append("<li><strong><span class='text-warning'>No past messages in this room.</li>");
  }
});

socket.on("update", function(msg) {
  $("#msgs").append("<li>" + msg + "</li>");
});

socket.on("update-people", function(data){
  //var peopleOnline = [];
  $("#people").empty();
  $("#users").empty();
  $('#people').append("<li class=\"list-group-item active\">People online <span class=\"badge\">"+data.count+"</span></li>");
  var type = data.type;
  var name = data.user;
  $.each(data.people, function(a, obj) {
    if(obj.type === type ){
      if (!("country" in obj)) {
        html = "";
      } else {
        html = "<img class=\"flag flag-"+obj.country+"\"/>";
      }
    
      $('#people').append("<li class=\"list-group-item\"><span>" + obj.name+'('+obj.device+')' + "</span> <i class=\"fa fa-"+obj.device+"\"></i> " + html + "</li>");
      

      
      //if(curUser != name){
        $('#users').append("<option value="+obj.name+"><span>" + obj.name + "</span></option>");  
     // }
        
    }
    //peopleOnline.push(obj.name);
  });

  /*var whisper = $("#whisper").prop('checked');
  if (whisper) {
    $("#msg").typeahead({
        local: peopleOnline
    }).each(function() {
       if ($(this).hasClass('input-lg'))
            $(this).prev('.tt-hint').addClass('hint-lg');
    });
  }*/
});
0
socket.on("chat", function(msTime, person, msg, file) {
  if(file==0){
    $("#msgs").append("<li><strong><span class='text-success'>" + timeFormat(msTime) + person.name + "</span></strong>: " + msg + "</li>");
  }else{
    $("#msgs").append("<li><strong><span class='text-success'>" + timeFormat(msTime) + person.name + "</span></strong>: <a href='#' class=\"getfiles\" onclick=' socket.emit('getFile','"+msg+"');'>"+msg+"</a></li>");
  }
  
  //clear typing field
   $("#"+person.name+"").remove();
   clearTimeout(timeout);
   timeout = setTimeout(timeoutFunction, 0);
});


socket.on("whisper", function(msTime, person, msg) {
  if (person.name === "You") {
    s = "private messaeged"
  } else {
    s = "private messaeged"
  }
  $("#msgs").append("<li><strong><span class='text-muted'>" + timeFormat(msTime) + person.name + "</span></strong> "+s+": " + msg + "</li>");
});

socket.on("roomList", function(data) {
  $("#rooms").text("");
  $("#rooms").append("<li class=\"list-group-item active\">List of rooms <span class=\"badge\">"+data.count+"</span></li>");
   if (!jQuery.isEmptyObject(data.rooms)) { 
    var type = data.type; 
    console.log("chat :"+ type);
    $.each(data.rooms, function(id, room) {
      if(room.chat == type){
        console.log("roomchat :"+ curUser);
        console.log("invitee :"+ room.invited);
        var html ="";
        if(room.invited == curUser ){
           var html = "$<h5>PAID</h5>";
        }
        $('#rooms').append("<li id="+id+" class=\"list-group-item\"><span>" + room.name + "</span> " + html + "</li>");
      }
      
    });
  } else {
    $("#rooms").append("<li class=\"list-group-item\">There are no rooms yet.</li>");
  }
});

socket.on("sendRoomID", function(data) {
  myRoomID = data.id;
});
socket.on("sendUser", function(data) {
  curUser = data.user;
});

socket.on("disconnect", function(){
  $("#msgs").append("<li><strong><span class='text-warning'>The server is not available</span></strong></li>");
  $("#msg").attr("disabled", "disabled");
  $("#send").attr("disabled", "disabled");
});

});
