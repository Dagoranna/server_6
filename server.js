const WebSocket = require("ws");
const PORT = process.env.PORT || 80;
const wss = new WebSocket.Server({ port: PORT });

const clients = new Set();
const clientsData = new Map();

function polydice(dice) {
  return Math.floor(Math.random() * dice) + 1;
}

function wsSend(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(data);
  }
}

function sendToTeammates(messageJSON) {
  let currentGame = messageJSON.gameId;
  clients.forEach((client) => {
    let clientData = clientsData.get(client);
    if (clientData && clientData.gameId === currentGame) {
      wsSend(client, JSON.stringify(messageJSON));
    }
  });
}

function sendToTeammatesExceptMe(ws, messageJSON) {
  let currentGame = messageJSON.gameId;
  clients.forEach((client) => {
    let clientData = clientsData.get(client);
    if (clientData && clientData.gameId === currentGame && ws !== client) {
      wsSend(client, JSON.stringify(messageJSON));
    }
  });
}

function findGames() {
  let DMs = {};
  clients.forEach((client) => {
    let clientData = clientsData.get(client);
    if (clientData && clientData.user.userRole === "Master") {
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
  wsSend(ws, "connected");

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
    try {
      let messageJSON;
      try {
        messageJSON = JSON.parse(message);
      } catch (err) {
        console.log("error in parsing message: " + message);
        return;
      }

      let currentData = clientsData.get(ws);
      if (currentData) {
        currentData.gameId = messageJSON.gameId;
        clientsData.set(ws, currentData);
      } else {
        clientsData.set(ws, messageJSON);
      }
      let rollResults = [];
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
          wsSend(ws, "user data is set: " + message);
          if (messageJSON.user.userRole === "Gamer" && !messageJSON.gameId) {
            wsSend(ws, findGames());
          }

          break;
        case "choosemaster":
          wsSend(ws, JSON.stringify(messageJSON));
          break;
        case "polydice":
          if (messageJSON.sectionInfo.source === "polydice") {
            for (let i = 0; i < messageJSON.sectionInfo.rollNumbers; i++) {
              rollResults.push(
                polydice(messageJSON.sectionInfo.dice) +
                  messageJSON.sectionInfo.diceModifier
              );
            }
          } else if (messageJSON.sectionInfo.source === "charsheet") {
            rollResults[0] =
              polydice(20) + parseInt(messageJSON.sectionInfo.diceModifier);
          }
          messageJSON.rollResults = rollResults;
          sendToTeammates(messageJSON);
          break;
        case "chat":
          sendToTeammates(messageJSON);
          break;
        case "gameMap":
          sendToTeammatesExceptMe(ws, messageJSON);
          break;
        case "globalMap":
          sendToTeammatesExceptMe(ws, messageJSON);
          break;
        default:
          wsSend(ws, "unknown message type: " + message);
      }
    } catch (err) {
      console.error("Error handling message:", err);
    }
  });

  ws.on("close", () => {
    clearInterval(interval);
    clients.delete(ws);
  });
});
