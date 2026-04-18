# Structural Health Index from Passive Vibration Sensing

This project implements a real-time structural health monitoring prototype for **Problem 04**:

> Build a system that processes passive vibration time-series data from low-cost accelerometers to compute a structural health index and detect resonant frequency shifts correlated with fatigue.

## What this version now includes

- **Realtime ingestion + broadcast** over Socket.IO.
- **Signal quality controls** with payload sanitization and lightweight rate limiting.
- **Windowed spectral analysis** (DC removal + Hann window + DFT).
- **Dominant frequency tracking** in a configurable structural band.
- **Structural Health Index (SHI)** based on baseline resonance drift, intensity, and confidence.
- **Sensor identity + timestamps** for traceability.
- **Mobile-friendly sensor publisher page** with permission handling.

## Architecture

- `server.mjs` — custom Next.js + Socket.IO server, sanitization, CORS config, rate limits.
- `src/app/dashboard/page.tsx` — operator dashboard, time-series and spectral plots, SHI gauge.
- `src/app/sensor/page.tsx` — browser sensor node publisher.
- `public/sensor.html` — static low-overhead sensor publisher fallback.
- `src/lib/structuralHealth.ts` — DSP + SHI logic.
- `src/lib/realtimeTypes.ts` — realtime payload shape guards.

## Run locally

```bash
npm install
npm run dev
```

Open:

- Dashboard: `http://localhost:3000/dashboard`
- Sensor UI (Next page): `http://localhost:3000/sensor`
- Sensor UI (static fallback): `http://localhost:3000/sensor.html`

## Data model

Vibration payload sent from sensor clients:

```json
{
  "x": 0.12,
  "y": -0.30,
  "z": 9.61,
  "timestamp": 1760000000000,
  "sensorId": "sensor-a1b2c3"
}
```

## SHI approach (heuristic baseline)

1. Convert tri-axial acceleration to vector magnitude.
2. Remove DC component (gravity drift).
3. Apply Hann window.
4. Compute DFT magnitude spectrum.
5. Find dominant resonance frequency in [0.2Hz, 30Hz].
6. Compute SHI using:
   - normalized frequency shift from calibrated baseline,
   - vibration intensity penalty,
   - low-confidence penalty.
7. Smooth score with EMA for stability.

## Next improvements (recommended)

- Replace DFT with overlap-windowed Welch PSD for better noise robustness.
- Add persistent storage for trend analysis.
- Add anomaly alerts on sustained drift patterns.
- Add per-asset baselines and environmental normalization (temperature/time-of-day).
- Add authentication and per-sensor authorization.

## Quality checks

```bash
npm run lint
npm run build
```
