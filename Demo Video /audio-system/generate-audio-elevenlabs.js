#!/usr/bin/env node
/**
 * generate-audio-elevenlabs.js
 *
 * Reads script.json, renders every voiceover scene via the ElevenLabs
 * Text-to-Speech REST API, saves each scene as a WAV file, and writes
 * audio-manifest.json with accurate durations measured by ffprobe.
 *
 * Installation:
 *   npm install node-fetch@3 dotenv
 *   # node-fetch v3 is ESM; this file is CommonJS — we use dynamic import().
 *   # Or: pin to node-fetch@2 and use require() directly.
 *
 * Environment:
 *   ELEVENLABS_API_KEY=your_key_here   (or set in .env)
 *
 * Usage:
 *   node generate-audio-elevenlabs.js [--voice rachel] [--out ./audio]
 *
 * ── Voice Reference ──────────────────────────────────────────────────────────
 *   Alias      │ Voice ID                       │ Style
 *   -----------│--------------------------------│-----------------------------
 *   rachel     │ 21m00Tcm4TlvDq8ikWAM           │ Warm, professional (F)
 *   adam       │ pNInz6obpgDQGcFmaJgB           │ Authoritative (M)
 *   antoni     │ ErXwobaYiN019PkySvjV           │ Well-rounded (M)
 *   josh       │ TxGEqnHWrfWFTfGW9XjX           │ Deep, confident (M)
 *   arnold     │ VR6AewLTigWG4xSOukaG           │ Crisp, narrative (M)
 *   bella      │ EXAVITQu4vr4xnSDxMaL           │ Soft, natural (F)
 * =============================================================================
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

// Load .env if present
try { require("dotenv").config(); } catch (_) { /* dotenv optional */ }

// ── CLI argument parsing ───────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const VOICE_ALIAS  = getArg("--voice",  "rachel");
const SCRIPT_PATH  = getArg("--script", "./script.json");
const OUT_DIR      = getArg("--out",    "./audio");
const MANIFEST_OUT = getArg("--manifest", "./audio-manifest.json");

// ── Voice ID map ───────────────────────────────────────────────────────────
const VOICE_IDS = {
  rachel:  "21m00Tcm4TlvDq8ikWAM",
  adam:    "pNInz6obpgDQGcFmaJgB",
  antoni:  "ErXwobaYiN019PkySvjV",
  josh:    "TxGEqnHWrfWFTfGW9XjX",
  arnold:  "VR6AewLTigWG4xSOukaG",
  bella:   "EXAVITQu4vr4xnSDxMaL",
};

const VOICE_ID = VOICE_IDS[VOICE_ALIAS.toLowerCase()]
  || (() => { throw new Error(`Unknown voice alias: ${VOICE_ALIAS}. Available: ${Object.keys(VOICE_IDS).join(", ")}`); })();

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("ERROR: ELEVENLABS_API_KEY is not set.");
  console.error("  export ELEVENLABS_API_KEY=your_key");
  console.error("  or create a .env file with ELEVENLABS_API_KEY=your_key");
  process.exit(1);
}

// ── ElevenLabs voice settings ──────────────────────────────────────────────
const VOICE_SETTINGS = {
  stability:        0.55,   // 0–1: lower = more expressive, higher = more consistent
  similarity_boost: 0.75,   // 0–1: how closely to match the reference voice
  style:            0.20,   // 0–1: style exaggeration (v2 models only)
  use_speaker_boost: true,
};

// Use the highest-quality model for production output.
const MODEL_ID = "eleven_multilingual_v2";

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── ElevenLabs TTS call ────────────────────────────────────────────────────
/**
 * Call the ElevenLabs TTS endpoint and save the response as a WAV file.
 * ElevenLabs returns MP3 by default; we request pcm_44100 (raw PCM) and
 * wrap it into a proper WAV file ourselves so ffprobe can read duration.
 *
 * @param {string} text       - Narration text
 * @param {string} outputPath - Absolute path to write the .wav
 */
