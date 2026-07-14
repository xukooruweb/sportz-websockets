import { WebSocket, WebSocketServer } from "ws";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function brodcast(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;

    client.send(JSON.stringify(payload));
  }
}

export function attacheWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024, // 1MB
  });

  wss.on("connection", (socket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

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
      if (ws.isAlive === false) return socket.terminate();
      ws.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  function broadcastMatchCreated(match) {
    brodcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
