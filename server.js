const WebSocket = require("ws");
const PORT = process.env.PORT || 80;
const wss = new WebSocket.Server({ port: PORT });

const clients = new Set();
const clientsData = new Map();

wss.on("connection", (ws) => {
  ws.send("connected");
  clients.add(ws);
  wss.clients.forEach(function each(client) {
    client.send('new client added. ' + wss.clients.size + ' active connections');
  }); 

  const interval = setInterval(() => {
    ws.ping(); 
  }, 30000);  

  ws.on("message", (message) => {
    clientsData.set(ws,JSON.parse(message));
    ws.send(message + " returned");
  });
  

  ws.on("close", () => {
    //console.log("Client disconnected.");
    clearInterval(interval);
  });
});