async function renderWithElevenLabs(text, outputPath) {
  // Dynamic import for node-fetch v3 (ESM-only)
  const { default: fetch } = await import("node-fetch");

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key":   API_KEY,
      "Content-Type": "application/json",
      // Request PCM output at 44100 Hz so we can wrap it as WAV without
      // an MP3 decode step. Alternatively use "mp3_44100_128" and transcode.
      "Accept":       "audio/mpeg",  // fallback to mp3 if pcm not available on plan
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
      // output_format: "pcm_44100",  // uncomment for Creator plan+
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
  }

  // Write the raw MP3 buffer to a temp file, then convert to WAV via ffmpeg
  const tempMp3 = outputPath.replace(/\.wav$/, ".tmp.mp3");
  const buffer  = await response.arrayBuffer();
  fs.writeFileSync(tempMp3, Buffer.from(buffer));

  // Convert MP3 → 44100 Hz mono WAV
  const result = spawnSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", tempMp3,
    "-ar", "44100",
    "-ac", "1",
    outputPath,
  ]);
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr.toString()}`);
  }
  fs.unlinkSync(tempMp3);
}

// ── Measure actual WAV duration with ffprobe ───────────────────────────────
function measureDurationMs(wavPath) {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    wavPath,
  ]);
  if (result.status !== 0) throw new Error("ffprobe failed on " + wavPath);
  return Math.round(parseFloat(result.stdout.toString().trim()) * 1000);
}

// ── Build flat scene list from script.json ─────────────────────────────────
function buildSceneList(script) {
  const scenes = [];

  scenes.push({ id: "intro", text: script.intro.text });

  for (const uc of script.useCases) {
    // Title cards carry no voiceover — record as gap only
    scenes.push({
      id:    `${uc.id}_titleCard`,
      text:  null,
      title: uc.titleCard.text,
      hold_ms: uc.titleCard.duration_ms,
    });
    scenes.push({ id: `${uc.id}_beforePain`, text: uc.beforePain.text });
    scenes.push({ id: `${uc.id}_execution`,  text: uc.execution.text  });
    scenes.push({ id: `${uc.id}_result`,     text: uc.result.text     });
    scenes.push({ id: `${uc.id}_board`,      text: uc.board.text      });
  }

  scenes.push({ id: "outro", text: script.outro.text });
  return scenes;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`==> ElevenLabs Audio Generator`);
  console.log(`    Voice   : ${VOICE_ALIAS} (${VOICE_ID})`);
  console.log(`    Model   : ${MODEL_ID}`);
  console.log(`    Output  : ${OUT_DIR}/`);
  console.log("");

  const script = JSON.parse(fs.readFileSync(SCRIPT_PATH, "utf8"));
  const scenes = buildSceneList(script);

  const GAP_MS         = 1500;  // gap between scenes (ms)
  const INTRO_TITLE_MS = 7000;  // intro title card hold before VO starts
  let cursor_ms        = INTRO_TITLE_MS;

  const manifestScenes = [];

  for (const scene of scenes) {
    process.stdout.write(`  [${scene.id}] `);

    if (!scene.text) {
      // Title card: no audio, just hold time
      process.stdout.write(`title card (hold ${scene.hold_ms}ms)\n`);
      manifestScenes.push({
        scene:       scene.id,
        file:        null,
        start_ms:    cursor_ms,
        duration_ms: scene.hold_ms,
        title_text:  scene.title || null,
      });
      cursor_ms += scene.hold_ms;
      continue;
    }

    const wavPath = path.join(OUT_DIR, `${scene.id}.wav`);

    try {
      await renderWithElevenLabs(scene.text, wavPath);
      const duration_ms = measureDurationMs(wavPath);
      process.stdout.write(`${duration_ms}ms\n`);

      manifestScenes.push({
        scene:       scene.id,
        file:        path.relative(process.cwd(), wavPath),
        start_ms:    cursor_ms,
        duration_ms,
      });
      cursor_ms += duration_ms + GAP_MS;
    } catch (err) {
      process.stdout.write(`ERROR\n`);
      console.error(`    ${err.message}`);
      // Write a manifest entry with null file so the compositor can skip it
      manifestScenes.push({
        scene:       scene.id,
        file:        null,
        start_ms:    cursor_ms,
        duration_ms: 0,
        error:       err.message,
      });
    }

    // ElevenLabs rate limit: free tier = 2 req/s, paid = 5 req/s.
    // 600ms delay keeps us safely under 2 req/s.
    await new Promise((r) => setTimeout(r, 600));
  }

  const manifest = {
    voice_alias:        VOICE_ALIAS,
    voice_id:           VOICE_ID,
    model:              MODEL_ID,
    total_duration_ms:  cursor_ms,
    generated_at:       new Date().toISOString(),
    scenes:             manifestScenes,
  };

  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2));

  const totalSec = Math.round(cursor_ms / 1000);
  console.log("");
  console.log(`==> Done.`);
  console.log(`    Manifest : ${MANIFEST_OUT}`);
  console.log(`    Total    : ${Math.floor(totalSec/60)}m ${totalSec%60}s`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
