const WebSocket = require("ws");
const PORT = process.env.PORT || 80;
const wss = new WebSocket.Server({ port: PORT });

const clients = new Set();
const clientsData = new Map();

function polydice(dice) {
  return Math.floor(Math.random() * dice) + 1;
}

function sendToTeammates(messageJSON) {
  let currentGame = messageJSON.gameId;
  clients.forEach((client) => {
    let clientData = clientsData.get(client);
    if (clientData.gameId === currentGame) {
      client.send(JSON.stringify(messageJSON));
    }
  });
}

function sendToTeammatesExceptMe(ws, messageJSON) {
  let currentGame = messageJSON.gameId;
  clients.forEach((client) => {
    let clientData = clientsData.get(client);
    if (clientData.gameId === currentGame && ws !== client) {
      client.send(JSON.stringify(messageJSON));
    }
  });
}
/*
        {
          "gameId": someId,
          "user":
            {
            "userRole":"Gamer/Master",
            "userName":"SomeGamer",
            "userColor":"Lime",
            "userEmail": userEmail,
            },
          "sectionName":"connection"
        }
        */
function findGames() {
  let DMs = {};
  clients.forEach((client) => {
    let clientData = clientsData.get(client);
    if (clientData.user.userRole === "Master") {
      DMs[clientData.user.userEmail] = clientData.user.userName;
    }
  });
  let answer = {
    sectionName: "games",
    list: DMs,
  };
  return JSON.stringify(answer);
}

wss.on("connection", (ws) => {
  ws.send("connected");

  if (!clients.has(ws)) {
    clients.add(ws);
  }

  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  const interval = setInterval(() => {
    if (!ws.isAlive) {
      ws.terminate(); // Закрывает соединение
      return;
    }

    ws.isAlive = false;
    ws.ping();
  }, 30000);

  // ----------- message -------------
  ws.on("message", (message) => {
    const messageJSON = JSON.parse(message);
    let currentData = clientsData.get(ws);
    if (currentData) {
      currentData.gameId = messageJSON.gameId;
      clientsData.set(ws, currentData);
    } else {
      clientsData.set(ws, messageJSON);
    }
    switch (messageJSON.sectionName) {
      case "connection":
        //service message after connection
        /*
        {
          "gameId": someId,
          "user":
            {
            "userRole":"Gamer/Master",
            "userName":"SomeGamer",
            "userColor":"Lime",
            "userEmail": userEmail,
            },
          "sectionName":"connection"
        }
        */
        ws.send("user data is set: " + message);
        if (messageJSON.user.userRole === "Gamer" && !messageJSON.gameId) {
          ws.send(findGames());
        }

        break;
      case "choosemaster":
        ws.send(message);
        break;
      case "polydice":
        let rollResults = [];
        for (let i = 0; i < messageJSON.sectionInfo.rollNumbers; i++) {
          rollResults.push(
            polydice(messageJSON.sectionInfo.dice) +
              messageJSON.sectionInfo.diceModifier
          );
        }
        messageJSON.rollResults = rollResults;
        sendToTeammates(messageJSON);
        break;
      case "chat":
        let chatMessage = messageJSON.sectionInfo.chatMessage;
        sendToTeammates(messageJSON);
        break;
      case "gameMap":
        sendToTeammatesExceptMe(ws, messageJSON);
        break;
      case "globalMap":
        break;
      default:
        ws.send("unknown message type: " + message);
    }
  });

  ws.on("close", () => {
    clearInterval(interval);
    clients.delete(ws);
  });
});
