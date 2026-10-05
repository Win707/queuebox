import { useEffect, useRef } from "react";
import { socket } from "../lib/socket.js";
import { loadYouTubeIframeAPI } from "../lib/youtubeIframeApi.js";

export default function YouTubePlayer({ playback, isHost, onAutoplayBlocked, onError, onReady }) {
  const elementRef = useRef(null);
  const playerRef = useRef(null);
  const failedRef = useRef(false);
  const playbackRef = useRef(playback);
  const isHostRef = useRef(isHost);
  const onErrorRef = useRef(onError);
  const onAutoplayBlockedRef = useRef(onAutoplayBlocked);
  const onReadyRef = useRef(onReady);

  playbackRef.current = playback;
  isHostRef.current = isHost;
  onAutoplayBlockedRef.current = onAutoplayBlocked;
  onErrorRef.current = onError;
  onReadyRef.current = onReady;

  const videoId = playback?.track?.videoId;

  useEffect(() => {
    if (!videoId || !elementRef.current) return undefined;

    let active = true;
    let player;
    const playerMount = document.createElement("div");
    elementRef.current.append(playerMount);
    failedRef.current = false;
    const iframeObserver = new MutationObserver((records) => {
      for (const iframe of records.flatMap((record) => [...record.addedNodes])) {
        if (iframe instanceof HTMLIFrameElement) {
          iframe.referrerPolicy = "strict-origin-when-cross-origin";
        }
      }
    });
    iframeObserver.observe(elementRef.current, { childList: true });

    loadYouTubeIframeAPI()
      .then((youtube) => {
        if (!active || !elementRef.current) return;

        player = new youtube.Player(playerMount, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (!active) return;
              playerRef.current = event.target;
              const iframe = event.target.getIframe();
              iframe.title = `Now playing: ${playbackRef.current?.track?.title || "Queuebox track"}`;
              iframe.referrerPolicy = "strict-origin-when-cross-origin";
              onReadyRef.current?.(event.target);
              synchronizePlayer(event.target, playbackRef.current);
            },
            onStateChange: (event) => {
              if (event.data !== youtube.PlayerState.ENDED || !active || !isHostRef.current) return;
              socket.timeout(5000).emit("playback:control", { action: "ended" }, (timeoutError, result) => {
                if (timeoutError || !result?.ok) {
                  onErrorRef.current?.(result?.error || "The next track couldn't be started.");
                }
              });
            },
            onError: (event) => {
              failedRef.current = true;
              onErrorRef.current?.(event.data);
            },
            onAutoplayBlocked: () => {
              onAutoplayBlockedRef.current?.();
            },
          },
        });
      })
      .catch((error) => {
        if (active) onErrorRef.current?.(error.message);
      });

    return () => {
      active = false;
      iframeObserver.disconnect();
      playerRef.current = null;
      onReadyRef.current?.(null);
      player?.destroy();
      if (playerMount.parentNode) playerMount.remove();
    };
  }, [videoId]);

  useEffect(() => {
    if (playerRef.current && playback) synchronizePlayer(playerRef.current, playback);
  }, [playback]);

  if (!videoId) return null;

  return <div className="youtube-frame" ref={elementRef} />;
}

function synchronizePlayer(player, playback) {
  if (!playback?.track) return;

  const elapsed = playback.isPlaying
    ? Math.max(0, (Date.now() - playback.updatedAt) / 1000)
    : 0;
  const desiredPosition = Math.min(
    playback.track.durationSeconds,
    playback.positionSeconds + elapsed,
  );
  const currentPosition = player.getCurrentTime();

  if (Math.abs(currentPosition - desiredPosition) > 1.5) {
    player.seekTo(desiredPosition, true);
  }
  const playerState = player.getPlayerState();
  const youtube = window.YT;
  if (playback.isPlaying) {
    if (playerState !== youtube.PlayerState.PLAYING &&
        playerState !== youtube.PlayerState.BUFFERING) {
      player.playVideo();
    }
  } else if (playerState === youtube.PlayerState.PLAYING ||
             playerState === youtube.PlayerState.BUFFERING) {
    player.pauseVideo();
  }
}
