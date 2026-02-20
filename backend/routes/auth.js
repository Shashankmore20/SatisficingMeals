import { Router } from "express";
import bcrypt from "bcrypt";
import { getDB } from "../db/connection.js";

const router = Router();
const SALT_ROUNDS = 10;

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, username, password, goal } = req.body;

    if (!name || !username || !password) {
      return res
        .status(400)
        .json({ error: "Name, username, and password are required." });
    }

    const db = await getDB();
    const existing = await db.collection("users").findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Username already taken." });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = {
      name,
      username,
      password: hashedPassword,
      goal: goal || "",
      date_created: new Date().toISOString(),
    };

    const result = await db.collection("users").insertOne(newUser);
    req.session.userId = result.insertedId.toString();
    req.session.username = username;
    req.session.name = name;
    req.session.goal = goal || "";

    res
      .status(201)
      .json({ message: "Account created.", username, name, goal: goal || "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during signup." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    const db = await getDB();
    const user = await db.collection("users").findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    req.session.userId = user._id.toString();
    req.session.username = user.username;
    req.session.name = user.name;
    req.session.goal = user.goal || "";

    res.json({
      message: "Logged in.",
      username: user.username,
      name: user.name,
      goal: user.goal || "",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login." });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed." });
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out." });
  });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  res.json({
    userId: req.session.userId,
    username: req.session.username,
    name: req.session.name,
    goal: req.session.goal || "",
  });
});

export default router;
