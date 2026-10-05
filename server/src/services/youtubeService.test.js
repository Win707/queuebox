import assert from "node:assert/strict";
import test from "node:test";
import { searchVideos } from "./youtubeService.js";

test("YouTube search excludes videos that are not embeddable", async (context) => {
  const previousApiKey = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = "test-key";
  context.after(() => {
    if (previousApiKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = previousApiKey;
  });

  const responses = [
    {
      items: [
        { id: { videoId: "abcdefghijk" }, snippet: { title: "Playable", channelTitle: "Artist" } },
        { id: { videoId: "bcdefghijkl" }, snippet: { title: "Blocked", channelTitle: "Artist" } },
      ],
    },
    {
      items: [
        { id: "abcdefghijk", status: { embeddable: true }, contentDetails: { duration: "PT3M" } },
        { id: "bcdefghijkl", status: { embeddable: false }, contentDetails: { duration: "PT4M" } },
      ],
    },
  ];
  let requestCount = 0;
  context.mock.method(globalThis, "fetch", async () => Response.json(responses[requestCount++]));

  const results = await searchVideos("test song");

  assert.equal(requestCount, 2);
  assert.deepEqual(results.map((video) => video.videoId), ["abcdefghijk"]);
  assert.equal(results[0].durationSeconds, 180);
});
