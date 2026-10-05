import "./config.js";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { registerRoomHandlers } from "./socket/roomHandlers.js";

const port = Number(process.env.PORT) || 3001;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: clientOrigin.split(",").map((origin) => origin.trim()),
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  registerRoomHandlers(io, socket);
});

httpServer.listen(port, () => {
  console.log(`Queuebox server listening on port ${port}`);
});
