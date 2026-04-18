"use client";

import { useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type PermissionState = "unknown" | "granted" | "denied";

const buildSensorId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `sensor-${crypto.randomUUID().slice(0, 8)}`;
  }

  return `sensor-${Date.now().toString(36)}`;
};

export default function SensorPage() {
  const [status, setStatus] = useState("READY");
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sensorId] = useState(() => {
    if (typeof window === "undefined") return "sensor-pending";

    const fromStorage = window.localStorage.getItem("sensor_id");
    if (fromStorage) return fromStorage;

    const generated = buildSensorId();
    window.localStorage.setItem("sensor_id", generated);
    return generated;
  });

  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  const ensureSocket = () => {
    if (socketRef.current) return socketRef.current;
    const socket = io();
    socketRef.current = socket;
    return socket;
  };

  const requestMotionPermission = async () => {
    const deviceEvent = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof deviceEvent.requestPermission === "function") {
      const response = await deviceEvent.requestPermission();
      if (response !== "granted") {
        setPermissionState("denied");
        throw new Error("Motion permission denied");
      }
    }

    setPermissionState("granted");
  };

  const startStreaming = async () => {
    try {
      if (!("DeviceMotionEvent" in window)) {
        setStatus("DeviceMotion API unavailable");
        return;
      }

      await requestMotionPermission();

      const socket = ensureSocket();
      setStatus(`Streaming from ${sensorId}`);
      setIsStreaming(true);

      const handler = (event: DeviceMotionEvent) => {
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;

        const nextX = acc.x ?? 0;
        const nextY = acc.y ?? 0;
        const nextZ = acc.z ?? 0;

        setX(nextX);
        setY(nextY);
        setZ(nextZ);

        socket.emit("vibration_data", {
          x: nextX,
          y: nextY,
          z: nextZ,
          timestamp: Date.now(),
          sensorId,
        });
      };

      window.addEventListener("devicemotion", handler, true);
    } catch (error) {
      setIsStreaming(false);
      setStatus(error instanceof Error ? error.message : "Unable to start sensor stream");
    }
  };

  return (
    <main style={{ backgroundColor: "#000", color: "#fff", minHeight: "100vh", padding: "24px", fontFamily: "monospace" }}>
      <h1 style={{ color: "#0070f3" }}>STRUCTURAL SENSOR NODE</h1>

      <p style={{ marginBottom: "8px" }}>Sensor ID: {sensorId}</p>
      <p style={{ marginBottom: "16px", color: permissionState === "denied" ? "#ef4444" : "#22c55e" }}>
        Motion Permission: {permissionState.toUpperCase()}
      </p>

      <div style={{ padding: "16px", border: "1px solid #0f0", marginBottom: "20px" }}>
        <strong>STATUS:</strong> {status}
      </div>

      <button
        type="button"
        onClick={startStreaming}
        disabled={isStreaming || sensorId === "sensor-pending"}
        style={{
          width: "100%",
          height: "88px",
          fontSize: "22px",
          fontWeight: "bold",
          background: isStreaming ? "#14532d" : "#0070f3",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          opacity: isStreaming ? 0.7 : 1,
        }}
      >
        {isStreaming ? "STREAMING ACTIVE" : "START SENSING"}
      </button>

      <div style={{ fontSize: "28px", marginTop: "32px" }}>
        <p>X: {x.toFixed(2)}</p>
        <p>Y: {y.toFixed(2)}</p>
        <p>Z: {z.toFixed(2)}</p>
      </div>
    </main>
  );
}
