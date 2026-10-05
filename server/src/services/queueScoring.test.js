import assert from "node:assert/strict";
import test from "node:test";
import { getTrackScore, sortQueueByScore } from "./queueScoring.js";

test("track score sums each member's current vote", () => {
  assert.equal(getTrackScore({ votes: { alice: 1, bob: 1, casey: -1 } }), 1);
});

test("queue sorts by score descending and preserves insertion order for ties", () => {
  const first = { videoId: "first", votes: { alice: 1 } };
  const second = { videoId: "second", votes: { alice: -1 } };
  const third = { videoId: "third", votes: { alice: 1, bob: 1 } };
  const sorted = sortQueueByScore([first, second, third]);

  assert.deepEqual(sorted, [third, first, second]);
  assert.equal(first.videoId, "first");
  assert.equal(second.videoId, "second");
  assert.equal(third.videoId, "third");
});
