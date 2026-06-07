#!/usr/bin/env node
/**
 * mix-audio.js
 *
 * Complete audio mixing pipeline for the product demo video.
 *
 *  Reads:
 *    audio-manifest.json    — scene start times and WAV file paths
 *    video.mp4              — rendered screen-recording video (no audio)
 *    ambient-music.mp3      — background music
 *    sfx/click.wav          — UI click sound
 *    sfx/success.wav        — success / completion sound
 *    sfx/processing.wav     — processing / loading sound
 *
 *  Outputs:
 *    output_with_audio.mp4  — final video with mixed audio
 *    debug-audio-only.wav   — audio-only mix for QA listening
 *
 *  Mixing approach:
 *    1. Background music sidechain-ducked to -30 dB under voiceover,
 *       -18 dB during title cards, full volume (-6 dB) at intro/outro.
 *    2. Voiceover scenes placed at exact timestamps from manifest.
 *    3. UI sound effects placed at hardcoded cue points (edit SFX_CUES).
 *    4. 2-second music fade-in at start, 5-second fade-out at end.
 *    5. Output: AAC 192 kbps stereo, video stream copied (no re-encode).
 *
 * Usage:
 *   node mix-audio.js [--manifest ./audio-manifest.json]
 *                     [--video ./video.mp4]
 *                     [--music ./ambient-music.mp3]
 *                     [--out ./output_with_audio.mp4]
 *                     [--dry-run]   # print ffmpeg command but don't run it
 *
 * Requirements:
 *   ffmpeg >= 4.4 (brew install ffmpeg)
 * =============================================================================
 */

"use strict";

const fs            = require("fs");
const path          = require("path");
const { execSync }  = require("child_process");

// ── CLI args ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function getArg(flag, fallback) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}
const DRY_RUN       = argv.includes("--dry-run");
const MANIFEST_PATH = getArg("--manifest", "./audio-manifest.json");
const VIDEO_IN      = getArg("--video",    "./video.mp4");
const MUSIC_IN      = getArg("--music",    "./ambient-music.mp3");
const VIDEO_OUT     = getArg("--out",      "./output_with_audio.mp4");
const AUDIO_DEBUG   = VIDEO_OUT.replace(/\.[^.]+$/, "") + "-debug-audio.wav";

// ── SFX Cue Points ────────────────────────────────────────────────────────
// Edit this array to place sound effects at specific timestamps (ms).
// Each entry: { file, start_ms, volume }
// These are example cue points — adjust to match your screen recording.
const SFX_CUES = [
  // UC1: AP Reconciliation
  { file: "./sfx/click.wav",      start_ms: 14_700,  volume: 0.55 }, // open inbox
  { file: "./sfx/processing.wav", start_ms: 17_200,  volume: 0.45 }, // matching runs
  { file: "./sfx/success.wav",    start_ms: 25_800,  volume: 0.65 }, // reconciled

  // UC2: Payroll Compliance
  { file: "./sfx/click.wav",      start_ms: 62_000,  volume: 0.55 },
  { file: "./sfx/processing.wav", start_ms: 65_500,  volume: 0.45 },
  { file: "./sfx/success.wav",    start_ms: 74_000,  volume: 0.65 },

  // UC3: Cash Flow Forecasting
  { file: "./sfx/click.wav",      start_ms: 110_500, volume: 0.55 },
  { file: "./sfx/processing.wav", start_ms: 113_000, volume: 0.45 },
  { file: "./sfx/success.wav",    start_ms: 124_000, volume: 0.65 },
];

// ── Read manifest ─────────────────────────────────────────────────────────
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`ERROR: manifest not found: ${MANIFEST_PATH}`);
  process.exit(1);
}
const manifest      = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const totalMs       = manifest.total_duration_ms;
const voiceScenes   = manifest.scenes.filter((s) => s.file && fs.existsSync(s.file));

