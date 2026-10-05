import { getTrackScore, sortQueueByScore } from "./queueScoring.js";

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
  const room = {
    code,
    name,
    hostId: socketId,
    members: [member],
    queue: [],
    playback: { track: null, positionSeconds: 0, isPlaying: false, updatedAt: Date.now() },
  };
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
  else {
    for (const track of room.queue) delete track.votes[socketId];
    room.queue = sortQueueByScore(room.queue);
  }
  return code;
}

export function getRoom(code) {
  return rooms.get(normalizeRoomCode(code)) || null;
}

export function serializeRoom(room) {
  return { code: room.code, name: room.name };
}

export function addTrack(socketId, payload = {}) {
  const roomCode = socketRooms.get(socketId);
  const room = roomCode ? rooms.get(roomCode) : null;
  if (!room) return { ok: false, error: "Join a room before adding a song." };

  const member = room.members.find((entry) => entry.id === socketId);
  const videoId = typeof payload.videoId === "string" ? payload.videoId.trim() : "";
  const title = cleanText(payload.title, 160);
  const channelTitle = cleanText(payload.channelTitle, 100);
  const thumbnail = typeof payload.thumbnail === "string" ? payload.thumbnail : "";
  const durationSeconds = Number(payload.durationSeconds);
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return { ok: false, error: "That YouTube video link is invalid." };
  }
  if (room.queue.some((track) => track.videoId === videoId) || room.playback.track?.videoId === videoId) {
    return { ok: false, error: "That song is already in the queue." };
  }
  if (!title || !channelTitle || !isYouTubeThumbnail(thumbnail)) {
    return { ok: false, error: "We couldn't add that song. Search for it again and retry." };
  }
  if (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 86_400) {
    return { ok: false, error: "That song has an invalid duration." };
  }

  const track = {
    videoId,
    title,
    channelTitle,
    thumbnail,
    durationSeconds,
    addedBy: member.nickname,
    votes: {},
  };
  room.queue.push(track);
  return { ok: true, roomCode, queue: serializeQueue(room, socketId), track: serializeTrack(track, socketId) };
}

export function voteTrack(socketId, payload = {}) {
  const roomCode = socketRooms.get(socketId);
  const room = roomCode ? rooms.get(roomCode) : null;
  if (!room) return { ok: false, error: "Join a room before voting." };

  const videoId = typeof payload.videoId === "string" ? payload.videoId.trim() : "";
  const vote = payload.vote;
  if (vote !== -1 && vote !== 0 && vote !== 1) {
    return { ok: false, error: "Choose an upvote or downvote." };
  }

  const track = room.queue.find((entry) => entry.videoId === videoId);
  if (!track) return { ok: false, error: "That song is no longer in the queue." };
  if (vote === 0) delete track.votes[socketId];
  else track.votes[socketId] = vote;

  room.queue = sortQueueByScore(room.queue);
  return { ok: true, roomCode, queue: serializeQueue(room, socketId) };
}

export function controlPlayback(socketId, payload = {}) {
  const roomCode = socketRooms.get(socketId);
  const room = roomCode ? rooms.get(roomCode) : null;
  if (!room) return { ok: false, error: "Join a room before controlling playback." };

  const member = room.members.find((entry) => entry.id === socketId);
  if (!member?.isHost) return { ok: false, error: "Only the room host can control playback." };

  const action = payload.action;
  if (!["play", "pause", "seek", "skip", "ended"].includes(action)) {
    return { ok: false, error: "That playback action isn't supported." };
  }

  const playback = room.playback;
  if (action === "play") {
    if (!playback.track) {
      playback.track = room.queue.shift() || null;
      playback.positionSeconds = 0;
    }
    if (!playback.track) return { ok: false, error: "Add a song to the queue before playing." };
    playback.isPlaying = true;
  } else if (action === "pause" || action === "seek") {
    if (!playback.track) return { ok: false, error: "There isn't a track playing yet." };
    if (!Number.isFinite(payload.positionSeconds) ||
        payload.positionSeconds < 0 ||
        payload.positionSeconds > playback.track.durationSeconds) {
      return { ok: false, error: "That playback position is invalid." };
    }
    playback.positionSeconds = payload.positionSeconds;
    if (action === "pause") playback.isPlaying = false;
  } else {
    if (!playback.track || (action === "ended" && !playback.isPlaying)) {
      return { ok: false, error: "There isn't a track to advance." };
    }
    playback.track = room.queue.shift() || null;
    playback.positionSeconds = 0;
    playback.isPlaying = action === "ended" || playback.isPlaying ? Boolean(playback.track) : false;
  }

  playback.updatedAt = Date.now();
  return {
    ok: true,
    roomCode,
    queue: serializeQueue(room, socketId),
    playback: serializePlayback(room, socketId),
  };
}

export function serializePlayback(room, socketId) {
  const playback = room.playback;
  const elapsedSeconds = playback.isPlaying
    ? Math.max(0, (Date.now() - playback.updatedAt) / 1000)
    : 0;
  const positionSeconds = playback.track
    ? Math.min(playback.track.durationSeconds, playback.positionSeconds + elapsedSeconds)
    : 0;

  return {
    track: playback.track ? serializeTrack(playback.track, socketId) : null,
    positionSeconds,
    isPlaying: playback.isPlaying,
    updatedAt: playback.updatedAt,
  };
}

export function serializeQueue(room, socketId) {
  return room.queue.map((track) => serializeTrack(track, socketId));
}

function serializeTrack(track, socketId) {
  return {
    videoId: track.videoId,
    title: track.title,
    channelTitle: track.channelTitle,
    thumbnail: track.thumbnail,
    durationSeconds: track.durationSeconds,
    addedBy: track.addedBy,
    score: getTrackScore(track),
    myVote: track.votes[socketId] || 0,
  };
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isYouTubeThumbnail(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "i.ytimg.com" || url.hostname === "img.youtube.com");
  } catch {
    return false;
  }
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
