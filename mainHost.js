// epic
const express = require('express'); 
const app = express(); 

const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');

const fs = require('fs');
const { getPackedSettings } = require('http2');

var accounts = ["socooirafa12345@gmail.com"] // add ur accounts here ( Ew hardcoded :( ) 

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

async function checkIfSocketIsBot(socketId){
	const existingBot = await bots.find(bot => bot.socketId === socketId); // checking if bot's socket id is in the bot list
	
	if (existingBot) return true // if bot exists return true
	
	return false // else return false
}

const sockets = {};
const bots = [];
const viewers = [];

io.on('connection', (socket) => {

// start of client interactions

sockets[socket.id] = socket;
	
// Sending existing bots to a new user
if (bots.length > 0) {
    console.log("Sending bots to new user");
    bots.forEach(bot => {
		socket.emit('bot', { socketId: bot.socketId, username: bot.username });
		console.log("requesting pos update");
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
	else if (connInfo.type !== "bot") return // not bot nor the other one
	
	// would be bot.
	bots.push({ socketId: socket.id, username: connInfo.username, email: connInfo.email });
	  emailIndex = accounts.indexOf(connInfo.email)
	  accounts = accounts.splice(emailIndex, 1);
	
	if (accounts.length == 1) accounts = []
	

	io.emit("bot", { socketId: socket.id, username: connInfo.username, emailsLeft: accounts.length}); // notifying clients that a new bot appeared
	io.to(socket.id).emit('ready'); // telling the bot its okay to send data
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
socket.on("message", async (data) => {
	isBot = await checkIfSocketIsBot(socket.id)
	if (!isBot) return console.log( `${socket.id} is attempting to send bot data as non bot - attempted to send chat message ${data.message}` )
	
	viewers.forEach(viewer => {
		io.to(viewer).emit("chatMsg", {username: getUsernameBySocketId(socket.id), message: data}); // sending data to all of the webviewers connected.
	})
});

socket.on("move", async (data) => {
	isBot = await checkIfSocketIsBot(socket.id)    

	// isn't bot
	if (!isBot) return console.log(`${socket.id} is attempting to send bot data as non bot - attempted to send pos update` )
	
	// is bot
	viewers.forEach(viewer => {
		io.to(viewer).emit("posUpdate", {username: getUsernameBySocketId(socket.id), x: data.x, y: data.y, z: data.z});
	})
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

// end of client interactions


app.get('/', function(req, res) {
	// console.log(req)
	const filePath = path.join(__dirname, 'info.html'); // Create an absolute path to info.html aka WebViewer
	res.sendFile(filePath); // Send the file as a response
});

server.listen(8080);