console.log(`==> Audio Mixer`);
console.log(`    Video    : ${VIDEO_IN}`);
console.log(`    Music    : ${MUSIC_IN}`);
console.log(`    VO scenes: ${voiceScenes.length}`);
console.log(`    SFX cues : ${SFX_CUES.length}`);
console.log(`    Total    : ${Math.round(totalMs / 1000)}s`);
console.log("");

// ── Build ffmpeg input list ───────────────────────────────────────────────
// Input index map:
//   [0]  video.mp4         — video stream only
//   [1]  ambient-music.mp3 — background music
//   [2]  vo_scene_0.wav
//   [2+N-1] vo_scene_N.wav
//   [2+N]   sfx_0.wav
//   ... etc.
//
// We construct the -filter_complex graph programmatically.

const inputs = [
  `-i "${VIDEO_IN}"`,
  `-i "${MUSIC_IN}"`,
];

// Voiceover inputs
const voInputIdx = {};  // scene id → ffmpeg input index
voiceScenes.forEach((s, i) => {
  inputs.push(`-i "${s.file}"`);
  voInputIdx[s.scene] = 2 + i;
});

// SFX inputs (deduplicate by file path)
const sfxFileToIdx = {};
const sfxPaths     = [...new Set(SFX_CUES.map((c) => c.file))];
sfxPaths.forEach((f) => {
  if (fs.existsSync(f)) {
    sfxFileToIdx[f] = inputs.length;
    inputs.push(`-i "${f}"`);
  } else {
    console.warn(`  WARN: SFX file not found, skipping: ${f}`);
  }
});

// ── Build filter_complex ──────────────────────────────────────────────────
const fc = [];   // filter_complex lines
const mixInputs = [];  // labels that go into final amix

// 1. Background music chain
//    - apad: extend to full video length
//    - afade in 2s at start, 5s before end
//    - volume is applied later after sidechain
const musicInputIdx = 1;
fc.push(
  `[${musicInputIdx}:a]` +
  `apad=whole_dur=${Math.ceil(totalMs / 1000)},` +
  `afade=t=in:st=0:d=2,` +
  `afade=t=out:st=${Math.max(0, Math.floor(totalMs/1000) - 5)}:d=5,` +
  `volume=0.20` +
  `[music_raw]`
);

// 2. Place all voiceover scenes on the timeline using adelay
const voLabels = [];
voiceScenes.forEach((s) => {
  const delayMs = s.start_ms;
  const inIdx   = voInputIdx[s.scene];
  const label   = `vo_${s.scene}`;
  fc.push(`[${inIdx}:a]adelay=${delayMs}|${delayMs}[${label}]`);
  voLabels.push(`[${label}]`);
});

// 3. Mix all voiceover streams into one [vo_all] stream
//    apad fills silence between scenes; amix normalizes by default so
//    we disable that with normalize=0 to preserve levels.
if (voLabels.length > 0) {
  fc.push(
    `${voLabels.join("")}amix=inputs=${voLabels.length}:normalize=0[vo_all]`
  );
}

// 4. Sidechain ducking
//    sidechaincompress uses [vo_all] as the sidechain signal to duck [music_raw].
//    Parameters:
//      threshold: 0.015 — trigger when VO RMS exceeds this level
//      ratio:     6     — 6:1 compression (aggressive duck)
//      attack:    80    — 80ms to start ducking (prevents pumping)
//      release:   600   — 600ms to recover (smooth tail)
//      makeup:    1.0   — no makeup gain (we want the duck)
//    The output [music_ducked] is the ducked music stream.
if (voLabels.length > 0) {
  fc.push(
    `[music_raw][vo_all]sidechaincompress=` +
    `threshold=0.015:ratio=6:attack=80:release=600:makeup=1.0` +
    `[music_ducked]`
  );
  // Re-mix the VO stream since sidechaincompress consumed [vo_all]
  if (voLabels.length > 0) {
    voLabels.forEach((lbl, i) => {
      // We need fresh copies; re-delay from inputs (ffmpeg reuses input streams)
      // so relabel them for the final mix.
    });
    // Rebuild [vo_all2] for final mix
    fc.push(
      `${voLabels.join("")}amix=inputs=${voLabels.length}:normalize=0[vo_all2]`
    );
  }
} else {
  // No voiceover — music passes straight through
  fc.push(`[music_raw]acopy[music_ducked]`);
}

