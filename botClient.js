// wow.js
const mineflayer = require('mineflayer'),
	  io = require('socket.io-client'),
	  socket = io('http://localhost:8080'); // or use ur ip from ipconfig if forwarding is enabled on your network.

var lastX,
	lastZ

const config = {
	host: 'constantiam.net',
	port: 25565,
	interval: 1000 * 10 // cooldown between joining server too prevent joining too quickly
}

// socket stuff

socket.on('connect', () => {
	console.log('Connected to socket successfully');
	
	socket.emit("reqEmail", {type: "bot"}); // gets email from main websocket.
});

var email;

socket.on('email', (data) => {
	// Got email from main websocket.

	email = data // declaring var used when reconnectingss
	  console.log(`Recieved email: ${email}`)
	  spawnAndBind(email)
});

// mineflayer stuff
function spawnAndBind(email){
	console.log("")

	var bot = mineflayer.createBot({
		username: email,
		auth: 'microsoft',
		host: config.host,
		port: config.port,
		version: false
	})
	
	console.log(`Using ${email} as email.`)
	
	bot.on(event, function (...args){
		console.log(event, args);
	});

	bot.on('end', function(reason){
		console.log(email)
		socket.emit("endBot", {username: bot.username, reason: reason})
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
			if (bot) {
				bot.removeAllListeners(); // Remove all event listeners attached to the bot
				bot.end("noMoreWebsiteSocket"); // Cleanly ends the Minecraft bot connection
				bot = null; // Set the bot variable to null to discard the old bot instance
				console.log("Stopped bot")
			}
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
				socket.emit("posUpdate", { username: "error", x:"Cords", y:"Not", z:"found" });
			}
		});
		

		// mineflayerViewer(bot, { port: `300${bots.length}`, firstPerson: false })	
		bot.on('message', function(raw) {
			raw = raw.toString();
	
			socket.emit("chatMsg", {bot: bot.username, message: raw}) // sending message
			console.log(raw)
		})
		
	})

	bot.on('kicked', function(reason) {
		socket.emit("chatMsg", {bot: bot.username, message: reason})
		console.log("Kicked for ", reason);
		setTimeout(() => {
			spawnAndBind(email)
		}, 1000);
	});

	bot.on('spawn', () => console.log(bot.username))

	bot.on('error', (err) => console.log(err))
}

