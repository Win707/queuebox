const rooms = new Map();
const socketRooms = new Map();
const avatarColors = ["#d5ec8a", "#f0b49c", "#c6b5e4", "#98c4d5", "#f2d27f", "#eaa8c8"];
const codeCharacters = "abcdefghjkmnpqrstuvwxyz23456789";

export function createRoom(socketId, payload = {}) {
  const nickname = cleanText(payload.nickname, 24);
  const name = cleanText(payload.roomName, 40);
  if (!nickname) return { ok: false, error: "Add your name before creating a room." };
  if (!name) return { ok: false, error: "Give your room a name to get started." };

  const code = generateRoomCode();
  const member = {
    id: socketId,
    nickname,
    color: avatarColors[Math.floor(Math.random() * avatarColors.length)],
    isHost: true,
  };
  leaveRoom(socketId);
  const room = { code, name, hostId: socketId, members: [member] };
  rooms.set(code, room);
  socketRooms.set(socketId, code);
  return { ok: true, room: serializeRoom(room), member };
}

export function joinRoom(socketId, payload = {}) {
  const nickname = cleanText(payload.nickname, 24);
  const code = normalizeRoomCode(payload.code);
  if (!nickname) return { ok: false, error: "Choose a name before joining the room." };
  if (!/^[a-z2-9]{6}$/.test(code)) return { ok: false, error: "That room code doesn't look right." };

  const room = rooms.get(code);
  if (!room) return { ok: false, error: "We couldn't find that room. Check the code and try again." };

  const previousRoomCode = socketRooms.get(socketId);
  if (previousRoomCode && previousRoomCode !== code) leaveRoom(socketId);
  const existingMember = room.members.find((member) => member.id === socketId);
  if (existingMember) {
    existingMember.nickname = nickname;
    socketRooms.set(socketId, code);
    return { ok: true, room: serializeRoom(room), member: existingMember };
  }

  const member = {
    id: socketId,
    nickname,
    color: avatarColors[Math.floor(Math.random() * avatarColors.length)],
    isHost: false,
  };
  room.members.push(member);
  socketRooms.set(socketId, code);
  return { ok: true, room: serializeRoom(room), member };
}

export function leaveRoom(socketId) {
  const code = socketRooms.get(socketId);
  if (!code) return null;

  socketRooms.delete(socketId);
  const room = rooms.get(code);
  if (!room) return code;

  room.members = room.members.filter((member) => member.id !== socketId);
  if (room.members.length === 0) rooms.delete(code);
  return code;
}

export function getRoom(code) {
  return rooms.get(normalizeRoomCode(code)) || null;
}

export function serializeRoom(room) {
  return { code: room.code, name: room.name };
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeRoomCode(code) {
  return typeof code === "string" ? code.trim().toLowerCase() : "";
}

function generateRoomCode() {
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => codeCharacters[Math.floor(Math.random() * codeCharacters.length)]).join("");
  } while (rooms.has(code));
  return code;
}
