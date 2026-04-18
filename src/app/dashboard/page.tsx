"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Radio,
  RefreshCcw,
  ShieldCheck,
  Waves,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  computeStructuralHealth,
  extractSpectralFeatures,
  type SpectrumPoint,
  type VibrationSample,
  vectorMagnitude,
} from "@/lib/structuralHealth";
import {
  isIncomingVibrationPayload,
  type IncomingVibrationPayload,
} from "@/lib/realtimeTypes";

type HealthState = "healthy" | "vulnerable" | "danger";

type TimeSeriesPoint = {
  time: string;
  x: number;
  y: number;
  z: number;
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAX_TIME_SERIES_POINTS = 180;
const ANALYSIS_WINDOW = 256;

export default function Dashboard() {
  const [seriesData, setSeriesData] = useState<TimeSeriesPoint[]>([]);
  const [fftData, setFftData] = useState<SpectrumPoint[]>([]);
  const [baselineFreq, setBaselineFreq] = useState<number | null>(null);
  const [healthIndex, setHealthIndex] = useState(100);
  const [status, setStatus] = useState<HealthState>("healthy");
  const [isConnected, setIsConnected] = useState(false);
  const [dominantFreq, setDominantFreq] = useState<number | null>(null);
  const [frequencyShift, setFrequencyShift] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [sampleRate, setSampleRate] = useState(0);
  const [sensorId, setSensorId] = useState<string>("-");

  const analysisSamplesRef = useRef<VibrationSample[]>([]);
  const baselineRef = useRef<number | null>(null);

  useEffect(() => {
    baselineRef.current = baselineFreq;
  }, [baselineFreq]);

  useEffect(() => {
    const socket = io();

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("vibration_update", (payload: unknown) => {
      if (!isIncomingVibrationPayload(payload)) return;

      const incoming = payload as IncomingVibrationPayload;
      setSensorId(incoming.sensorId);

      setSeriesData((previous) => {
        const next = [
          ...previous,
          {
            time: new Date(incoming.timestamp).toLocaleTimeString(),
            x: incoming.x,
            y: incoming.y,
            z: incoming.z,
          },
        ];

        return next.slice(-MAX_TIME_SERIES_POINTS);
      });

      analysisSamplesRef.current = [
        ...analysisSamplesRef.current,
        {
          x: incoming.x,
          y: incoming.y,
          z: incoming.z,
          timestamp: incoming.timestamp,
          sensorId: incoming.sensorId,
        },
      ].slice(-ANALYSIS_WINDOW);

      const features = extractSpectralFeatures(analysisSamplesRef.current);
      if (!features) return;

      setFftData(features.spectrum);
      setDominantFreq(features.dominantFreqHz);
      setConfidence(features.confidence);
      setSampleRate(features.sampleRateHz);

      const vibrationIntensity =
        analysisSamplesRef.current.reduce((sum, sample) => sum + Math.abs(vectorMagnitude(sample) - 9.81), 0) /
        analysisSamplesRef.current.length;

      setHealthIndex((previousIndex) => {
        const { healthIndex: nextIndex, status: nextStatus, frequencyShiftHz } = computeStructuralHealth({
          baselineFreqHz: baselineRef.current,
          currentFreqHz: features.dominantFreqHz,
          confidence: features.confidence,
          vibrationIntensity,
          previousIndex,
        });

        setStatus(nextStatus);
        setFrequencyShift(frequencyShiftHz);
        return nextIndex;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const setBaseline = () => {
    if (!dominantFreq) return;
    setBaselineFreq(dominantFreq);
    setHealthIndex(100);
    setFrequencyShift(0);
  };

  const statusBadge = useMemo(() => {
    if (status === "healthy") {
      return (
        <div className="flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full border border-green-500/20">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Status: Optimal</span>
        </div>
      );
    }

    if (status === "vulnerable") {
      return (
        <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full border border-yellow-500/20">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Status: Warning</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-4 py-2 rounded-full border border-red-500/20 animate-pulse">
        <Zap className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-wider">Status: High Risk</span>
      </div>
    );
  }, [status]);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
            <Radio className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Structural Health Monitor</h1>
            <p className="text-zinc-500 text-sm flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
              {isConnected ? `Live Sensor: ${sensorId}` : "Searching for Sensor..."}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] group-hover:bg-blue-500/20 transition-all" />

            <div className="flex justify-between items-start mb-8 text-zinc-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium uppercase tracking-widest">Structural Health Index</span>
              </div>
              <Activity className="w-5 h-5" />
            </div>

            <div className="flex flex-col items-center py-4">
              <div className="relative flex items-center justify-center">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={502}
                    initial={{ strokeDashoffset: 502 }}
                    animate={{ strokeDashoffset: 502 - (502 * healthIndex) / 100 }}
                    className={cn(
                      "transition-colors duration-500",
                      status === "healthy" ? "text-green-500" : status === "vulnerable" ? "text-yellow-500" : "text-red-500"
                    )}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-6xl font-black italic">{healthIndex}%</span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1">Integrity Score</span>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-3">{statusBadge}</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Signal Diagnostics</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-zinc-500">Dominant Freq</div>
                <div className="font-bold text-blue-400">{dominantFreq ? `${dominantFreq.toFixed(2)} Hz` : "--"}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-zinc-500">Frequency Shift</div>
                <div className="font-bold text-purple-400">{frequencyShift.toFixed(2)} Hz</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-zinc-500">Signal Confidence</div>
                <div className="font-bold text-green-400">{(confidence * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-zinc-500">Estimated Fs</div>
                <div className="font-bold text-cyan-400">{sampleRate.toFixed(1)} Hz</div>
              </div>
            </div>

            <button
              onClick={setBaseline}
              disabled={!dominantFreq}
              className="mt-4 w-full flex items-center justify-center gap-2 p-4 bg-blue-600 rounded-2xl hover:bg-blue-500 transition-all font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCcw className="w-5 h-5" />
              Calibrate Baseline
            </button>

            {baselineFreq !== null && (
              <p className="mt-4 text-[10px] text-zinc-600 text-center uppercase tracking-widest">
                Baseline Resonant Frequency: <span className="text-blue-400">{baselineFreq.toFixed(2)} Hz</span>
              </p>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 h-[380px] relative">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <Waves className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-bold">Resonance Time-Series</h3>
              </div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase bg-white/5 px-3 py-1 rounded-lg">Real-time Stream</div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[-20, 20]} stroke="#666" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} itemStyle={{ fontSize: "12px" }} />
                  <Legend />
                  <Line type="monotone" dataKey="x" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} name="X" />
                  <Line type="monotone" dataKey="y" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} name="Y" />
                  <Line type="monotone" dataKey="z" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} name="Z" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 h-[380px]">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-purple-500" />
                <h3 className="text-lg font-bold">Windowed Spectrum (Hann + DFT)</h3>
              </div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase bg-white/5 px-3 py-1 rounded-lg">Frequency Domain</div>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fftData}>
                  <defs>
                    <linearGradient id="colorFreq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                  <XAxis dataKey="freq" tickFormatter={(value) => `${Number(value).toFixed(1)}Hz`} />
                  <YAxis domain={[0, "auto"]} />
                  <Tooltip
                    labelFormatter={(label) => `${Number(label).toFixed(2)}Hz`}
                    contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "12px", fontSize: "12px" }}
                    itemStyle={{ color: "#A855F7" }}
                  />
                  <Area type="stepAfter" dataKey="magnitude" stroke="#A855F7" strokeWidth={2} fillOpacity={1} fill="url(#colorFreq)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 text-[10px] text-zinc-600 uppercase tracking-widest">X-Axis: Frequency (Hz) | Y-Axis: Magnitude</p>
          </div>
        </div>
      </div>
    </div>
  );
}
