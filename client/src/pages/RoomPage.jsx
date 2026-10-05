import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import SiteFooter from "../components/SiteFooter.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import QueuePanel from "../components/QueuePanel.jsx";
import PlaybackPanel from "../components/PlaybackPanel.jsx";
import { useRoom } from "../hooks/useRoom.js";

export default function RoomPage() {
  const { roomCode = "" } = useParams();
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  const { room, members, queue, playback, status, error, nickname, memberId, setNickname } = useRoom(
    roomCode,
    location.state?.nickname || "",
    location.state?.memberId || "",
  );

  function joinWithNickname(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chosenName = String(form.get("nickname") || "").trim();
    if (!chosenName) return;
    setNickname(chosenName);
  }

  async function copyInvite() {
    const inviteUrl = `${window.location.origin}/room/${roomCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy the invite link. Copy it from your browser's address bar instead.");
    }
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-10 sm:py-8">
      <SiteHeader showBackLink />

      {status === "nickname" ? (
        <section className="room-shell">
          <div className="room-card nickname-card">
            <p className="eyebrow"><span className="eyebrow-line" /> YOU'RE INVITED</p>
            <h1 className="small-heading">Pick your<br /><span className="accent-word">room name.</span></h1>
            <p className="hero-description">Choose a name so your friends know who's here.</p>
            <form onSubmit={joinWithNickname}>
              <label className="field-label" htmlFor="guest-nickname">YOUR NAME</label>
              <input id="guest-nickname" className="text-input" name="nickname" autoComplete="nickname" maxLength={24} autoFocus required placeholder="e.g. Alex" />
              <button className="primary-button" type="submit">Join the room <span aria-hidden="true">↗</span></button>
            </form>
          </div>
        </section>
      ) : status === "error" ? (
        <section className="room-shell">
          <div className="room-card message-card">
            <span className="sparkle" aria-hidden="true">✳</span>
            <p className="eyebrow">ROOM NOT FOUND</p>
            <h1 className="small-heading">That link<br />missed the <span className="accent-word">beat.</span></h1>
            <p className="hero-description" role="alert">{error}</p>
            <Link className="primary-button button-link" to="/">Back to Queuebox <span aria-hidden="true">↗</span></Link>
          </div>
        </section>
      ) : (
        <section className="room-shell">
          <div className="room-heading-row">
            <div>
              <p className="eyebrow"><span className="live-dot" /> LISTENING ROOM · {roomCode}</p>
              <h1 className="room-title">{room?.name || "Tuning in..."}</h1>
              <p className="room-subtitle">
                {room ? `You're in as ${nickname}` : "Finding your people..."}
              </p>
            </div>
            <button className="invite-button" onClick={copyInvite} type="button">
              {copied ? "Link copied ✓" : "Invite friends ↗"}
            </button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="room-grid">
            <section className="room-card listening-card">
              <div className="listening-art" aria-hidden="true">
                <span className="art-orbit orbit-one" />
                <span className="art-orbit orbit-two" />
                <span className="art-center">♫</span>
              </div>
              <p className="card-kicker">THE ROOM IS YOURS</p>
              <h2>Good things start<br />with one song.</h2>
              <p>Invite your friends and make this space your own. The queue is waiting.</p>
              <button className="primary-button" onClick={copyInvite} type="button">Bring your people <span aria-hidden="true">↗</span></button>
            </section>
            <aside className="room-card people-card">
              <div className="people-heading">
                <div><p className="card-kicker">THE CREW</p><h2>In the room</h2></div>
                <span className="people-count">{members.length.toString().padStart(2, "0")}</span>
              </div>
              {status === "connecting" && <p className="people-empty">Finding the room...</p>}
              {status !== "connecting" && members.length === 0 && <p className="people-empty">It's a little quiet in here.</p>}
              <ul className="member-list" aria-label="People in the room">
                {members.map((member) => (
                  <li className="member-row" key={member.id}>
                    <span className="member-avatar" style={{ backgroundColor: member.color }} aria-hidden="true">
                      {member.nickname.charAt(0).toUpperCase()}
                    </span>
                    <span className="member-name">{member.nickname}{member.id === memberId ? " (you)" : ""}</span>
                    {member.isHost && <span className="host-label">HOST</span>}
                    <span className="member-live" aria-label="online" />
                  </li>
                ))}
              </ul>
              <div className="people-footer"><span className="live-dot" /> HERE TOGETHER, RIGHT NOW</div>
            </aside>
          </div>
          <PlaybackPanel
            playback={playback}
            queue={queue}
            isHost={Boolean(members.find((member) => member.id === memberId)?.isHost)}
          />
          <QueuePanel roomCode={roomCode} queue={queue} />
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