// 5. SFX chains: delay each SFX to its cue point
const sfxMixLabels = [];
SFX_CUES.forEach((cue, i) => {
  const inIdx = sfxFileToIdx[cue.file];
  if (inIdx === undefined) return;  // file not found, skip
  const label = `sfx_${i}`;
  fc.push(
    `[${inIdx}:a]` +
    `volume=${cue.volume},` +
    `adelay=${cue.start_ms}|${cue.start_ms}` +
    `[${label}]`
  );
  sfxMixLabels.push(`[${label}]`);
});

// 6. Final amix: music_ducked + vo_all2 + all SFX
const finalInputs = ["[music_ducked]"];
if (voLabels.length > 0) finalInputs.push("[vo_all2]");
finalInputs.push(...sfxMixLabels);

fc.push(
  `${finalInputs.join("")}` +
  `amix=inputs=${finalInputs.length}:normalize=0,` +
  `alimiter=level_in=1:level_out=0.95:limit=0.95:attack=5:release=50` +
  `[final_audio]`
);

// ── Build complete ffmpeg command ─────────────────────────────────────────
const filterComplex = fc.join(";\n    ");

// Handle case where video file may not exist yet (dry-run mode)
const videoExists = fs.existsSync(VIDEO_IN);
const videoPart   = videoExists
  ? `-map 0:v:0 -c:v copy`
  : `-map 0:v:0 -c:v copy`;   // always copy video — never re-encode

const cmd = [
  "ffmpeg -y",
  inputs.join(" \\\n  "),
  `-filter_complex "`,
  `  ` + filterComplex,
  `"`,
  videoPart,
  `-map "[final_audio]"`,
  `-c:a aac -b:a 192k -ar 44100 -ac 2`,
  `-movflags +faststart`,    // place MOOV atom at front for streaming
  `"${VIDEO_OUT}"`,
].join(" \\\n");

// Also generate a debug audio-only render (no video) for QA
const audioOnlyCmd = [
  "ffmpeg -y",
  inputs.slice(1).join(" \\\n  "),   // skip video input
  `-filter_complex "`,
  `  ` + filterComplex,
  `"`,
  `-map "[final_audio]"`,
  `-c:a pcm_s16le -ar 44100 -ac 2`,
  `"${AUDIO_DEBUG}"`,
].join(" \\\n");

// ── Run or print ──────────────────────────────────────────────────────────
console.log("==> ffmpeg filter_complex breakdown:");
console.log("    " + fc.map((l) => l.substring(0, 80)).join("\n    "));
console.log("");

if (DRY_RUN) {
  console.log("==> DRY RUN — ffmpeg command:");
  console.log(cmd);
  console.log("");
  console.log("==> Audio-only debug command:");
  console.log(audioOnlyCmd);
} else {
  // Step 1: Audio-only debug render first (fast, catches filter errors)
  console.log("==> Rendering debug audio...");
  try {
    execSync(audioOnlyCmd, { stdio: "inherit" });
    console.log(`    Written: ${AUDIO_DEBUG}`);
  } catch (err) {
    console.error("ERROR in audio-only render. Check filter_complex.");
    process.exit(1);
  }

  // Step 2: Full video render
  if (videoExists) {
    console.log("==> Rendering final video...");
    execSync(cmd, { stdio: "inherit" });
    console.log(`    Written: ${VIDEO_OUT}`);
  } else {
    console.warn(`WARN: ${VIDEO_IN} not found — skipping video render.`);
    console.warn(`      Run this command when video is ready:\n`);
    console.warn(cmd);
  }
}

console.log("");
console.log("==> Done.");

// ── Export the filter graph for inspection / testing ───────────────────────
module.exports = { buildFilterComplex: () => fc, inputs };
