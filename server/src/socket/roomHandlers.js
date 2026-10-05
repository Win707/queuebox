import { createRoom, getRoom, joinRoom, leaveRoom, serializeRoom } from "../services/roomService.js";

export function registerRoomHandlers(io, socket) {
  socket.on("room:create", (payload, acknowledge) => {
    const result = createRoom(socket.id, payload);
    if (!result.ok) {
      acknowledge?.(result);
      return;
    }

    const room = getRoom(result.room.code);
    moveSocketToRoom(io, socket, room.code);
    acknowledge?.({ ...result, members: room.members });
    broadcastPresence(io, room.code);
  });

  socket.on("room:join", (payload, acknowledge) => {
    const result = joinRoom(socket.id, payload);
    if (!result.ok) {
      acknowledge?.(result);
      return;
    }

    const room = getRoom(result.room.code);
    moveSocketToRoom(io, socket, room.code);
    acknowledge?.({ ...result, members: room.members });
    broadcastPresence(io, room.code);
  });

  socket.on("disconnect", () => {
    const roomCode = leaveRoom(socket.id);
    if (roomCode) broadcastPresence(io, roomCode);
  });
}

function moveSocketToRoom(io, socket, roomCode) {
  const previousRooms = [...socket.rooms].filter((code) => code !== socket.id && code !== roomCode);
  for (const previousRoom of previousRooms) {
    socket.leave(previousRoom);
    broadcastPresence(io, previousRoom);
  }
  socket.join(roomCode);
}

function broadcastPresence(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;

  io.to(roomCode).emit("room:presence", {
    members: room.members,
    count: room.members.length,
  });
  io.to(roomCode).emit("room:state", {
    room: serializeRoom(room),
    members: room.members,
  });
}
