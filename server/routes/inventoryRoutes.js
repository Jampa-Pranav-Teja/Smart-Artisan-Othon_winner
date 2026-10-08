import express from "express";
import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import { maybeSendLowStockAlert } from "../utils/lowStockAlert.js";

const router = express.Router();

// 1. GET: Fetch user-scoped items
router.get("/", async (req, res, next) => {
  try {
    const { artisanId } = req.query;
    if (!artisanId) {
      return res.status(400).json({ message: "Missing artisanId query parameter" });
    }
    const items = await Inventory.find({ artisanId }).sort({ createdAt: -1 });
    return res.json(items);
  } catch (error) {
    next(error);
  }
});

// 2. POST: Insert a brand new record
router.post("/", async (req, res, next) => {
  try {
    const newItem = new Inventory(req.body);
    const savedItem = await newItem.save();
    // Alert if created already below 20%
    maybeSendLowStockAlert({ previousItem: null, updatedItem: savedItem });
    return res.status(201).json(savedItem);
  } catch (error) {
    next(error);
  }
});

// 3. PUT: Direct inline rapid stock increments/decrements ($inc)
router.put("/:id/stock", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount } = req.body; // Expects 1 or -1

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid MongoDB Object ID configuration" });
    }

    const previousItem = await Inventory.findById(id).lean();
    if (!previousItem) {
      return res.status(404).json({ message: "Target inventory row not found" });
    }

    let updatedItem = await Inventory.findByIdAndUpdate(
      id,
      { $inc: { stock: amount } },
      { new: true, runValidators: true },
    );

    if (updatedItem && updatedItem.stock < 0) {
      updatedItem.stock = 0;
      await updatedItem.save();
    }

    maybeSendLowStockAlert({ previousItem, updatedItem });

    return res.json(updatedItem);
  } catch (error) {
    next(error);
  }
});

// 4. PUT: General attribute edits (names, prices, max capacities)
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid MongoDB Object ID configuration" });
    }

    const previousItem = await Inventory.findById(id).lean();
    if (!previousItem) {
      return res.status(404).json({ message: "Target inventory row not found" });
    }

    const updatedItem = await Inventory.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true },
    );

    maybeSendLowStockAlert({ previousItem, updatedItem });

    return res.json(updatedItem);
  } catch (error) {
    next(error);
  }
});

// 5. DELETE: Drop a document permanently
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid MongoDB Object ID configuration" });
    }

    const droppedItem = await Inventory.findByIdAndDelete(id);
    if (!droppedItem) {
      return res.status(404).json({ message: "Target document doesn't exist" });
    }

    return res.json({ success: true, message: "Inventory record wiped successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
