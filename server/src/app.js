import "./config.js";
import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import healthRoutes from "./routes/healthRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: clientOrigin.split(",").map((origin) => origin.trim()) }));
app.use(express.json({ limit: "10kb" }));

app.use("/health", healthRoutes);
app.use("/api/search", searchRoutes);
app.use(errorHandler);

export default app;
