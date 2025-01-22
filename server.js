const WebSocket = require("ws");
const PORT = process.env.PORT || 80;
const wss = new WebSocket.Server({ port: PORT });

wss.on("connection", (ws) => {
  ws.send("connected");

  const interval = setInterval(() => {
    ws.ping(); 
  }, 30000);  

  ws.on("message", (message) => {
    ws.send(message + " returned");
  });
  

  ws.on("close", () => {
    console.log("Client disconnected.");
    clearInterval(interval);
  });
});
