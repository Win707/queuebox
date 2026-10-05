import { useEffect, useRef, useState } from "react";
import YouTubePlayer from "./YouTubePlayer.jsx";
import { socket } from "../lib/socket.js";

export default function PlaybackPanel({ playback, queue, isHost }) {
  const playerRef = useRef(null);
  const scrubbingRef = useRef(false);
  const seekPositionRef = useRef(0);
  const playerReadyRef = useRef(false);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState("");
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerRetry, setPlayerRetry] = useState(0);
  const currentTrack = playback?.track || null;
  const duration = currentTrack?.durationSeconds || 0;
  const isVideoUnavailable = typeof error === "number";
  const errorMessage = isVideoUnavailable ? getYouTubeErrorMessage(error) : error;

  useEffect(() => {
    playerReadyRef.current = false;
    setPlayerReady(false);
    setError("");
    if (!currentTrack) return undefined;

    const timeout = window.setTimeout(() => {
      if (!playerReadyRef.current) {
        setError("The YouTube player is taking too long to load. Check your connection and try again.");
      }
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [currentTrack?.videoId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (playerRef.current && !scrubbingRef.current && playback?.isPlaying) {
        const currentPosition = playerRef.current.getCurrentTime();
        seekPositionRef.current = currentPosition;
        setPosition(currentPosition);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playback?.isPlaying, currentTrack?.videoId]);

  useEffect(() => {
    if (!playback) {
      seekPositionRef.current = 0;
      setPosition(0);
      return;
    }
    const elapsed = playback.isPlaying
      ? Math.max(0, (Date.now() - playback.updatedAt) / 1000)
      : 0;
    const syncedPosition = Math.min(duration, playback.positionSeconds + elapsed);
    seekPositionRef.current = syncedPosition;
    setPosition(syncedPosition);
  }, [playback, duration]);

  function sendControl(action, positionSeconds) {
    setError("");
    socket.timeout(5000).emit(
      "playback:control",
      { action, positionSeconds },
      (timeoutError, result) => {
        if (timeoutError || !result?.ok) {
          setError(result?.error || "Playback control failed. Please try again.");
        }
      },
    );
  }

  function togglePlayback() {
    if (playback?.isPlaying) {
      sendControl("pause", playerRef.current?.getCurrentTime() ?? position);
    } else {
      sendControl("play");
    }
  }

  function seekTo(value) {
    seekPositionRef.current = Number(value);
    setPosition(seekPositionRef.current);
    scrubbingRef.current = true;
  }

  function commitSeek() {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    sendControl("seek", seekPositionRef.current);
  }

  function resumeLocalPlayback() {
    if (!playerRef.current || !playback?.isPlaying) return;
    const elapsed = Math.max(0, (Date.now() - playback.updatedAt) / 1000);
    const syncedPosition = Math.min(duration, playback.positionSeconds + elapsed);
    playerRef.current.seekTo(syncedPosition, true);
    playerRef.current.playVideo();
    setAutoplayBlocked(false);
  }

  function handlePlayerReady(player) {
    playerRef.current = player;
    playerReadyRef.current = Boolean(player);
    setPlayerReady(Boolean(player));
  }

  return (
    <section className="room-card playback-card" aria-label="Room playback">
      <div className="playback-heading">
        <div>
          <p className="card-kicker"><span className="live-dot" /> {playback?.isPlaying ? "NOW PLAYING" : "ROOM PLAYER"}</p>
          <h2>{currentTrack?.title || "Nothing playing yet"}</h2>
          <p className="playback-artist">
            {currentTrack
              ? `${currentTrack.channelTitle} · added by ${currentTrack.addedBy}`
              : queue.length
                ? "The host can start the first song."
                : "Add a song to the queue to get started."}
          </p>
        </div>
        <span className="playback-role">{isHost ? "HOST CONTROLS" : "SYNCED LISTENER"}</span>
      </div>

      {currentTrack ? (
        <div className="player-shell">
          <YouTubePlayer
            key={playerRetry}
            playback={playback}
            isHost={isHost}
            onAutoplayBlocked={() => setAutoplayBlocked(true)}
            onError={setError}
            onReady={handlePlayerReady}
          />
          {!playerReady && <p className="player-loading" role="status">Connecting to YouTube...</p>}
        </div>
      ) : (
        <div className="player-placeholder" aria-hidden="true">
          <span>♫</span>
          <span className="placeholder-line" />
          <span className="placeholder-line short-line" />
        </div>
      )}

      <div className="playback-controls">
        <span className="playback-time">{formatDuration(position)}</span>
        <label className="sr-only" htmlFor="playback-seek">Playback position</label>
        <input
          id="playback-seek"
          aria-label="Playback position"
          className="seek-slider"
          type="range"
          min="0"
          max={Math.max(duration, 1)}
          step="1"
          value={Math.min(position, duration || 0)}
          disabled={!isHost || !currentTrack || duration === 0}
          onChange={(event) => seekTo(event.target.value)}
          onPointerUp={commitSeek}
          onKeyUp={commitSeek}
        />
        <span className="playback-time">{formatDuration(duration)}</span>
        {isHost && (
          <div className="host-buttons">
            <button
              className="playback-button"
              type="button"
              aria-label={playback?.isPlaying ? "Pause playback" : "Start playback"}
              disabled={!currentTrack && queue.length === 0}
              onClick={togglePlayback}
            >
              {playback?.isPlaying ? "Ⅱ" : "▶"}
            </button>
            <button
              className="skip-button"
              type="button"
              disabled={!currentTrack}
              onClick={() => sendControl("skip")}
            >
              Skip <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
      {autoplayBlocked && playback?.isPlaying && (
        <button className="sync-playback-button" type="button" onClick={resumeLocalPlayback}>
          Tap to sync playback on this device
        </button>
      )}
      {errorMessage && (
        <div className="playback-error" role="alert">
          <p>{errorMessage}</p>
          {currentTrack && (
            <a
              className="youtube-fallback-link"
              href={`https://www.youtube.com/watch?v=${encodeURIComponent(currentTrack.videoId)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open this video on YouTube ↗
            </a>
          )}
          {currentTrack && (
            <button
              className="youtube-skip-button"
              type="button"
              onClick={() => {
                setError("");
                setPlayerRetry((current) => current + 1);
              }}
            >
              Retry playback
            </button>
          )}
          {isHost && currentTrack && (
            <button className="youtube-skip-button" type="button" onClick={() => sendControl("skip")}>
              Skip unavailable video
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function getYouTubeErrorMessage(code) {
  if (code === 2) return "YouTube rejected this video ID. Skip it and choose another search result.";
  if (code === 5) return "YouTube's embedded player couldn't play this video. Try again or open it on YouTube.";
  if (code === 100) return "This video is private, removed, or unavailable. Skip it and choose another track.";
  if (code === 101 || code === 150) return "The video owner doesn't allow playback in other apps. Open it on YouTube or skip this track.";
  if (code === 153) return "YouTube couldn't verify the browser referrer. Refresh the room and try again.";
  return "YouTube couldn't play this video. It may be restricted or unavailable in your region.";
}

function formatDuration(seconds = 0) {
  const totalSeconds = Math.floor(seconds);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
