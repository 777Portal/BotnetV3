// epic
const express = require('express'); 
const app = express(); 

const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');

const fs = require('fs');
const { getPackedSettings } = require('http2');

var accounts = ["exampleEmail@notreal.you"] // add ur accounts here ( Ew hardcoded :( ) 

// Function to get username by socketId
function getUsernameBySocketId(socketId) {
    const bot = bots.find(bot => bot.socketId === socketId);
    return bot ? bot.username : null;
}

// Function to get socketId by username
function getSocketIdByUsername(username) {
    const bot = bots.find(bot => bot.username === username);
    return bot ? bot.socketId : null;
}

const sockets = {};
const bots = [];
const viewers = [];

io.on('connection', (socket) => {
    sockets[socket.id] = socket;

    // Sending existing bots to a new user
    if (bots.length > 0) {
        console.log("Sending bots to new user");
        bots.forEach(bot => {
          socket.emit('bot', { socketId: bot.socketId, username: bot.username });
		  console.log("requesting pos update");
		  io.to(bot.socketId).emit('reqPosUpdate'); // requesting location data...
		});
}

// debug stuffz
socket.onAny((event, ...args) => {
	console.log(event, args);
});
	
// init defining what type and how

socket.on("reqEmail", () => {
	const randomIndex = Math.floor(Math.random() * accounts.length);
	const item = accounts[randomIndex];
	console.log(item)
	
	io.to(socket.id).emit("email", item);
});
	
socket.on("conn", (connInfo) => {
	
	if (connInfo.type === "WebViewer") return viewers.push(socket.id); // is viewer.
	
	// disconnect bot if its neither WebViewer or bot.
	else if (connInfo.type !== "bot") return io.sockets.sockets[socket.id].disconnect(); // why is bot undercase when WebViewer is uppercase?
	
	// would be bot.
	bots.push({ socketId: socket.id, username: connInfo.username, email: connInfo.email });
	  emailIndex = accounts.indexOf(connInfo.email)
	  accounts = accounts.splice(emailIndex, 1);
	
	io.emit("bot", { socketId: socket.id, username: connInfo.username, emailsLeft: accounts.length});
});

// web veiwer sending chat message to either all bots or specific.
socket.on('sendChat', (rawData) => {
	whoArray = rawData.forWhich // gets which bots to send to.
	message = rawData.message
	whoArray.forEach((username) => {
		socketId = getSocketIdByUsername(username)
		  io.to(socketId).emit("sendMsg", message); // sending to the specific socket
	})
})

// routing data from webviews to bots
socket.on("message", (data) => {
	const existingBot = bots.find(bot => bot.socketId === socket.id); // checking if bot's socket id is in the bot list
    if (existingBot) { 
		viewers.forEach(viewer => {
			io.to(viewer).emit("chatMsg", {username: getUsernameBySocketId(socket.id), message: data}); // sending data to all of the webviewers connected.
		})
	} else {
		console.log(`${socket.id} is attempting to send bot data as non bot - attempted to send chat message ${data.message}` )
	}
});

socket.on("move", (data) => {
	const existingBot = bots.find(bot => bot.socketId === socket.id);
    if (existingBot) {
		viewers.forEach(viewer => {
			io.to(viewer).emit("posUpdate", {username: getUsernameBySocketId(socket.id), x: data.x, y: data.y, z: data.z});
		})
	} else {
		console.log(`${socket.id} is attempting to send bot data as non bot - attempted to send pos update` )
	}
});

const socketStatus = {};

// Handling disconnection
socket.on('disconnecting', () => {
    socketStatus[socket.id] = 'disconnecting';
});

socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`);

    // Check if the socket is still disconnecting
    if (socketStatus[socket.id] === 'disconnecting') {
        if (bots.some(bot => bot.socketId === socket.id)) {
            const bot = bots.find(bot => bot.socketId === socket.id);
            io.emit('endBot', { socketId: bot.socketId, username: bot.username, reason: "the connection to the (website) disconnected." });
            bots.splice(bots.findIndex(bot => bot.socketId === socket.id), 1);
			accounts.push(bot.email)
        }

        if (viewers.includes(socket.id)) viewers.splice(viewers.indexOf(socket.id), 1);

        delete sockets[socket.id];

        delete socketStatus[socket.id];
    	}
	});
});

app.get('/', function(req, res) {
	// console.log(req)
	const filePath = path.join(__dirname, 'info.html'); // Create an absolute path to info.html aka WebViewer
	res.sendFile(filePath); // Send the file as a response
});

server.listen(8080);