import assert from "node:assert/strict";
import test from "node:test";
import {
  addTrack,
  controlPlayback,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  serializePlayback,
} from "./roomService.js";

test("host controls playback, late join state syncs, and ended tracks auto-advance", () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const hostId = `host-${suffix}`;
  const guestId = `guest-${suffix}`;
  const created = createRoom(hostId, { nickname: "Alex", roomName: "Test room" });
  assert.equal(created.ok, true);
  assert.equal(joinRoom(guestId, { code: created.room.code, nickname: "Jamie" }).ok, true);

  assert.equal(addTrack(hostId, makeTrack("abcdefghijk", "First track")).ok, true);
  assert.equal(addTrack(hostId, makeTrack("bcdefghijkl", "Second track")).ok, true);
  assert.equal(controlPlayback(guestId, { action: "play" }).ok, false);

  const started = controlPlayback(hostId, { action: "play" });
  assert.equal(started.ok, true);
  assert.equal(started.playback.track.title, "First track");
  assert.equal(started.playback.isPlaying, true);
  assert.equal(started.queue.length, 1);

  const paused = controlPlayback(hostId, { action: "pause", positionSeconds: 24 });
  assert.equal(paused.ok, true);
  assert.equal(paused.playback.isPlaying, false);
  assert.equal(paused.playback.positionSeconds, 24);
  assert.equal(serializePlayback(getRoom(created.room.code), guestId).positionSeconds, 24);

  const resumed = controlPlayback(hostId, { action: "play" });
  assert.equal(resumed.playback.isPlaying, true);
  assert.equal(resumed.playback.track.title, "First track");

  const advanced = controlPlayback(hostId, { action: "ended" });
  assert.equal(advanced.ok, true);
  assert.equal(advanced.playback.track.title, "Second track");
  assert.equal(advanced.playback.positionSeconds, 0);
  assert.equal(advanced.playback.isPlaying, true);

  const finished = controlPlayback(hostId, { action: "ended" });
  assert.equal(finished.ok, true);
  assert.equal(finished.playback.track, null);
  assert.equal(finished.playback.isPlaying, false);

  leaveRoom(guestId);
  leaveRoom(hostId);
});

test("host can seek and skip, while invalid positions and unauthorized controls are rejected", () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const hostId = `host-seek-${suffix}`;
  const guestId = `guest-seek-${suffix}`;
  const created = createRoom(hostId, { nickname: "Alex", roomName: "Seek room" });
  joinRoom(guestId, { code: created.room.code, nickname: "Jamie" });
  addTrack(hostId, makeTrack("cdefghijklm", "First track"));
  addTrack(hostId, makeTrack("defghijklmn", "Second track"));
  controlPlayback(hostId, { action: "play" });

  assert.equal(controlPlayback(hostId, { action: "seek", positionSeconds: 500 }).ok, false);
  const seek = controlPlayback(hostId, { action: "seek", positionSeconds: 42 });
  assert.equal(seek.playback.positionSeconds, 42);
  const skipped = controlPlayback(hostId, { action: "skip" });
  assert.equal(skipped.playback.track.title, "Second track");
  assert.equal(skipped.playback.isPlaying, true);
  assert.equal(controlPlayback(guestId, { action: "skip" }).ok, false);

  leaveRoom(guestId);
  leaveRoom(hostId);
});

function makeTrack(videoId, title) {
  return {
    videoId,
    title,
    channelTitle: "Test artist",
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    durationSeconds: 210,
  };
}
