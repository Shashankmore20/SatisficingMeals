import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/:query", requireAuth, async (req, res) => {
  try {
    const query = encodeURIComponent(`${req.params.query} food`);
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`,
      {
        headers: {
          Authorization: process.env.PEXELS_API_KEY,
        },
      },
    );

    if (!response.ok) {
      return res.status(404).json({ error: "No image found." });
    }

    const data = await response.json();

    if (!data.photos || data.photos.length === 0) {
      return res.status(404).json({ error: "No image found." });
    }

    const photo = data.photos[0];
    res.json({
      url: photo.src.medium,
      thumb: photo.src.small,
      photographer: photo.photographer,
      pexels_url: photo.url,
    });
  } catch (err) {
    console.error("Pexels error:", err);
    res.status(500).json({ error: "Failed to fetch image." });
  }
});

export default router;
