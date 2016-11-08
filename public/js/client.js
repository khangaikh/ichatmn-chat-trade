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

  var lock= new PatternLock('#patternHolder',
      {matrix:[5,5]
  });

  var ip_run = "192.168.10.107"
  //setup "global" variables first
  var socket = io.connect(ip_run+":8081");
  var myRoomID = null;
  var curUser = null;
  $("#private_actions").hide();
 
  socket.on('connect', function(){

    var delivery = new Delivery(socket);
 
    delivery.on('delivery.connect',function(delivery){
      $("#upload[type=submit]").click(function(evt){
        var file = $("#secretFile")[0].files[0];
        var privateRoomID = $("#me").val();

        var extraParams = {roomID: privateRoomID, type:1, msg: "Msg sent"};
        delivery.send(file,extraParams);
        evt.preventDefault();
        $('#getFileModal').modal('toggle');
        
      });

      $("#upload1[type=submit]").click(function(evt){
        var file = $("#decryptFile")[0].files[0];
        var privateRoomID = $("#me").val();
        var pass = $("#filePassword").val
        var extraParams = {roomID: privateRoomID, type:2, passkey: pass};
        delivery.send(file,extraParams);
        evt.preventDefault();
        $('#getFileModal2').modal('toggle');
        
      });

    });
 
    delivery.on('send.success',function(fileUID){
      console.log("file was successfully sent." + fileUID.name);
      $("#errors").hide();
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

    var interest = $("#interest").val();
    var pattern = lock.getPattern(); 

    var arr = pattern.split('-');
    var pass=arr[0];
    var temp =arr[0];
    console.log(pattern);
    console.log(arr);
    for(var i=0; i<arr.length; i++){
      if(arr[i]!=temp){
        temp=arr[i];
        pass = pass+''+temp;  
      }
    }


    console.log(pass);
    var device = "desktop";
    if (navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) {
      device = "mobile";
    }

    if (pass === "" || pass.length < 2){
      $("#errors").empty();
      $("#errors").append("Please enter a correct password an key pair");
      $("#errors").show();
    } else {

      var url = window.location.href; 
      var stringUrl= url.toString();
      socket.emit("joinserver", device, url, interest, pass);
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

  $("#login_question").click(function(e) {
    var ans1 = $("#ans1").val();
    var ans2 = $("#ans2").val();
    var ans3 = $("#ans3").val();
    var interest = $("#interest").val();

    if(ans1 =="" || ans2 =="" || ans3==""){
      alert("Please answer all the questions");
       e.preventDefault();
      return;
    }
    var url = window.location.href; 
    var stringUrl= url.toString();
    socket.emit("check_question", interest, ans1, ans2, ans3, url);
  });

  $("#showCreateRoom").click(function() {
    $("#createRoomForm").toggle();
  });

  $("#createRoomBtn").click(function() {
    var roomExists = false;
    var roomName = $("#createRoomName").val();
    var invite = "Seller";
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
          $("#errors").hide();
          }
        }
    });
  });

  $("#requestSecretKey").click(function() {
    
    var host1 = $("#host1").val();
    var host2 = $("#host2").val();
    var host3 = $("#host3").val();
    var key1 = $("#key1").val();
    var key2 = $("#key2").val();
    var key3 = $("#key3").val();
    
    if(host1 =="" || host2 =="" || host3 =="" || key1 =="" || key2 =="" || key3 == ""){
      alert("Please enter your id secret key ip addresses");
      return;
    }    

    var server1  = {ip: host1, key:key1};
    var server2  = {ip: host2, key:key2};
    var server3  = {ip: host3, key:key3};
   var url = window.location.href;  

    socket.emit("checkPassword", server1,server2,server3, url);

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

  $('#refresh').click(function() {
    location.reload();
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
  });

  //socket-y stuff
  socket.on("exists", function(data) {
    $("#errors").empty();
    $("#errors").show();
    $("#errors").append(data.msg + " <strong>" + data.proposedName + "</strong>");
    return;
  });

  socket.on("show_seller_actions", function(data) {
    console.log(data);
    $("#seller_actions").show();    
  });

  socket.on("show_buyer_actions", function(data) {
    console.log(data);
    $("#buyer_actions").show();    
    $("#buyerWindow").show();
  });
  
  socket.on("next", function(image) {
    console.log(image);
    
    $("#interest").hide();
    $("#questions").hide();
    $("#login_question").hide();
    
    $("#secret-draw").show();
    $("#login_trade").show();
    $("#clearing").show();

    $("#patternHolder").css('background', 'url(' + image.image + ')');  
    $("#patternHolder").css('background-size', 'contain');  
  });

  socket.on("hide", function(msg) {
    alert(msg);
    $("#errors").hide();
  });

  socket.on("setKey", function(msg) {
    $("#errors").hide();
    $("#buyer_step2").empty();
    $("#buyer_step2").append("<p><strong>Step 2: </strong>Please copy your key :"+msg+"</p>");
  });

  socket.on("seyDocBack", function(msg) {
    $("#errors").hide();
    $("#buyer_step3").empty();
    $("#buyer_step3").append("<p><strong>Step 3: </strong></strong>Please download your encrypted file :<a href='http://"+ip_run+"/ichatmn-web/"+msg+"' download='proposed_file_name'>Download now</a></p>");
  });

  $("#clearing").click(function() {
    lock.reset();
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
    var buyer = data.buyer;
    
    $("#me").val(type);

    if(buyer == 1){
        $("#buyer_step1").append("<p><strong>Step 1: </strong>Please download your encrypted file :<a href='http://"+ip_run+"/ichatmn-web/upload/"+type+"/file.pub' download='proposed_file_name'>Download now</a></p>")
    }

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
    $("#rooms").append("<li class=\"list-group-item active\">Trade room information <span class=\"badge\">"+data.count+"</span></li>");
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
             $('#rooms').append("<li id="+id+" class=\"list-group-item\"><span>" + room.name + "-" + html + "</span></li>");
          }
          
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
