#!/usr/bin/env bash
# =============================================================================
# generate-ambient.sh
#
# Generates a procedural ambient drone track using sox when no music file
# is available. Produces a layered, evolving pad suitable for tech demos.
#
# Requirements:
#   brew install sox
#
# Usage:
#   chmod +x generate-ambient.sh
#   ./generate-ambient.sh [--duration 360] [--out ambient.wav]
#
# Sound design:
#   Layer 1 — 60 Hz  sine: sub bass foundation
#   Layer 2 — 80 Hz  sine: bass warmth
#   Layer 3 — 120 Hz sine: low mid body
#   Layer 4 — 240 Hz sine: mid presence
#   Layer 5 — 480 Hz sine: upper mid air
#   Layer 6 — LFO-modulated noise: subtle texture / shimmer
#
# All layers are mixed at low amplitude, fade in/out applied, and the
# result is normalised to -18 LUFS so it sits comfortably under voiceover.
# =============================================================================

set -euo pipefail

DURATION=360   # seconds
OUT="ambient.wav"
SAMPLE_RATE=44100

while [[ $# -gt 0 ]]; do
  case "$1" in
    --duration) DURATION="$2"; shift 2 ;;
    --out)      OUT="$2";      shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if ! command -v sox &>/dev/null; then
  echo "ERROR: sox not installed. Run: brew install sox"
  exit 1
fi

FADE_IN=5
FADE_OUT=10

echo "==> Generating ambient drone: ${DURATION}s → ${OUT}"

# ── Layer 1: Sub + bass drone ──────────────────────────────────────────────
# Two sine waves (60 Hz, 80 Hz) mixed via remix into a stereo signal,
# then fade applied. Very subtle — just enough to feel "grounded."
sox -n -r $SAMPLE_RATE -c 2 /tmp/layer_bass.wav \
  synth $DURATION \
    sine 60 \
    sine 80 \
  remix - \
  vol 0.18 \
  fade $FADE_IN $DURATION $FADE_OUT

# ── Layer 2: Mid drone ─────────────────────────────────────────────────────
# 120 Hz + 240 Hz add body. Slight detuning between channels (+1 Hz) creates
# a gentle stereo width effect.
sox -n -r $SAMPLE_RATE -c 2 /tmp/layer_mid.wav \
  synth $DURATION \
    sine 120 \
    sine 121 \
  remix - \
  vol 0.12 \
  fade $FADE_IN $DURATION $FADE_OUT

# ── Layer 3: Upper harmonic air ────────────────────────────────────────────
# 480 Hz sine adds sparkle; 960 Hz sine is the octave shimmer.
sox -n -r $SAMPLE_RATE -c 2 /tmp/layer_air.wav \
  synth $DURATION \
    sine 480 \
    sine 960 \
  remix - \
  vol 0.06 \
  fade $FADE_IN $DURATION $FADE_OUT

# ── Layer 4: Slow LFO noise pad ───────────────────────────────────────────
# Band-passed white noise creates a "breath" texture.
# synth brownnoise is smoother than whitenoise for pads.
sox -n -r $SAMPLE_RATE -c 2 /tmp/layer_noise.wav \
  synth $DURATION \
    brownnoise \
  bandpass 300 200 \
  vol 0.04 \
  fade $FADE_IN $DURATION $FADE_OUT

# ── Mix all layers ─────────────────────────────────────────────────────────
sox -m \
  /tmp/layer_bass.wav \
  /tmp/layer_mid.wav \
  /tmp/layer_air.wav \
  /tmp/layer_noise.wav \
  /tmp/ambient_raw.wav

# ── Normalise to -18 LUFS (comfortable ducking headroom) ─────────────────
# sox norm sets peak to 0 dBFS; we pull back to -18 dB for mixing headroom.
sox /tmp/ambient_raw.wav "$OUT" norm -18

# ── Clean up temp files ────────────────────────────────────────────────────
rm -f /tmp/layer_bass.wav /tmp/layer_mid.wav /tmp/layer_air.wav \
      /tmp/layer_noise.wav /tmp/ambient_raw.wav

FILESIZE=$(du -sh "$OUT" | cut -f1)
echo "==> Written: $OUT ($FILESIZE)"
echo "    Duration: ${DURATION}s | Sample rate: ${SAMPLE_RATE} Hz | Stereo"
echo ""
echo "Tip: loop this track in mix-audio.js using ffmpeg's -stream_loop -1 flag."
