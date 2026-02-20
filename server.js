import "dotenv/config";
import express from "express";
import session from "express-session";
import { connectDB } from "./backend/db/connection.js";
import authRoutes from "./backend/routes/auth.js";
import pantryRoutes from "./backend/routes/pantry.js";
import recipeRoutes from "./backend/routes/recipes.js";
import shoppingRoutes from "./backend/routes/shopping.js";
import wikipediaRoutes from "./backend/routes/wikipedia.js";
import imageRoutes from "./backend/routes/images.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "satisficing-meals-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

// Serve static frontend files
app.use(express.static(path.join(__dirname, "frontend")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/pantry", pantryRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/shopping", shoppingRoutes);
app.use("/api/wikipedia", wikipediaRoutes);
app.use("/api/images", imageRoutes);

// Catch-all: serve index.html for client-side routing
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// Start server
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`SatisficingMeals running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
