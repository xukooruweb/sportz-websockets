import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

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
      if (socket.isAlive === false) return socket.terminate();
      socket.isAlive = false;
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
