import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteFooter from "../components/SiteFooter.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import { socket } from "../lib/socket.js";

export default function HomePage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function connectAnd(action, payload) {
    setError("");
    setBusy(true);

    let finished = false;
    const finish = (message) => {
      if (finished) return;
      finished = true;
      setBusy(false);
      socket.off("connect_error", onConnectionError);
      socket.off("connect", onConnect);
      if (message) setError(message);
    };

    const onConnectionError = () => {
      finish("Can't reach the Queuebox server. In PowerShell, run `npm.cmd run dev` from the queuebox folder, then try again.");
    };

    const onConnect = () => {
      socket.timeout(8000).emit(action, payload, (timeoutError, result) => {
        if (timeoutError) {
          finish("The Queuebox server connected but didn't respond. Restart it with `npm.cmd run dev` from the queuebox folder, then try again.");
          return;
        }
        if (!result?.ok) {
          finish(result?.error || "Something went wrong. Please try again.");
          return;
        }
        finish();
        navigate(`/room/${result.room.code}`, {
          state: { nickname: result.member.nickname, memberId: result.member.id },
        });
      });
    };

    socket.off("connect_error", onConnectionError);
    socket.off("connect", onConnect);
    socket.once("connect_error", onConnectionError);
    if (socket.connected) onConnect();
    else {
      socket.once("connect", onConnect);
      socket.connect();
    }
  }

  function createRoom(event) {
    event.preventDefault();
    connectAnd("room:create", { nickname, roomName });
  }

  function joinRoom(event) {
    event.preventDefault();
    connectAnd("room:join", { nickname, code: roomCode });
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-10 sm:py-8">
      <SiteHeader />

      <section className="hero mx-auto grid max-w-6xl items-center gap-12 pb-16 pt-14 md:grid-cols-[1.1fr_0.9fr] md:pb-24 md:pt-24">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> THE INTERNET'S LIVING ROOM</p>
          <h1>Good music.<br />Better <span className="accent-word">together.</span></h1>
          <p className="hero-description">
            Make a room, drop the link, and let everyone bring a song. Your next favorite
            memory has a soundtrack.
          </p>
          <div className="social-proof">
            <div className="avatar-stack" aria-hidden="true">
              <span className="mini-avatar avatar-peach">J</span>
              <span className="mini-avatar avatar-lilac">M</span>
              <span className="mini-avatar avatar-blue">A</span>
              <span className="mini-avatar avatar-green">+</span>
            </div>
            <span>A little room for your whole crew</span>
          </div>
        </div>

        <div className="room-card">
          <div className="card-topline">
            <span className="card-kicker">START LISTENING</span>
            <span className="sparkle" aria-hidden="true">✳</span>
          </div>
          <label className="field-label" htmlFor="nickname">YOUR NAME</label>
          <input
            id="nickname"
            className="text-input"
            autoComplete="nickname"
            maxLength={24}
            placeholder="What should we call you?"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            required
          />

          <form onSubmit={createRoom}>
            <label className="field-label" htmlFor="room-name">GIVE YOUR ROOM A NAME</label>
            <input
              id="room-name"
              className="text-input"
              maxLength={40}
              placeholder="Friday night, kitchen disco..."
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              required
            />
            <button className="primary-button" type="submit" disabled={busy || !nickname.trim()}>
              {busy ? "Making your room..." : "Create a room"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="divider"><span>OR JOIN YOUR PEOPLE</span></div>
          <form className="join-form" onSubmit={joinRoom}>
            <label className="sr-only" htmlFor="room-code">Room code</label>
            <input
              id="room-code"
              className="text-input code-input"
              autoCapitalize="none"
              maxLength={6}
              placeholder="Enter room code"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toLowerCase())}
              required
            />
            <button className="join-button" type="submit" disabled={busy || !nickname.trim()}>
              Join <span aria-hidden="true">→</span>
            </button>
          </form>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="privacy-note"><span aria-hidden="true">✦</span> No account. No fuss. Just the good stuff.</p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
