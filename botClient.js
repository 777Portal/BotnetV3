// wow.js
const mineflayer = require('mineflayer'),
	  io = require('socket.io-client'),
	  socket = io('http://localhost:8080'); // or use ur ip from ipconfig if forwarding is enabled on your network.

var lastX,
	lastZ

const config = {
	host: '2b2t.org',
	port: 25565,
	interval: 1000 * 10 // cooldown between joining server too prevent joining too quickly
}

// socket stuff
socket.on('connect', () => {
	console.log('Connected to socket successfully');
	
	socket.emit("reqEmail", {type: "bot"}); // gets email from main websocket.
});

var email; // used later on for reconnecting when disconnected.

socket.on('email', (data) => { // got email from mainHost
	email = data
	  console.log(`Recieved email: ${email}`)
	  spawnAndBind(email)
});

var ready = false // checking if we can send data via websocket.

// mineflayer stuff
function spawnAndBind(email){

	var bot = mineflayer.createBot({
		username: email,
		auth: 'microsoft',
		host: config.host,
		port: config.port,
		version: false
	})

	console.log(`Using ${email} as email.`)
	
	socket.on('bot', (username) => {
		username = username.username
		if (username == bot.username) ready = true
	})
	
	bot.on('end', function(reason){
		console.log(email)
		setTimeout(() => {
			spawnAndBind(email)
		}, 1000);
	})

	bot.on('resourcePack', function () {
		bot.acceptResourcePack()
		console.log("resource pack accepted")
	})

	bot.once('login', function() {
		socket.emit("conn", {type: "bot", username: bot.username, email: email}); // says its da bot and provides username

		socket.on('sendMsg', (message) => {
			bot.chat(message)
		});

		socket.on('disconnect', () => {
			console.log('Disconnected from the (website) websocket.');
			
			if (!bot) return // checks if bot still exists.

			console.log("Stopped bot")
			bot.removeAllListeners(); // Eemoves all event listeners attached to the bot
			bot.end("noMoreWebsiteSocket"); // Cleanly ends the Minecraft bot connection
			bot = null; // Set the bot variable to null to discard the old bot instance
		});

		// ie Webveiwer thingy loads the page
		socket.on('reqPosUpdate', () => {
			
			console.log("Received request to send position to server...");
		
			if (bot && bot.entity && bot.entity.position && typeof bot.entity.position.x !== 'undefined') {
			  const { x, y, z } = bot.entity.position;
		
			  console.log(`Sending position update: ${x}, ${y}, ${z}`);
		
			  setTimeout(() => {
				socket.emit("posUpdate", { username: bot.username, x, y, z });
			  }, 1000 * 10); // Delayed emission after 1 second to hope the other thinggy is loaded
			} else {
			  console.log("Bot position data is not available or undefined.");
			  socket.emit("posUpdate", { x:"Cords", y:"Not", z:"Found" });
			}
		});		
	})

	bot.on('kicked', function(reason) {
		console.log("Kicked for ", reason);
		socket.emit("chatMsg", {bot: bot.username, message: reason})
		
		setTimeout(() => 
		{
			spawnAndBind(email)
		}, 1000);
	});

	bot.on('spawn', () => console.log(bot.username))

	bot.on('error', (err) => console.log(err))
	
	patchEmitter(bot)
}

function patchEmitter(emitter) {
  var oldEmit = emitter.emit;
  
  emitter.emit = function() {
	oldEmit.apply(emitter, arguments);		
	if (ready == false) return

	const emitArgs = arguments;
		
	eventName = (emitArgs && emitArgs[0]) ?? "UndefinedEventName"
	eventArguments = (emitArgs && emitArgs[1]) ?? false

	if (eventName == "newListener" || eventName == "removeListener" || eventName == "connect" || eventName == "physicTick" || eventName == "physicsTick") return // baddddd throws ERROR
	if (!eventArguments) return socket.emit(eventName) // no args 

	socket.emit(eventName, eventArguments); // yes args.
  }
}
