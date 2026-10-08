import React, { useState, useEffect } from "react";
import {
  Container,
  TextInput,
  Button,
  Title,
  Paper,
  Group,
  ActionIcon,
  Stack,
  Text,
  Alert,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconBrandTelegram,
  IconDeviceFloppy,
  IconInfoCircle,
  IconPlugConnected,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

function readUserInfo() {
  try {
    return JSON.parse(localStorage.getItem("userInfo") || "null");
  } catch {
    return null;
  }
}

export function ArtisanSettings() {
  const navigate = useNavigate();
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userInfo, setUserInfo] = useState(() => readUserInfo());

  useEffect(() => {
    const loadProfile = async () => {
      const stored = readUserInfo();
      if (!stored?.token) {
        setLoadingProfile(false);
        return;
      }

      // Show cached values immediately so fields aren't blank while fetching
      setTelegramBotToken(stored.telegramBotToken || "");
      setTelegramChatId(stored.telegramChatId || "");

      try {
        const res = await API.get("/users/profile");

        const tokenValue =
          res.data?.telegramBotToken ?? stored.telegramBotToken ?? "";
        const chatIdValue =
          res.data?.telegramChatId ?? stored.telegramChatId ?? "";

        setTelegramBotToken(tokenValue);
        setTelegramChatId(chatIdValue);

        const merged = {
          ...stored,
          ...res.data,
          token: stored.token, // keep JWT — don't overwrite with Mongo fields
          telegramBotToken: tokenValue,
          telegramChatId: chatIdValue,
        };
        localStorage.setItem("userInfo", JSON.stringify(merged));
        setUserInfo(merged);
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    const token = telegramBotToken.trim();
    const chatId = telegramChatId.trim();

    if (!token) {
      alert("Please paste your Telegram bot access token");
      return;
    }

    if (!chatId) {
      alert("Please enter your Telegram Chat ID");
      return;
    }

    // BotFather tokens look like: 123456:ABC-DEF...
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      alert(
        "That doesn’t look like a Telegram bot token. Get one from @BotFather (format: 123456:ABC...).",
      );
      return;
    }

    if (!userInfo?.token) {
      alert("Please log in again");
      return;
    }

    setLoading(true);
    try {
      const res = await API.put("/users/profile", {
        telegramBotToken: token,
        telegramChatId: chatId,
      });

      const savedToken = res.data?.telegramBotToken || token;
      const savedChatId = res.data?.telegramChatId || chatId;

      setTelegramBotToken(savedToken);
      setTelegramChatId(savedChatId);

      const updatedUser = {
        ...userInfo,
        ...res.data,
        token: res.data.token || userInfo.token,
        telegramBotToken: savedToken,
        telegramChatId: savedChatId,
      };
      localStorage.setItem("userInfo", JSON.stringify(updatedUser));
      setUserInfo(updatedUser);
      alert("Telegram settings saved! Alerts will use this bot + chat.");
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectN8n = async () => {
    const token = telegramBotToken.trim();
    const chatId = telegramChatId.trim();

    if (!token) {
      alert("Please paste your Telegram bot access token first.");
      return;
    }

    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      alert(
        "That doesn’t look like a Telegram bot token. Get one from @BotFather (format: 123456:ABC...).",
      );
      return;
    }

    if (!userInfo?.token) {
      alert("Please log in again");
      return;
    }

    setConnecting(true);
    try {
      const res = await API.post("/users/telegram/connect", {
        telegramBotToken: token,
        telegramChatId: chatId,
      });

      const info = res.data?.webhookInfo;
      const extra = info?.url ? `\n\nTelegram is sending updates to:\n${info.url}` : "";
      alert((res.data?.message || "Telegram bot connected to n8n.") + extra);
    } catch (error) {
      console.error(error);
      const data = error?.response?.data;
      const telegramError =
        data?.webhookInfo?.last_error_message ||
        data?.telegram?.description ||
        data?.message ||
        "Could not connect the Telegram bot to n8n.";
      alert(telegramError);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Container size="xs" py="xl">
      <Group mb="xl">
        <ActionIcon
          variant="subtle"
          onClick={() => navigate("/")}
          color="gray"
          size="lg"
        >
          <IconArrowLeft size={24} />
        </ActionIcon>
        <Title order={3}>Settings</Title>
      </Group>

      <Stack gap="md">
        <Alert
          icon={<IconInfoCircle size={16} />}
          title="Telegram Alerts"
          color="blue"
        >
          Add your{" "}
          <Text span fw={700}>
            @BotFather
          </Text>{" "}
          access token and Chat ID. n8n will use both to send refill and update
          alerts to your Telegram.
        </Alert>

        <Paper withBorder p="xl" radius="lg" shadow="sm">
          <Stack gap="md">
            <Group gap="xs">
              <IconBrandTelegram color="#229ED9" />
              <Text fw={600}>Telegram Bot Connection</Text>
            </Group>

            <TextInput
              label="Bot Access Token"
              description="From Telegram → @BotFather → your bot → API Token"
              placeholder="123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.currentTarget.value)}
              size="md"
              radius="md"
              disabled={loadingProfile}
              autoComplete="off"
            />

            <TextInput
              label="Chat ID"
              description="Your Telegram chat ID (from @userinfobot or getUpdates)"
              placeholder="e.g. 123456789"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.currentTarget.value)}
              size="md"
              radius="md"
              disabled={loadingProfile}
              autoComplete="off"
            />

            <Button
              fullWidth
              color="orange"
              size="lg"
              mt="md"
              radius="md"
              loading={loading || loadingProfile}
              leftSection={<IconDeviceFloppy size={20} />}
              onClick={handleSave}
            >
              Save Telegram Settings
            </Button>

            <Button
              fullWidth
              variant="light"
              color="blue"
              size="lg"
              radius="md"
              loading={connecting || loadingProfile}
              leftSection={<IconPlugConnected size={20} />}
              onClick={handleConnectN8n}
            >
              Connect Bot to n8n
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
