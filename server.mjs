import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import https from "node:https";
import fs from "node:fs";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const certPath = "cert.pem";
const keyPath = "key.pem";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const sanitizePayload = (payload) => {
  if (!payload || typeof payload !== "object") return null;

  const data = payload;
  const x = Number(data.x);
  const y = Number(data.y);
  const z = Number(data.z);
  const timestamp = Number(data.timestamp) || Date.now();
  const sensorId = typeof data.sensorId === "string" && data.sensorId.length > 0 ? data.sensorId.slice(0, 64) : "sensor-unknown";

  if (![x, y, z, timestamp].every(Number.isFinite)) return null;

  return {
    x: clamp(x, -100, 100),
    y: clamp(y, -100, 100),
    z: clamp(z, -100, 100),
    timestamp,
    sensorId,
  };
};

app.prepare().then(() => {
  const requestHandler = (req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  };

  const httpServer = fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? https.createServer(
        {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        },
        requestHandler
      )
    : createServer(requestHandler);

  const io = new Server(httpServer, {
    cors: {
      origin: dev ? "*" : process.env.ALLOWED_ORIGIN?.split(",") ?? [],
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 1e5,
  });

  io.on("connection", (socket) => {
    let lastPublishAt = 0;

    socket.on("vibration_data", (rawPayload) => {
      const now = Date.now();
      if (now - lastPublishAt < 25) return;
      lastPublishAt = now;

      const payload = sanitizePayload(rawPayload);
      if (!payload) return;

      io.emit("vibration_update", payload);
    });
  });

  httpServer
    .once("error", (error) => {
      console.error(error);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
