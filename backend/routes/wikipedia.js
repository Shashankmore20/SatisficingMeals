import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/:term", requireAuth, async (req, res) => {
  try {
    const term = encodeURIComponent(req.params.term);
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${term}`;

    const response = await fetch(url, {
      headers: { "User-Agent": "SatisficingMeals/1.0 (educational project)" },
    });

    if (!response.ok) {
      return res
        .status(404)
        .json({ error: "No Wikipedia article found for this ingredient." });
    }

    const data = await response.json();

    res.json({
      title: data.title,
      description: data.description || "",
      extract: data.extract || "",
      thumbnail: data.thumbnail?.source || null,
      url: data.content_urls?.desktop?.page || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Wikipedia data." });
  }
});

export default router;
