import {
  addTrack,
  controlPlayback,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  serializePlayback,
  serializeQueue,
  serializeRoom,
  voteTrack,
} from "../services/roomService.js";

export function registerRoomHandlers(io, socket) {
  socket.on("room:create", (payload, acknowledge) => {
    const result = createRoom(socket.id, payload);
    if (!result.ok) {
      acknowledge?.(result);
      return;
    }

    const room = getRoom(result.room.code);
    moveSocketToRoom(io, socket, room.code);
    acknowledge?.({
      ...result,
      members: room.members,
      queue: serializeQueue(room, socket.id),
      playback: serializePlayback(room, socket.id),
    });
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
    acknowledge?.({
      ...result,
      members: room.members,
      queue: serializeQueue(room, socket.id),
      playback: serializePlayback(room, socket.id),
    });
    broadcastPresence(io, room.code);
  });

  socket.on("queue:add", (payload, acknowledge) => {
    const result = addTrack(socket.id, payload);
    if (!result.ok) {
      acknowledge?.(result);
      return;
    }

    acknowledge?.({ ok: true, track: result.track });
    broadcastQueue(io, result.roomCode);
  });

  socket.on("queue:vote", (payload, acknowledge) => {
    const result = voteTrack(socket.id, payload);
    if (!result.ok) {
      acknowledge?.(result);
      return;
    }

    acknowledge?.({ ok: true });
    broadcastQueue(io, result.roomCode);
  });

  socket.on("playback:control", (payload, acknowledge) => {
    const result = controlPlayback(socket.id, payload);
    if (!result.ok) {
      acknowledge?.(result);
      return;
    }

    acknowledge?.({ ok: true });
    broadcastPlayback(io, result.roomCode);
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
  for (const member of room.members) {
    io.to(member.id).emit("room:state", {
      room: serializeRoom(room),
      members: room.members,
      queue: serializeQueue(room, member.id),
      playback: serializePlayback(room, member.id),
    });
  }
}

function broadcastQueue(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;

  for (const member of room.members) {
    io.to(member.id).emit("queue:updated", { queue: serializeQueue(room, member.id) });
  }
}

function broadcastPlayback(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;

  for (const member of room.members) {
    io.to(member.id).emit("playback:updated", {
      playback: serializePlayback(room, member.id),
      queue: serializeQueue(room, member.id),
    });
  }
}
