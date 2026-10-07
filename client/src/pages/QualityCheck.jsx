import React, { useState, useRef } from "react";
import {
  Container,
  Title,
  Text,
  Button,
  Paper,
  Stack,
  Group,
  ActionIcon,
  Image,
  Loader,
  Badge,
  RingProgress,
  List,
  ThemeIcon,
} from "@mantine/core";
import {
  IconCamera,
  IconArrowLeft,
  IconScan,
  IconCircleCheck,
  IconBulb,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../api/config";

export function QualityCheck() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = async () => {
    setCameraActive(true);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access denied.");
    }
  };

  const capturePhoto = () => {
    const context = canvasRef.current.getContext("2d");
    context.drawImage(videoRef.current, 0, 0, 640, 480);
    setImage(canvasRef.current.toDataURL("image/jpeg"));

    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    setCameraActive(false);
  };

  const dataURItoBlob = (dataURI) => {
    const byteString = atob(dataURI.split(",")[1]);
    const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  const toUiResult = (payload) => {
    const numericalScoreVal = Math.min(
      Math.max(Math.round(Number(payload.quality_score) || 5), 0),
      10,
    );

    let statusColor = "green";
    if (numericalScoreVal <= 4) statusColor = "orange";
    else if (numericalScoreVal <= 7) statusColor = "blue";

    return {
      percentageValue: numericalScoreVal * 10,
      displayScore: numericalScoreVal,
      status: payload.quality_label || "Quality Assessed",
      color: statusColor,
      observations: Array.isArray(payload.observations)
        ? payload.observations
        : [],
      improvementTips: Array.isArray(payload.improvement_tips)
        ? payload.improvement_tips
        : [],
    };
  };

  const runQualityCheck = async () => {
    if (!image) return alert("Please capture an image first!");

    setLoading(true);
    setResult(null);
    try {
      const imageBlob = dataURItoBlob(image);
      const formData = new FormData();
      formData.append("image", imageBlob, "artisan-product-qc.jpg");

      const response = await axios.post(`${API_BASE}/quality/check`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });

      console.log("Normalized QC response:", response.data);
      setResult(toUiResult(response.data));
    } catch (error) {
      console.error("Quality Check error:", error);
      const message =
        error?.response?.data?.message ||
        error.message ||
        "Quality check failed.";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xs" py="xl">
      <Group mb="xl">
        <ActionIcon variant="subtle" onClick={() => navigate("/")} color="gray">
          <IconArrowLeft size={24} />
        </ActionIcon>
        <Title order={3}>AI Quality Check</Title>
      </Group>

      {!image && !cameraActive && (
        <Paper
          withBorder
          p="xl"
          radius="lg"
          ta="center"
          onClick={startCamera}
          style={{ borderStyle: "dashed", cursor: "pointer" }}
        >
          <Stack align="center">
            <IconScan size={50} color="orange" />
            <Text fw={700}>Scan Product for Feedback</Text>
            <Text size="xs" c="dimmed">
              AI will rate your finish and suggest improvements
            </Text>
          </Stack>
        </Paper>
      )}

      {cameraActive && (
        <Stack>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: "100%", borderRadius: "16px" }}
          />
          <Button
            color="orange"
            size="lg"
            radius="xl"
            onClick={capturePhoto}
            leftSection={<IconCamera size={20} />}
          >
            Capture for Analysis
          </Button>
          <canvas
            ref={canvasRef}
            width="640"
            height="480"
            style={{ display: "none" }}
          />
        </Stack>
      )}

      {image && !loading && !result && (
        <Stack>
          <Image src={image} radius="md" />
          <Button color="orange" size="md" onClick={runQualityCheck}>
            Run AI Audit
          </Button>
          <Button
            variant="subtle"
            color="gray"
            onClick={() => {
              setImage(null);
              startCamera();
            }}
          >
            Retake
          </Button>
        </Stack>
      )}

      {loading && (
        <Paper p="xl" ta="center">
          <Loader color="orange" size="lg" />
          <Text mt="md" fw={600}>
            Analyzing textures and symmetry...
          </Text>
        </Paper>
      )}

      {result && (
        <Stack>
          <Image src={image} radius="md" mah={220} fit="contain" />

          <Paper withBorder p="lg" radius="lg" shadow="sm">
            <Group justify="center">
              <RingProgress
                size={120}
                roundCaps
                thickness={12}
                sections={[
                  { value: result.percentageValue, color: result.color },
                ]}
                label={
                  <Text ta="center" fw={900} size="xl">
                    {result.displayScore}
                    <Text span size="xs" c="dimmed" display="block">
                      /10
                    </Text>
                  </Text>
                }
              />
              <Stack gap={4}>
                <Text fw={700} size="lg">
                  Quality Score
                </Text>
                <Badge color={result.color} variant="light" size="lg">
                  {result.status}
                </Badge>
              </Stack>
            </Group>
          </Paper>

          {result.observations?.length > 0 && (
            <Paper withBorder p="lg" radius="lg" bg="var(--mantine-color-gray-0)">
              <Group mb="md">
                <ThemeIcon color={result.color} variant="light" radius="xl">
                  <IconCircleCheck size={16} />
                </ThemeIcon>
                <Text fw={700}>Observations</Text>
              </Group>
              <List spacing="sm" size="sm">
                {result.observations.map((item, i) => (
                  <List.Item key={`obs-${i}`}>{item}</List.Item>
                ))}
              </List>
            </Paper>
          )}

          {result.improvementTips?.length > 0 && (
            <Paper
              withBorder
              p="lg"
              radius="lg"
              bg="var(--mantine-color-orange-0)"
            >
              <Group mb="md">
                <IconBulb color="orange" />
                <Text fw={700}>Improvement Tips</Text>
              </Group>
              <List spacing="sm" size="sm">
                {result.improvementTips.map((tip, i) => (
                  <List.Item key={`tip-${i}`}>{tip}</List.Item>
                ))}
              </List>
            </Paper>
          )}

          <Button
            fullWidth
            variant="light"
            color="orange"
            onClick={() => {
              setResult(null);
              setImage(null);
            }}
          >
            Scan New Item
          </Button>
        </Stack>
      )}
    </Container>
  );
}
