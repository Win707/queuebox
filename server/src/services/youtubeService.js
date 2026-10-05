const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

export async function searchVideos(query) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw createError(503, "YouTube search is not configured on the server.");
  }

  const searchUrl = new URL(YOUTUBE_SEARCH_URL);
  searchUrl.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    videoCategoryId: "10",
    maxResults: "8",
    q: query,
    key: apiKey,
  });

  const searchResponse = await fetchYouTube(searchUrl);
  if (!searchResponse.ok) throw createError(502, "YouTube search is temporarily unavailable.");
  const searchData = await searchResponse.json();
  const videoIds = (searchData.items || [])
    .map((item) => item.id?.videoId)
    .filter((id) => typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id));
  if (videoIds.length === 0) return [];

  const videosUrl = new URL(YOUTUBE_VIDEOS_URL);
  videosUrl.search = new URLSearchParams({
    part: "contentDetails,status",
    id: videoIds.join(","),
    key: apiKey,
  });

  const videosResponse = await fetchYouTube(videosUrl);
  if (!videosResponse.ok) throw createError(502, "YouTube search is temporarily unavailable.");
  const videosData = await videosResponse.json();
  const videos = new Map(
    (videosData.items || [])
      .filter((item) => item.status?.embeddable === true)
      .map((item) => [item.id, parseDuration(item.contentDetails?.duration)]),
  );

  return (searchData.items || [])
    .filter((item) => videos.has(item.id?.videoId))
    .map((item) => {
      const snippet = item.snippet || {};
      return {
        videoId: item.id.videoId,
        title: snippet.title || "Untitled video",
        channelTitle: snippet.channelTitle || "Unknown artist",
        thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "",
        durationSeconds: videos.get(item.id.videoId),
      };
    });
}

function parseDuration(duration) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration || "");
  if (!match) return 0;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function fetchYouTube(url) {
  try {
    return await fetch(url);
  } catch {
    throw createError(502, "YouTube search is temporarily unavailable.");
  }
}
