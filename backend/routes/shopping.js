import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const lists = await db
      .collection("shopping_lists")
      .find({ userId: req.session.userId })
      .sort({ created_at: -1 })
      .toArray();
    res.json(lists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shopping lists." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, items } = req.body;

    if (!name) {
      return res.status(400).json({ error: "List name is required." });
    }

    const db = await getDB();
    const newList = {
      userId: req.session.userId,
      name,
      items: (items || []).map((item) => ({
        ingredient: item.ingredient?.toLowerCase() || item,
        quantity: item.quantity || 1,
        unit: item.unit || "item",
        checked: false,
      })),
      created_at: new Date().toISOString(),
    };

    const result = await db.collection("shopping_lists").insertOne(newList);
    res.status(201).json({ ...newList, _id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create shopping list." });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name, items } = req.body;
    const db = await getDB();

    const update = {};
    if (name !== undefined) update.name = name;
    if (items !== undefined) update.items = items;

    const result = await db
      .collection("shopping_lists")
      .updateOne(
        { _id: new ObjectId(req.params.id), userId: req.session.userId },
        { $set: update },
      );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "List not found." });
    }

    res.json({ message: "List updated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update shopping list." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection("shopping_lists").deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.session.userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "List not found." });
    }

    res.json({ message: "List deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete shopping list." });
  }
});

router.post("/:id/check/:itemIndex", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const idx = parseInt(req.params.itemIndex);

    const list = await db.collection("shopping_lists").findOne({
      _id: new ObjectId(req.params.id),
      userId: req.session.userId,
    });

    if (!list) return res.status(404).json({ error: "List not found." });
    if (idx < 0 || idx >= list.items.length) {
      return res.status(400).json({ error: "Invalid item index." });
    }

    const updatedItems = [...list.items];
    updatedItems[idx].checked = !updatedItems[idx].checked;

    await db
      .collection("shopping_lists")
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { items: updatedItems } },
      );

    res.json({ message: "Item toggled.", checked: updatedItems[idx].checked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to toggle item." });
  }
});

router.post("/:id/move-to-pantry", requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const list = await db.collection("shopping_lists").findOne({
      _id: new ObjectId(req.params.id),
      userId: req.session.userId,
    });

    if (!list) return res.status(404).json({ error: "List not found." });

    const checkedItems = list.items.filter((item) => item.checked);

    if (checkedItems.length === 0) {
      return res.json({ message: "No checked items to move.", moved: 0 });
    }

    const now = new Date().toISOString();
    for (const item of checkedItems) {
      const ingredientData = await db
        .collection("all_possible_ingredients")
        .findOne({ ingredient: item.ingredient });

      await db.collection("pantry_items").insertOne({
        username: req.session.username,
        ingredient: item.ingredient,
        quantity: item.quantity,
        unit: item.unit,
        date_added: now,
        expiration_date: ingredientData?.expiration_date || null,
      });

      await db.collection("purchase_history").insertOne({
        username: req.session.username,
        ingredient: item.ingredient,
        date_added: now,
      });
    }

    const remainingItems = list.items.filter((item) => !item.checked);
    await db
      .collection("shopping_lists")
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { items: remainingItems } },
      );

    res.json({
      message: `Moved ${checkedItems.length} item(s) to pantry.`,
      moved: checkedItems.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to move items to pantry." });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const db = await getDB();

    const history = await db
      .collection("purchase_history")
      .aggregate([
        { $match: { username: req.session.username } },
        {
          $group: {
            _id: "$ingredient",
            count: { $sum: 1 },
            last_bought: { $max: "$date_added" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch purchase history." });
  }
});

export default router;
