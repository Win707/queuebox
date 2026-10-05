import { useEffect, useState } from "react";
import { socket } from "../lib/socket.js";

export function useRoom(roomCode, initialNickname = "", initialMemberId = "") {
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [playback, setPlayback] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState(initialNickname);
  const [memberId, setMemberId] = useState(initialMemberId);

  useEffect(() => {
    let active = true;
    setStatus("connecting");
    setError("");

    const onConnectionError = () => {
      if (active) {
        setStatus("error");
        setError("We couldn't connect to the room server. Please try again.");
      }
    };
    const onRoomState = (state) => {
      if (!active) return;
      setRoom(state.room);
      setMembers(state.members);
      setQueue(state.queue || []);
      setPlayback(state.playback || null);
      setStatus("ready");
    };
    const onPresence = (presence) => {
      if (active) setMembers(presence.members);
    };
    const onQueueUpdate = (update) => {
      if (active) setQueue(update.queue);
    };
    const onPlaybackUpdate = (update) => {
      if (!active) return;
      setQueue(update.queue);
      setPlayback(update.playback);
    };

    socket.on("connect_error", onConnectionError);
    socket.on("room:state", onRoomState);
    socket.on("room:presence", onPresence);
    socket.on("queue:updated", onQueueUpdate);
    socket.on("playback:updated", onPlaybackUpdate);

    if (!nickname) {
      setStatus("nickname");
    } else {
      if (!socket.connected) socket.connect();
      socket.emit("room:join", { code: roomCode, nickname }, (result) => {
        if (!active) return;
        if (!result?.ok) {
          setStatus("error");
          setError(result?.error || "We couldn't join this room.");
          return;
        }
        setRoom(result.room);
        setMembers(result.members);
        setQueue(result.queue || []);
        setPlayback(result.playback || null);
        setNickname(result.member.nickname);
        setMemberId(result.member.id);
        setStatus("ready");
      });
    }

    return () => {
      active = false;
      socket.off("connect_error", onConnectionError);
      socket.off("room:state", onRoomState);
      socket.off("room:presence", onPresence);
      socket.off("queue:updated", onQueueUpdate);
      socket.off("playback:updated", onPlaybackUpdate);
    };
  }, [roomCode, nickname]);

  return { room, members, queue, playback, status, error, nickname, memberId, setNickname, setError };
}
