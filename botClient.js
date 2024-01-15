// wow.js
const mineflayer = require('mineflayer'),
	  io = require('socket.io-client'),
	  socket = io('http://localhost:8080'); // or use ur ip from ipconfig if forwarding is enabled on your network.

const config = {
	host: '2b2t.org', // server to join
	port: 25565,
	interval: 1000 * 10 // cooldown between joining server too prevent joining too quickly
}

// socket stuff
socket.on('connect', () => {
	console.log('Connected to socket successfully');
	
	socket.emit("reqEmail", {type: "bot"}); // gets email from main websocket.
});

var email, // used later on for reconnecting when disconnected.
	ready = false; // checking if we can send data via websocket to avoid accidently alerting bad packets.

socket.on('email', (data) => { // got email from mainHost
	console.log(`Recieved email: ${data}`)
	
	email = data // used later for reconnecting
	spawnAndBind(email)
});

socket.on('ready', () => {
	console.log('Is ready')
	ready = true // can send packets to websocket
})

// mineflayer stuff
function spawnAndBind(email){
	console.log(`using ${email}`)
	
	var bot = mineflayer.createBot({
		username: email,
		auth: 'microsoft',
		host: config.host,
		port: config.port
	})
	
	
	bot.on('end', function(reason){
		console.log(email)
		setTimeout(() => { spawnAndBind(email) }, config.interval);
	})

	bot.on('resourcePack', function () {
		bot.acceptResourcePack()
		console.log("resource pack accepted")
	})

	
	bot.once('login', async function() {
		console.log('logged in')

		checkIfCanSendUsername()

		function checkIfCanSendUsername(){
			// checks if player char has spawned
			if (bot && typeof bot.username !== undefined) return socket.emit("conn", {type: "bot", username: bot.username, email: email}); // says its da bot and provides username

			// bot username is undef.
			setTimeout(() => {
				checkIfCanSendUsername()
			}, 1000);

		}

		socket.on('sendMsg', (message) => { bot.chat(message) });

		socket.on('disconnect', () => {
			console.log('Disconnected from the (website) websocket.');
			ready = false

			if (!bot) return // checks if bot still exists.

			console.log("Stopped bot")
			bot.removeAllListeners(); // Eemoves all event listeners attached to the bot
			bot.end("noMoreWebsiteSocket"); // Cleanly ends the Minecraft bot connection
			bot = null; // Set the bot variable to null to discard the old bot instance
		});
	})

	bot.on('kicked', function(reason) {
		console.log("Kicked for ", reason);
		
		setTimeout(() => { spawnAndBind(email) }, config.interval);
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