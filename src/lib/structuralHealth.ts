export type VibrationSample = {
  x: number;
  y: number;
  z: number;
  timestamp: number;
  sensorId?: string;
};

export type SpectrumPoint = {
  freq: number;
  magnitude: number;
};

export type SpectralFeatures = {
  dominantFreqHz: number;
  dominantMagnitude: number;
  spectralEnergy: number;
  confidence: number;
  sampleRateHz: number;
  spectrum: SpectrumPoint[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const safeNumber = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

export const vectorMagnitude = (sample: Pick<VibrationSample, "x" | "y" | "z">) => {
  const x = safeNumber(sample.x);
  const y = safeNumber(sample.y);
  const z = safeNumber(sample.z);
  return Math.sqrt(x * x + y * y + z * z);
};

export const removeDcComponent = (values: number[]) => {
  if (values.length === 0) return values;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map((value) => value - mean);
};

export const hannWindow = (values: number[]) => {
  const n = values.length;
  if (n <= 1) return values;

  return values.map((value, index) => {
    const coefficient = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (n - 1)));
    return value * coefficient;
  });
};

const estimateSampleRate = (timestamps: number[]) => {
  if (timestamps.length < 2) return 50;

  const deltasMs: number[] = [];
  for (let i = 1; i < timestamps.length; i += 1) {
    const delta = timestamps[i] - timestamps[i - 1];
    if (delta > 0 && Number.isFinite(delta)) deltasMs.push(delta);
  }

  if (deltasMs.length === 0) return 50;

  deltasMs.sort((a, b) => a - b);
  const median = deltasMs[Math.floor(deltasMs.length / 2)];
  return clamp(1000 / median, 1, 200);
};

export const computeSpectrum = (values: number[], sampleRateHz: number): SpectrumPoint[] => {
  const n = values.length;
  if (n < 8) return [];

  const half = Math.floor(n / 2);
  const spectrum: SpectrumPoint[] = [];

  for (let k = 1; k < half; k += 1) {
    let re = 0;
    let im = 0;

    for (let t = 0; t < n; t += 1) {
      const angle = (2 * Math.PI * k * t) / n;
      re += values[t] * Math.cos(angle);
      im -= values[t] * Math.sin(angle);
    }

    const magnitude = Math.sqrt(re * re + im * im) / n;
    const freq = (k * sampleRateHz) / n;
    spectrum.push({ freq, magnitude });
  }

  return spectrum;
};

export const extractSpectralFeatures = (
  samples: VibrationSample[],
  frequencyBand: { minHz: number; maxHz: number } = { minHz: 0.2, maxHz: 30 }
): SpectralFeatures | null => {
  if (samples.length < 32) return null;

  const timestamps = samples.map((sample) => sample.timestamp);
  const sampleRateHz = estimateSampleRate(timestamps);

  const magnitudeSeries = samples.map((sample) => vectorMagnitude(sample));
  const centered = removeDcComponent(magnitudeSeries);
  const windowed = hannWindow(centered);
  const spectrum = computeSpectrum(windowed, sampleRateHz).filter(
    (point) => point.freq >= frequencyBand.minHz && point.freq <= frequencyBand.maxHz
  );

  if (spectrum.length === 0) return null;

  let dominant = spectrum[0];
  let energy = 0;

  for (const point of spectrum) {
    energy += point.magnitude * point.magnitude;
    if (point.magnitude > dominant.magnitude) dominant = point;
  }

  const dominantPower = dominant.magnitude * dominant.magnitude;
  const confidence = clamp(dominantPower / Math.max(energy, 1e-9), 0, 1);

  return {
    dominantFreqHz: dominant.freq,
    dominantMagnitude: dominant.magnitude,
    spectralEnergy: energy,
    confidence,
    sampleRateHz,
    spectrum,
  };
};

export const computeStructuralHealth = (args: {
  baselineFreqHz: number | null;
  currentFreqHz: number;
  confidence: number;
  vibrationIntensity: number;
  previousIndex: number;
}) => {
  const { baselineFreqHz, currentFreqHz, confidence, vibrationIntensity, previousIndex } = args;

  if (baselineFreqHz === null) {
    return {
      healthIndex: 100,
      frequencyShiftHz: 0,
      status: "healthy" as const,
    };
  }

  const frequencyShiftHz = Math.abs(currentFreqHz - baselineFreqHz);

  const shiftPenalty = clamp((frequencyShiftHz / Math.max(baselineFreqHz, 0.5)) * 140, 0, 90);
  const intensityPenalty = clamp(vibrationIntensity * 0.8, 0, 25);
  const confidencePenalty = clamp((1 - confidence) * 12, 0, 12);

  const rawTarget = clamp(100 - shiftPenalty - intensityPenalty - confidencePenalty, 1, 100);
  const healthIndex = Math.round(previousIndex * 0.9 + rawTarget * 0.1);

  const status: "healthy" | "vulnerable" | "danger" =
    healthIndex >= 80 ? "healthy" : healthIndex >= 50 ? "vulnerable" : "danger";

  return {
    healthIndex,
    frequencyShiftHz,
    status,
  };
};
