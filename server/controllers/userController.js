import User from "../models/User.js";
import jwt from "jsonwebtoken";
import axios from "axios";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

/* REGISTER USER */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, organizationName } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Pass role and organizationName to the create method
    const user = await User.create({
      name,
      email,
      password, // Model pre-save hook hashes this automatically
      role,
      organizationName: role === "organization" ? organizationName : undefined,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* LOGIN USER */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    // Use matchPassword from the model instead of manual bcrypt compare
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        telegramBotToken: user.telegramBotToken || "",
        telegramChatId: user.telegramChatId || "",
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* GET PROFILE */
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id || req.user).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* UPDATE PROFILE */
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id || req.user);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (typeof req.body.telegramBotToken === "string") {
      user.telegramBotToken = req.body.telegramBotToken.trim();
    }

    if (typeof req.body.telegramChatId === "string") {
      user.telegramChatId = req.body.telegramChatId.trim();
    }

    if (typeof req.body.name === "string" && req.body.name.trim()) {
      user.name = req.body.name.trim();
    }

    if (typeof req.body.profession === "string") {
      user.profession = req.body.profession.trim();
    }

    const updated = await user.save();

    res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      profession: updated.profession,
      telegramBotToken: updated.telegramBotToken || "",
      telegramChatId: updated.telegramChatId || "",
      token: generateToken(updated._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const DEFAULT_N8N_TELEGRAM_WEBHOOK =
  "https://n8n.srv1710717.hstgr.cloud/webhook/c002b8f1-a120-48d0-b526-1aafabbb54a1";

async function telegramApi(botToken, method, payload) {
  return axios.post(
    `https://api.telegram.org/bot${botToken}/${method}`,
    payload || {},
    { timeout: 20000, validateStatus: () => true },
  );
}

/* CONNECT TELEGRAM BOT → n8n via Telegram setWebhook */
const connectTelegramWebhook = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id || req.user);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const botToken = (
      req.body.telegramBotToken ||
      user.telegramBotToken ||
      ""
    ).trim();

    if (!botToken) {
      return res.status(400).json({
        message: "Save your Telegram bot access token first.",
      });
    }

    if (typeof req.body.telegramBotToken === "string") {
      user.telegramBotToken = botToken;
    }
    if (typeof req.body.telegramChatId === "string") {
      user.telegramChatId = req.body.telegramChatId.trim();
    }
    if (user.isModified()) {
      await user.save();
    }

    const artisanId = String(user._id);
    const n8nBase =
      process.env.N8N_TELEGRAM_WEBHOOK_URL || DEFAULT_N8N_TELEGRAM_WEBHOOK;

    const n8nWebhookUrl = new URL(n8nBase.replace("/webhook-test/", "/webhook/"));
    n8nWebhookUrl.searchParams.set("bot_token", botToken);
    n8nWebhookUrl.searchParams.set("artisan_id", artisanId);

    // Clear any previous webhook, then register the n8n production URL.
    await telegramApi(botToken, "deleteWebhook", {
      drop_pending_updates: true,
    });

    const telegramResponse = await telegramApi(botToken, "setWebhook", {
      url: n8nWebhookUrl.toString(),
      drop_pending_updates: true,
      allowed_updates: ["message", "edited_message", "callback_query"],
    });

    const infoResponse = await telegramApi(botToken, "getWebhookInfo");
    const webhookInfo = infoResponse.data?.result || {};

    if (!telegramResponse.data?.ok) {
      return res.status(502).json({
        message:
          telegramResponse.data?.description ||
          webhookInfo.last_error_message ||
          "Telegram rejected the webhook. Activate the n8n workflow, then try again.",
        telegram: telegramResponse.data,
        webhookInfo,
      });
    }

    if (webhookInfo.last_error_message) {
      return res.status(502).json({
        message: `Webhook set, but Telegram reported: ${webhookInfo.last_error_message}. Turn the n8n workflow Active (production URL, not test).`,
        webhookUrl: n8nWebhookUrl.toString(),
        webhookInfo,
      });
    }

    return res.json({
      success: true,
      message: "Telegram bot connected. Send the bot a message to test.",
      artisanId,
      webhookUrl: n8nWebhookUrl.toString(),
      telegram: telegramResponse.data,
      webhookInfo,
    });
  } catch (error) {
    console.error("Telegram setWebhook error:", error.message);
    return res.status(500).json({
      message: error.message || "Failed to connect Telegram bot.",
    });
  }
};

export {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  connectTelegramWebhook,
};