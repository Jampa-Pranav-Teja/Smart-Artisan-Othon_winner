import express from "express";

import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  connectTelegramWebhook,
} from "../controllers/userController.js";

import { protect } from "../middlewares/authMiddleware.js";

import { validateRequiredFields } from "../middlewares/validationMiddleware.js";

const router = express.Router();

/* REGISTER */
router.post(
  "/register",
  validateRequiredFields([
    "name",
    "email",
    "password",
  ]),
  registerUser
);

/* LOGIN */
router.post(
  "/login",
  validateRequiredFields([
    "email",
    "password",
  ]),
  loginUser
);

/* PROFILE */
router.get(
  "/profile",
  protect,
  getUserProfile
);

router.put(
  "/profile",
  protect,
  updateUserProfile
);

router.post(
  "/telegram/connect",
  protect,
  connectTelegramWebhook
);

export default router;