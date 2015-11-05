function Room(name, id, owner, chat) {
  this.name = name;
  this.id = id;
  this.owner = owner;
  this.invited = "0";
  this.people = [];
  this.peopleLimit = 10;
  this.status = "available";
  this.private = false;
  this.chat = chat;
};

Room.prototype.addPerson = function(personID) {
  if (this.status === "available") {
    this.people.push(personID);
  }
};

Room.prototype.setLimit = function(limit) {
  if (this.status === "available") {
    this.peopleLimit = limit;
  }
};

Room.prototype.getLimit = function(limit) {
  if (this.status === "available") {
    return this.peopleLimit;
  }
};

Room.prototype.setInvitee = function(invite) {
  if (this.status === "available") {
    this.invited = invite;
  }
};

Room.prototype.getLimit = function(limit) {
  if (this.status === "available") {
    return this.peopleLimit;
  }
};

Room.prototype.getChat = function() {
  if (this.status === "available") {
    return this.chat;
  }
};

Room.prototype.removePerson = function(person) {
  var personIndex = -1;
  for(var i = 0; i < this.people.length; i++){
    if(this.people[i].id === person.id){
      personIndex = i;
      break;
    }
  }
  this.people.remove(personIndex);
};

Room.prototype.getPerson = function(personID) {
  var person = null;
  for(var i = 0; i < this.people.length; i++) {
    if(this.people[i].id == personID) {
      person = this.people[i];
      break;
    }
  }
  return person;
};

Room.prototype.isAvailable = function() {
  return this.available === "available";
};

Room.prototype.isPrivate = function() {
  return this.private;
};

module.exports = Room;
