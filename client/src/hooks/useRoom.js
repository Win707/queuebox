import { useEffect, useState } from "react";
import { socket } from "../lib/socket.js";

export function useRoom(roomCode, initialNickname = "", initialMemberId = "") {
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
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
      setStatus("ready");
    };
    const onPresence = (presence) => {
      if (active) setMembers(presence.members);
    };

    socket.on("connect_error", onConnectionError);
    socket.on("room:state", onRoomState);
    socket.on("room:presence", onPresence);

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
    };
  }, [roomCode, nickname]);

  return { room, members, status, error, nickname, memberId, setNickname };
}
