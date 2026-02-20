import { Router } from "express";
import { getDB } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const recipes = await db
      .collection("all_possible_recipes")
      .find({})
      .toArray();
    res.json(recipes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch recipes." });
  }
});

router.get("/daily", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const recipes = await db
      .collection("all_possible_recipes")
      .aggregate([{ $sample: { size: 3 } }])
      .toArray();
    res.json(recipes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch daily recipes." });
  }
});

router.get("/suggestions", requireAuth, async (req, res) => {
  try {
    const db = await getDB();

    const pantryItems = await db
      .collection("pantry_items")
      .find({ username: req.session.username })
      .toArray();

    const pantryIngredients = pantryItems.map((item) =>
      item.ingredient.toLowerCase(),
    );

    const recipes = await db
      .collection("all_possible_recipes")
      .find({})
      .toArray();

    const scored = recipes.map((recipe) => {
      const recipeIngredients = recipe.Ingredients.map((i) => i.toLowerCase());
      const have = recipeIngredients.filter((i) =>
        pantryIngredients.includes(i),
      );
      const missing = recipeIngredients.filter(
        (i) => !pantryIngredients.includes(i),
      );
      const score = have.length / recipeIngredients.length;

      const now = new Date();
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const usesExpiring = pantryItems.some((item) => {
        if (!item.expiration_date) return false;
        const exp = new Date(item.expiration_date);
        return exp <= threeDays && have.includes(item.ingredient.toLowerCase());
      });

      return { ...recipe, have, missing, score, usesExpiring };
    });

    scored.sort((a, b) => {
      if (a.usesExpiring && !b.usesExpiring) return -1;
      if (!a.usesExpiring && b.usesExpiring) return 1;
      return b.score - a.score;
    });

    res.json(scored);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get recipe suggestions." });
  }
});

router.get("/:name/prep", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const name = decodeURIComponent(req.params.name);

    const prepInstructions = await db
      .collection("prep_instructions")
      .find({ recipes: name })
      .toArray();

    res.json(prepInstructions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch prep instructions." });
  }
});

export default router;
