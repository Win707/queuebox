import { io } from "socket.io-client";

export const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export const socket = io(serverUrl, {
  autoConnect: false,
});
