import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { serverUrl, socket } from "../lib/socket.js";

export default function QueuePanel({ roomCode, queue }) {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingVideoId, setAddingVideoId] = useState("");
  const [searchError, setSearchError] = useState("");
  const [queueError, setQueueError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingQueue, setPendingQueue] = useState(null);
  const [pendingVoteIds, setPendingVoteIds] = useState(() => new Set());
  const optimisticQueue = pendingQueue?.base === queue ? pendingQueue.queue : queue;

  useEffect(() => {
    setPendingQueue(null);
  }, [queue]);

  async function search(event) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;

    setSearching(true);
    setSearchError("");
    setResults([]);
    try {
      const response = await fetch(`${serverUrl}/api/search?q=${encodeURIComponent(term)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed. Please try again.");
      setResults(data.results);
      if (data.results.length === 0) setSearchError("No videos found. Try a different search.");
    } catch (error) {
      setSearchError(error.message || "Search is unavailable. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function addToQueue(track) {
    setAddingVideoId(track.videoId);
    setQueueError("");
    setNotice("");
    socket.emit("queue:add", track, (result) => {
      setAddingVideoId("");
      if (!result?.ok) {
        setQueueError(result?.error || "Couldn't add that song.");
        return;
      }
      setNotice(`Added “${result.track.title}” to the queue.`);
      setResults((current) => current.filter((item) => item.videoId !== track.videoId));
    });
  }

  function voteForTrack(track, vote) {
    const currentVote = track.myVote || 0;
    const nextVote = currentVote === vote ? 0 : vote;
    setPendingVoteIds((current) => new Set(current).add(track.videoId));
    setQueueError("");
    setNotice("");
    const nextQueue = optimisticQueue
      .map((item) => item.videoId === track.videoId
        ? { ...item, score: item.score - currentVote + nextVote, myVote: nextVote }
        : item)
      .sort((left, right) => right.score - left.score);
    setPendingQueue({ base: queue, queue: nextQueue });

    socket.timeout(5000).emit("queue:vote", { videoId: track.videoId, vote: nextVote }, (timeoutError, result) => {
      setPendingVoteIds((current) => {
        const next = new Set(current);
        next.delete(track.videoId);
        return next;
      });
      if (timeoutError || !result?.ok) {
        setPendingQueue(null);
        setQueueError(result?.error || "Your vote couldn't be saved. Please try again.");
      }
    });
  }

  return (
    <section className="room-card queue-card" aria-labelledby="queue-title">
      <div className="queue-heading">
        <div>
          <p className="card-kicker">PICK THE NEXT TRACK</p>
          <h2 id="queue-title">The queue <span className="queue-count">{queue.length}</span></h2>
        </div>
      </div>
      <form className="search-form" onSubmit={search}>
        <label className="sr-only" htmlFor="song-search">Search YouTube for a song</label>
        <input
          id="song-search"
          className="text-input"
          maxLength={100}
          placeholder="Search songs, artists, or videos..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="join-button" type="submit" disabled={searching || !query.trim()}>
          {searching ? "Searching..." : "Search"}
        </button>
      </form>
      {searchError && <p className="queue-message" role="alert">{searchError}</p>}
      {queueError && <p className="queue-message" role="alert">{queueError}</p>}
      {notice && <p className="queue-message queue-success" role="status">{notice}</p>}

      {results.length > 0 && (
        <div className="search-results">
          <p className="results-label">SEARCH RESULTS</p>
          {results.map((track) => {
            const alreadyQueued = queue.some((queuedTrack) => queuedTrack.videoId === track.videoId);
            return (
              <article className="track-row search-track" key={track.videoId}>
                <img className="track-thumbnail" src={track.thumbnail} alt="" />
                <div className="track-details">
                  <h3>{track.title}</h3>
                  <p>{track.channelTitle} · {formatDuration(track.durationSeconds)}</p>
                </div>
                <button
                  aria-label={`Add ${track.title} to queue`}
                  className="add-track-button"
                  type="button"
                  disabled={alreadyQueued || addingVideoId === track.videoId}
                  onClick={() => addToQueue(track)}
                >
                  {alreadyQueued ? "Added" : addingVideoId === track.videoId ? "..." : "+"}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <div className="queued-tracks">
        {optimisticQueue.length === 0 ? (
          <p className="queue-empty">Nothing queued yet. Find a song and add it to get started.</p>
        ) : (
          <AnimatePresence initial={false}>
            {optimisticQueue.map((track, index) => (
              <motion.article
                className="track-row queued-track"
                key={track.videoId}
                layout
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                <span className="track-position">{String(index + 1).padStart(2, "0")}</span>
                <img className="track-thumbnail" src={track.thumbnail} alt="" />
                <div className="track-details">
                  <h3>{track.title}</h3>
                  <p>{track.channelTitle} · added by {track.addedBy}</p>
                </div>
                <div className="vote-controls" aria-label={`Votes for ${track.title}`}>
                  <button
                    aria-label={`Upvote ${track.title}`}
                    aria-pressed={track.myVote === 1}
                    className={`vote-button${track.myVote === 1 ? " vote-active" : ""}`}
                    disabled={pendingVoteIds.has(track.videoId)}
                    onClick={() => voteForTrack(track, 1)}
                    type="button"
                  >↑</button>
                  <span className="track-score" aria-label={`${track.score} votes`}>{track.score}</span>
                  <button
                    aria-label={`Downvote ${track.title}`}
                    aria-pressed={track.myVote === -1}
                    className={`vote-button${track.myVote === -1 ? " vote-active" : ""}`}
                    disabled={pendingVoteIds.has(track.videoId)}
                    onClick={() => voteForTrack(track, -1)}
                    type="button"
                  >↓</button>
                </div>
                <span className="track-duration">{formatDuration(track.durationSeconds)}</span>
              </motion.article>
            ))}
          </AnimatePresence>
        )}
      </div>
      <span className="sr-only" aria-live="polite">Room code: {roomCode}. Queue has {queue.length} songs.</span>
    </section>
  );
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
