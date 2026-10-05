import { searchVideos } from "../services/youtubeService.js";

export async function getSearchResults(request, response, next) {
  const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
  if (!query || query.length > 100) {
    response.status(400).json({ error: "Enter a search term up to 100 characters long." });
    return;
  }

  try {
    const results = await searchVideos(query);
    response.json({ results });
  } catch (error) {
    next(error);
  }
}
