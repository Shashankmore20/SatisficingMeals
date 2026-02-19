import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/pantry - get all pantry items for current user
router.get("/", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const items = await db
      .collection("pantry_items")
      .find({ userId: req.session.userId })
      .sort({ expiration_date: 1 })
      .toArray();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pantry items." });
  }
});

// POST /api/pantry - add a new pantry item
router.post("/", requireAuth, async (req, res) => {
  try {
    const { ingredient, quantity, unit, expiration_date } = req.body;

    if (!ingredient || !quantity || !unit) {
      return res.status(400).json({ error: "Ingredient, quantity, and unit are required." });
    }

    const db = await getDB();

    // Get suggested expiry from ingredients_db if no date provided
    let expiryDate = expiration_date;
    if (!expiryDate) {
      const ingredientData = await db
        .collection("all_possible_ingredients")
        .findOne({ ingredient: ingredient.toLowerCase() });
      expiryDate = ingredientData?.expiration_date || null;
    }

    const newItem = {
      userId: req.session.userId,
      ingredient: ingredient.toLowerCase(),
      quantity: Number(quantity),
      unit,
      date_added: new Date().toISOString(),
      expiration_date: expiryDate,
    };

    const result = await db.collection("pantry_items").insertOne(newItem);

    // Also log to purchase_history
    await db.collection("purchase_history").insertOne({
      userId: req.session.userId,
      ingredient: ingredient.toLowerCase(),
      date_added: new Date().toISOString(),
    });

    res.status(201).json({ ...newItem, _id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add pantry item." });
  }
});

// PUT /api/pantry/:id - update a pantry item
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { ingredient, quantity, unit, expiration_date } = req.body;
    const db = await getDB();

    const update = {};
    if (ingredient !== undefined) update.ingredient = ingredient.toLowerCase();
    if (quantity !== undefined) update.quantity = Number(quantity);
    if (unit !== undefined) update.unit = unit;
    if (expiration_date !== undefined) update.expiration_date = expiration_date;

    const result = await db.collection("pantry_items").updateOne(
      { _id: new ObjectId(req.params.id), userId: req.session.userId },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Item not found." });
    }

    res.json({ message: "Item updated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update pantry item." });
  }
});

// DELETE /api/pantry/:id - delete a pantry item
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection("pantry_items").deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.session.userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Item not found." });
    }

    res.json({ message: "Item deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete pantry item." });
  }
});

// GET /api/pantry/expiring - items expiring within 7 days
router.get("/expiring", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const items = await db
      .collection("pantry_items")
      .find({
        userId: req.session.userId,
        expiration_date: { $ne: null },
      })
      .toArray();

    // Filter by date (dates stored as strings like "M/D/YY")
    const expiring = items.filter((item) => {
      if (!item.expiration_date) return false;
      const exp = new Date(item.expiration_date);
      return exp >= now && exp <= sevenDaysOut;
    });

    expiring.sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date));

    res.json(expiring);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch expiring items." });
  }
});

// GET /api/pantry/suggest-expiry/:ingredient
router.get("/suggest-expiry/:ingredient", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const found = await db
      .collection("all_possible_ingredients")
      .findOne({ ingredient: req.params.ingredient.toLowerCase() });

    if (!found) {
      return res.json({ expiration_date: null });
    }

    res.json({ expiration_date: found.expiration_date });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to suggest expiry." });
  }
});

// POST /api/pantry/add-ingredient - add to all_possible_ingredients if missing
router.post("/add-ingredient", requireAuth, async (req, res) => {
  try {
    const { ingredient, expiration_date } = req.body;
    if (!ingredient) return res.status(400).json({ error: "Ingredient name required." });

    const db = await getDB();
    const existing = await db
      .collection("all_possible_ingredients")
      .findOne({ ingredient: ingredient.toLowerCase() });

    if (existing) {
      return res.json({ message: "Ingredient already exists.", existing: true });
    }

    await db.collection("all_possible_ingredients").insertOne({
      ingredient: ingredient.toLowerCase(),
      date_added: new Date().toISOString(),
      expiration_date: expiration_date || null,
    });

    res.status(201).json({ message: "Ingredient added to database." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add ingredient." });
  }
});

export default router;
