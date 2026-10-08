import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Alert,
  Badge,
  Divider,
} from "@mantine/core";
import {
  IconCamera,
  IconArrowLeft,
  IconScan,
  IconInfoCircle,
  IconUpload,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../api/config";
import { readImageFileAsDataUrl } from "../utils/readImageFile";

export function PriceAnalyser() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const cameraDesiredRef = useRef(false);

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  const stopCamera = useCallback(() => {
    cameraDesiredRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      cameraDesiredRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  // Always release camera once results are shown
  useEffect(() => {
    if (prediction) stopCamera();
  }, [prediction, stopCamera]);

  const startCamera = async () => {
    stopCamera();
    setPrediction(null);
    setImage(null);
    cameraDesiredRef.current = true;
    setCameraActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      if (!cameraDesiredRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      cameraDesiredRef.current = false;
      setCameraActive(false);
      alert("Please allow camera access to use this feature.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext("2d");
    context.drawImage(videoRef.current, 0, 0, 640, 480);
    setImage(canvasRef.current.toDataURL("image/jpeg"));
    stopCamera();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      stopCamera();
      setPrediction(null);
      const dataUrl = await readImageFileAsDataUrl(file);
      setImage(dataUrl);
    } catch (error) {
      alert(error.message || "Could not use that photo.");
    }
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

  const analyzePrice = async () => {
    if (!image) return alert("Please capture an image first!");

    stopCamera();
    setLoading(true);
    setPrediction(null);
    try {
      const imageBlob = dataURItoBlob(image);
      const formData = new FormData();
      formData.append("image", imageBlob, "artisan-product.jpg");

      const response = await axios.post(`${API_BASE}/price/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });

      const data = response.data || {};
      const raw = data.raw || data;
      stopCamera();
      setPrediction({
        classification:
          data.classification ||
          raw.classification ||
          data.item ||
          "AI Classification Result",
        suggestedRange:
          data.price_range_text ||
          raw.price_range_text ||
          data.suggestedRange ||
          (raw.min_price != null && raw.max_price != null
            ? `₹${raw.min_price} - ₹${raw.max_price}`
            : null) ||
          "Evaluated in INR",
        matchStatus: data.match_status || raw.match_status || null,
        currency: data.currency || raw.currency || "INR",
        details:
          data.details ||
          raw.details ||
          data.reasoning ||
          "No analysis text returned.",
      });
    } catch (error) {
      console.error("n8n workflow connection error:", error);
      stopCamera();
      alert(
        error?.response?.data?.message ||
          error.message ||
          "Could not process price analysis.",
      );
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    stopCamera();
    navigate("/");
  };

  return (
    <Container size="xs" py="xl">
      <Group mb="xl">
        <ActionIcon variant="subtle" onClick={goBack} color="gray" size="lg">
          <IconArrowLeft size={24} />
        </ActionIcon>
        <Title order={3}>AI Price Analyser</Title>
      </Group>

      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        style={{ display: "none" }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      <Stack gap="md">
        {!image && !cameraActive && !prediction && (
          <Paper withBorder p="xl" radius="lg" ta="center" style={{ borderStyle: "dashed" }}>
            <Stack align="center">
              <IconCamera size={50} color="gray" />
              <Text fw={500}>Scan your product</Text>
              <Text size="xs" c="dimmed">
                Take a live photo or upload one from your device
              </Text>
              <Group grow w="100%" mt="sm">
                <Button
                  color="orange"
                  radius="md"
                  onClick={startCamera}
                  leftSection={<IconCamera size={18} />}
                >
                  Take Photo
                </Button>
                <Button
                  variant="light"
                  color="orange"
                  radius="md"
                  onClick={handleUploadClick}
                  leftSection={<IconUpload size={18} />}
                >
                  Upload Photo
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}

        {cameraActive && (
          <Stack>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                borderRadius: "12px",
                transform: "scaleX(-1)",
              }}
            />
            <Button
              color="orange"
              size="lg"
              radius="xl"
              onClick={capturePhoto}
              leftSection={<IconScan size={20} />}
            >
              Capture Product
            </Button>
            <Button variant="subtle" color="gray" onClick={handleUploadClick}>
              Upload instead
            </Button>
          </Stack>
        )}

        {image && !loading && !prediction && (
          <Stack>
            <Image src={image} radius="md" />
            <Button color="orange" onClick={analyzePrice}>
              Analyse Price
            </Button>
            <Group grow>
              <Button
                variant="light"
                color="gray"
                onClick={() => {
                  setImage(null);
                  startCamera();
                }}
              >
                Retake
              </Button>
              <Button variant="light" color="orange" onClick={handleUploadClick}>
                Upload another
              </Button>
            </Group>
          </Stack>
        )}

        {loading && (
          <Paper withBorder p="xl" radius="md" ta="center">
            <Loader color="orange" size="lg" mb="sm" />
            <Text fw={500}>AI is studying your product...</Text>
          </Paper>
        )}

        {prediction && (
          <Paper
            withBorder
            p="xl"
            radius="lg"
            shadow="md"
            style={{ borderTop: "4px solid orange" }}
          >
            <Stack>
              <Group justify="space-between">
                <Text size="sm" fw={700} c="dimmed">
                  PREDICTION RESULT
                </Text>
                {prediction.matchStatus && (
                  <Badge
                    color={
                      String(prediction.matchStatus).toUpperCase() === "MATCH"
                        ? "green"
                        : "orange"
                    }
                  >
                    {prediction.matchStatus}
                  </Badge>
                )}
              </Group>
              <Title order={4}>{prediction.classification}</Title>
              <Divider />
              <Group justify="space-between" align="flex-start">
                <Text fw={600}>Market Price Range:</Text>
                <Stack gap={0} align="flex-end">
                  <Text size="xl" fw={900} c="orange">
                    {prediction.suggestedRange}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {prediction.currency}
                  </Text>
                </Stack>
              </Group>
              <Alert icon={<IconInfoCircle size={16} />} color="blue" radius="md">
                {prediction.details}
              </Alert>
              <Button
                fullWidth
                variant="light"
                color="orange"
                onClick={() => {
                  stopCamera();
                  setPrediction(null);
                  setImage(null);
                }}
              >
                Scan Another Item
              </Button>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
