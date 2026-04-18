export type IncomingVibrationPayload = {
  x: number;
  y: number;
  z: number;
  timestamp: number;
  sensorId: string;
};

export const isIncomingVibrationPayload = (value: unknown): value is IncomingVibrationPayload => {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;

  return (
    typeof payload.sensorId === "string" &&
    payload.sensorId.length > 0 &&
    typeof payload.timestamp === "number" &&
    Number.isFinite(payload.timestamp) &&
    typeof payload.x === "number" &&
    Number.isFinite(payload.x) &&
    typeof payload.y === "number" &&
    Number.isFinite(payload.y) &&
    typeof payload.z === "number" &&
    Number.isFinite(payload.z)
  );
};
