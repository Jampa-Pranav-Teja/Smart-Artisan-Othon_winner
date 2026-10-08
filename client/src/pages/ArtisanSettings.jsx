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
  PasswordInput,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconBrandTelegram,
  IconDeviceFloppy,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../api/config";

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
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(() => readUserInfo());

  useEffect(() => {
    const loadProfile = async () => {
      const stored = readUserInfo();
      if (!stored?.token) return;

      if (stored.telegramBotToken) {
        setTelegramBotToken(stored.telegramBotToken);
      }

      try {
        const res = await axios.get(`${API_BASE}/users/profile`, {
          headers: { Authorization: `Bearer ${stored.token}` },
        });
        const tokenValue = res.data?.telegramBotToken || "";
        setTelegramBotToken(tokenValue);
        const merged = { ...stored, ...res.data, token: stored.token };
        localStorage.setItem("userInfo", JSON.stringify(merged));
        setUserInfo(merged);
      } catch (error) {
        console.error("Failed to load profile:", error);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    const token = telegramBotToken.trim();
    if (!token) {
      alert("Please paste your Telegram bot access token");
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
      const res = await axios.put(
        `${API_BASE}/users/profile`,
        { telegramBotToken: token },
        { headers: { Authorization: `Bearer ${userInfo.token}` } },
      );

      const updatedUser = {
        ...userInfo,
        ...res.data,
        token: res.data.token || userInfo.token,
        telegramBotToken: res.data.telegramBotToken || token,
      };
      localStorage.setItem("userInfo", JSON.stringify(updatedUser));
      setUserInfo(updatedUser);
      alert("Telegram bot token saved! You’ll get alert updates on that bot.");
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
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
          Paste the access token from{" "}
          <Text span fw={700}>
            @BotFather
          </Text>
          . Your artisan updates and alerts will be sent through this bot via
          n8n automation.
        </Alert>

        <Paper withBorder p="xl" radius="lg" shadow="sm">
          <Stack gap="md">
            <Group gap="xs">
              <IconBrandTelegram color="#229ED9" />
              <Text fw={600}>Telegram Bot Connection</Text>
            </Group>

            <PasswordInput
              label="Bot Access Token"
              description="From Telegram → @BotFather → your bot → API Token"
              placeholder="123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.currentTarget.value.trim())}
              size="md"
              radius="md"
              visibilityToggle
            />

            <Button
              fullWidth
              color="orange"
              size="lg"
              mt="md"
              radius="md"
              loading={loading}
              leftSection={<IconDeviceFloppy size={20} />}
              onClick={handleSave}
            >
              Save Telegram Token
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
