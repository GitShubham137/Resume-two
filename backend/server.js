import "dotenv/config";
import express from "express";
import cors from "cors";
import analyzeRoute from "./routes/analyze.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/analyze", analyzeRoute);

export default app;
