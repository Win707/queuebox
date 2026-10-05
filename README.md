# Queuebox

Queuebox is a real-time collaborative music room. Create a room, invite friends, search for YouTube tracks, vote to shape a shared queue, and listen in sync with the host.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. From this directory, install dependencies:

   ```sh
   npm install
   ```

   If PowerShell reports that `npm.ps1` cannot run because scripts are disabled, use the Windows command shim instead: `npm.cmd install` and `npm.cmd run dev`.

3. Copy `.env.example` to `.env`. Set `YOUTUBE_API_KEY` to a YouTube Data API v3 key to enable search.
4. Start the client and server together:

   ```sh
   npm run dev
   ```

5. Open the Vite URL printed in the terminal (usually `http://localhost:5173`). Open another browser or private window to test joining the same room, watching presence update, and sharing queue additions.

The YouTube key is read by the server and is never sent to the browser. Search results are filtered to videos YouTube marks as embeddable, though availability can still vary by video or region. If a selected video fails inside the embedded player, the host can open it on YouTube or skip it. You can create a room and share queued tracks locally without search, but searching requires the key.

The server health endpoint is available at `http://localhost:3001/health`.

## Project structure

- `client/` — React, Vite, React Router, and responsive Tailwind-powered styling.
- `client/src/components/` — shared site header and footer.
- `client/src/hooks/useRoom.js` — room join lifecycle and live presence subscription.
- `server/src/routes/` and `server/src/controllers/` — Express health route.
- `server/src/socket/roomHandlers.js` — Socket.IO room events and presence broadcasts.
- `server/src/services/roomService.js` — in-memory authoritative room, queue, and playback state.
- `server/src/routes/searchRoutes.js` and `server/src/services/youtubeService.js` — backend-only YouTube Data API search proxy.
- `server/src/services/queueScoring.js` — deterministic vote scoring and stable queue ordering.
- `client/src/components/PlaybackPanel.jsx` — host controls and synced YouTube player UI.

Rooms and queues live in server memory, so restarting the server clears them. Database persistence and production deployment are planned for later phases. YouTube search uses the Data API search and video-details endpoints; configure a valid API key and enable YouTube Data API v3 in its Google Cloud project.

## Tests

Run the server's scoring, ordering, playback, and YouTube embed-filter tests with `npm.cmd run test --workspace server` (or `npm run test --workspace server` outside PowerShell).
