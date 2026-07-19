import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  } 
}

function cleanupSubscriptions(socket) {
  for (const [matchId, subscribers] of matchSubscribers.entries()) {
    if (subscribers.has(socket)) {
      subscribers.delete(socket);
      if (subscribers.size === 0) {
        matchSubscribers.delete(matchId);
      }
    }
  }
}


function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  
  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    
    client.send(JSON.stringify(payload));
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);

  for (const socket of subscribers) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  }
}

function handleMessage(socket, data) {
  // Handle incoming messages
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    sendJson(socket, { type: "error", message: "Invalid JSON format" });
  }

  if ( message?.type === "subscribe" && Number.isInteger(message?.matchId) ) {
    subscribe(message.matchId, socket);
    socket.subscribedMatchId = message.matchId;
    sendJson(socket, {
      type: "subscribed",
      matchId: message.matchId,
      message: `Subscribed to match ${message.matchId}`,
    });
  }

  if ( message?.type === "unsubscribe" && Number.isInteger(message?.matchId) ) {
    unsubscribe(message.matchId, socket);
    socket.subscribscriptions.delete(message.matchId);
    sendJson(socket, {
      type: "unsubscribed",
      matchId: message.matchId,
      message: `Unsubscribed from match ${message.matchId}`,
    });
  }
}

export function attacheWebSocketServer(server) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024, // 1MB
  });

  server.on("upgrade", async (req, socket, head) => {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

    if (pathname !== "/ws") {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          const status = decision.reason.isRateLimit() ? 429 : 403;
          const message = decision.reason.isRateLimit()
            ? "Too many requests."
            : "Forbidden.";

          socket.write(
            `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`,
          );
          socket.destroy();
          return;
        }
      } catch (error) {
        console.error("WS Upgrade error:", error);
        socket.write(
          "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n",
        );
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket, req) => {
    socket.isAlive = true;
    socket.on("pong", () => { socket.isAlive = true;});

    socket.subscriptions = new Set();
    socket.on("message", (data) => handleMessage(socket, data));
    socket.on( "error", (error) => {
      socket.terminate();
      console.error("WebSocket error:", error);
    });
    socket.on("close", () => cleanupSubscriptions(socket));

    sendJson(socket, {
      type: "Welcome",
      message: "Welcome to the WebSocket server!",
    });

    socket.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (socket.isAlive === false) return socket.terminate();
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  function broadcastMatchCreated(match) {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentary(matchId, comment) {
    broadcastToMatch(matchId, {
      type: "commentary",
      data: comment
    });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
