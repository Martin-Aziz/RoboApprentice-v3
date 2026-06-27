/**
 * verify-output.js
 *
 * Post-render verification for the video rendering pipeline.
 *
 * Checks:
 *   1. MP4 file exists and is > 1 MB
 *   2. Uses ffprobe to get duration, resolution, fps
 *   3. Extracts 10 key frames at calculated timestamps
 *   4. Prints a formatted summary
 *
 * Node.js built-ins only (child_process, fs, path, os).
 *
 * CLI usage:
 *   node verify-output.js /path/to/output.mp4
 *   node verify-output.js /path/to/output.mp4 --frames 10 --frames-dir ./frames
 *
 * Module usage:
 *   const { verifyOutput } = require('./verify-output');
 *   const result = await verifyOutput('/path/to/output.mp4');
 */

'use strict';

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
};

const log = {
  ok:   (m) => console.log(`${C.green}  ✔${C.reset} ${m}`),
  warn: (m) => console.log(`${C.yellow}  ⚠${C.reset} ${m}`),
  fail: (m) => console.log(`${C.red}  ✖${C.reset} ${C.bold}${m}${C.reset}`),
  info: (m) => console.log(`${C.cyan}  ℹ${C.reset} ${m}`),
  head: (m) => console.log(`\n${C.bold}${m}${C.reset}`),
};

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

/** Human-readable file size */
function formatSize(bytes) {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(0)} MB`;
  if (bytes >= 1024)          return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/** Format seconds as M:SS or H:MM:SS */
function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ---------------------------------------------------------------------------
// 1. File existence and size check
// ---------------------------------------------------------------------------
function checkFileExists(filePath, minBytes = 1_048_576 /* 1 MB */) {
  if (!fs.existsSync(filePath)) {
    log.fail(`File not found: ${filePath}`);
    return { ok: false, error: 'File not found' };
  }

  const stat = fs.statSync(filePath);
  const size = stat.size;

  if (size < minBytes) {
    log.fail(`File too small: ${formatSize(size)} (minimum: ${formatSize(minBytes)})`);
    return { ok: false, size, error: `File is only ${formatSize(size)} — likely truncated` };
  }

  log.ok(`File exists: ${path.basename(filePath)} (${formatSize(size)})`);
  return { ok: true, size };
}

// ---------------------------------------------------------------------------
// 2. ffprobe metadata
// ---------------------------------------------------------------------------

/**
 * Run ffprobe on the file and return parsed metadata.
 *
 * Returns:
 *   {
 *     ok: boolean,
 *     duration: number,        // seconds (float)
 *     durationFormatted: string,
 *     width: number,
 *     height: number,
 *     fps: number,
 *     videoCodec: string,
 *     audioCodec: string,
 *     bitrate: number,         // bits/s
 *     rawJson: object,
 *   }
 */
function probeVideo(filePath) {
  log.head('[ ffprobe ] Reading video metadata');

  const result = spawnSync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    filePath,
  ], { encoding: 'utf8', timeout: 30000 });

  if (result.status !== 0) {
    const errMsg = result.stderr || result.error?.message || 'Unknown ffprobe error';
    log.fail(`ffprobe failed: ${errMsg}`);
    return { ok: false, error: errMsg };
  }

  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch (e) {
    log.fail(`Could not parse ffprobe JSON: ${e.message}`);
    return { ok: false, error: 'JSON parse error', raw: result.stdout };
  }

  const videoStream = (data.streams || []).find(s => s.codec_type === 'video');
  const audioStream = (data.streams || []).find(s => s.codec_type === 'audio');
  const format      = data.format || {};

  if (!videoStream) {
    log.fail('No video stream found in file');
    return { ok: false, error: 'No video stream' };
  }

  // Parse FPS: can be "30/1", "60000/1001", "25", etc.
  let fps = 0;
  const fpsStr = videoStream.r_frame_rate || videoStream.avg_frame_rate || '0/1';
  const fpsParts = fpsStr.split('/');
  if (fpsParts.length === 2) {
    fps = parseFloat(fpsParts[0]) / parseFloat(fpsParts[1]);
  } else {
    fps = parseFloat(fpsStr);
  }
  fps = Math.round(fps * 100) / 100; // round to 2dp

  const duration  = parseFloat(videoStream.duration || format.duration || '0');
  const width     = parseInt(videoStream.width,  10);
  const height    = parseInt(videoStream.height, 10);
  const bitrate   = parseInt(format.bit_rate || '0', 10);

  log.ok(`Duration:   ${formatDuration(duration)} (${duration.toFixed(2)}s)`);
  log.ok(`Resolution: ${width}x${height}`);
  log.ok(`Frame rate: ${fps} fps`);
  log.ok(`Video codec: ${videoStream.codec_name || 'unknown'}`);
  if (audioStream) log.ok(`Audio codec: ${audioStream.codec_name || 'unknown'}`);
  if (bitrate) log.ok(`Bitrate:    ${(bitrate / 1000).toFixed(0)} kbps`);

  return {
    ok:                true,
    duration,
    durationFormatted: formatDuration(duration),
    width,
    height,
    fps,
    videoCodec:        videoStream.codec_name,
    audioCodec:        audioStream?.codec_name ?? null,
    bitrate,
    rawJson:           data,
  };
}

// ---------------------------------------------------------------------------
// 3. Extract key frames
// ---------------------------------------------------------------------------

/**
 * Extract `frameCount` frames spread evenly across the video duration.
 *
 * @param {string} filePath      - Input MP4 path.
 * @param {number} duration      - Video duration in seconds.
 * @param {number} frameCount    - Number of frames to extract (default 10).
 * @param {string} outputDir     - Directory to save frame PNGs (default: temp dir).
 *
 * @returns {string[]} Array of saved frame file paths.
 */
function extractKeyFrames(filePath, duration, frameCount = 10, outputDir = null) {
  log.head(`[ Frame Extraction ] Extracting ${frameCount} key frames`);

  const dir = outputDir || fs.mkdtempSync(path.join(os.tmpdir(), 'render-verify-frames-'));
  fs.mkdirSync(dir, { recursive: true });

  const savedFrames = [];
  const baseName    = path.basename(filePath, path.extname(filePath));

  // Calculate evenly-spaced timestamps, skipping the very start and end (5% margins)
  const margin    = duration * 0.05;
  const usable    = duration - 2 * margin;
  const step      = usable / Math.max(frameCount - 1, 1);

  for (let i = 0; i < frameCount; i++) {
    const timestamp  = margin + i * step;
    const frameName  = `${baseName}_frame_${String(i + 1).padStart(2, '0')}_${timestamp.toFixed(2)}s.png`;
    const framePath  = path.join(dir, frameName);

    const result = spawnSync('ffmpeg', [
      '-ss',    timestamp.toFixed(3),
      '-i',     filePath,
      '-vframes', '1',
      '-q:v',   '2',       // high quality JPEG equivalent
      '-y',                // overwrite if exists
      framePath,
    ], { encoding: 'utf8', timeout: 30000 });

    if (result.status === 0 && fs.existsSync(framePath)) {
      const frameSize = fs.statSync(framePath).size;
      log.ok(`Frame ${String(i + 1).padStart(2)} @ ${timestamp.toFixed(2)}s → ${frameName} (${formatSize(frameSize)})`);
      savedFrames.push(framePath);
    } else {
      const errMsg = (result.stderr || '').split('\n').filter(l => l.includes('Error') || l.includes('error')).slice(-1)[0] || 'unknown error';
      log.warn(`Frame ${i + 1} @ ${timestamp.toFixed(2)}s failed: ${errMsg}`);
    }
  }

  if (savedFrames.length > 0) {
    log.ok(`${savedFrames.length}/${frameCount} frames saved to: ${dir}`);
  } else {
    log.fail('No frames could be extracted');
  }

  return savedFrames;
}

// ---------------------------------------------------------------------------
// 4. Print summary
// ---------------------------------------------------------------------------
function printSummary({ filePath, fileSize, probe, frames, warnings }) {
  const baseName = path.basename(filePath);
  const sizeStr  = formatSize(fileSize);

  log.head('='.repeat(60));
  log.head(' POST-RENDER VERIFICATION SUMMARY');
  log.head('='.repeat(60));

  if (!probe.ok) {
    console.log(`\n  ${C.red}${C.bold}✖ FAILED${C.reset}  ${baseName}`);
    console.log(`  ${C.red}${probe.error}${C.reset}\n`);
    return;
  }

  const resMatch   = probe.width === 1280 && probe.height === 720;
  const fpsMatch   = Math.abs(probe.fps - 30) < 1;
  const durationOk = probe.duration > 0;

  const resFlag  = resMatch  ? `${C.green}${probe.width}x${probe.height}${C.reset}` : `${C.yellow}${probe.width}x${probe.height} (expected 1280x720)${C.reset}`;
  const fpsFlag  = fpsMatch  ? `${C.green}${probe.fps}fps${C.reset}` : `${C.yellow}${probe.fps}fps (expected 30)${C.reset}`;

  console.log(`\n  ${C.green}${C.bold}✔${C.reset} ${C.bold}${baseName}${C.reset} — ${C.magenta}${probe.durationFormatted}${C.reset} duration, ${resFlag}, ${fpsFlag}, ${C.cyan}${sizeStr}${C.reset}`);

  if (probe.videoCodec) console.log(`  ${C.dim}Video codec: ${probe.videoCodec}${probe.audioCodec ? '  Audio: ' + probe.audioCodec : ''}${C.reset}`);
  if (probe.bitrate)    console.log(`  ${C.dim}Bitrate: ${(probe.bitrate / 1000).toFixed(0)} kbps${C.reset}`);
  console.log(`  ${C.dim}Frames extracted: ${frames.length}${C.reset}`);

  if (warnings.length > 0) {
    console.log(`\n  ${C.yellow}Warnings:${C.reset}`);
    warnings.forEach(w => console.log(`    ${C.yellow}⚠${C.reset} ${w}`));
  }

  const allOk = probe.ok && durationOk;
  console.log(`\n  ${allOk ? C.green + C.bold + '✔ Verification passed' : C.red + C.bold + '✖ Verification failed'}${C.reset}\n`);
}

// ---------------------------------------------------------------------------
// PUBLIC API: verifyOutput
// ---------------------------------------------------------------------------

/**
 * @param {string} filePath     - Absolute path to the MP4 file.
 * @param {object} options
 * @param {number}  options.minSizeBytes  - Minimum acceptable file size (default: 1 MB).
 * @param {number}  options.frameCount    - Number of key frames to extract (default: 10).
 * @param {string}  options.framesDir     - Directory to save extracted frames (default: temp).
 * @param {boolean} options.skipFrames    - Skip frame extraction (default: false).
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   filePath: string,
 *   fileSize: number,
 *   probe: object,
 *   frames: string[],
 *   warnings: string[],
 * }>}
 */
async function verifyOutput(filePath, options = {}) {
  const {
    minSizeBytes = 1_048_576, // 1 MB
    frameCount   = 10,
    framesDir    = null,
    skipFrames   = false,
  } = options;

  log.head('='.repeat(60));
  log.head(' POST-RENDER VERIFICATION');
  log.head('='.repeat(60));
  log.info(`Target: ${filePath}`);

  const warnings = [];

  // ---- 1. File size check ----
  log.head('[ 1/3 ] File existence and size');
  const fileCheck = checkFileExists(filePath, minSizeBytes);
  if (!fileCheck.ok) {
    return { ok: false, filePath, fileSize: fileCheck.size ?? 0, probe: {}, frames: [], warnings };
  }
  const fileSize = fileCheck.size;

  // ---- 2. ffprobe ----
  const probe = probeVideo(filePath);
  if (!probe.ok) {
    warnings.push(`ffprobe failed: ${probe.error}`);
  } else {
    // Validate resolution
    if (probe.width !== 1280 || probe.height !== 720) {
      warnings.push(`Resolution is ${probe.width}x${probe.height} (expected 1280x720)`);
    }
    // Validate fps
    if (Math.abs(probe.fps - 30) > 1) {
      warnings.push(`Frame rate is ${probe.fps}fps (expected 30fps)`);
    }
    // Validate minimum duration
    if (probe.duration < 5) {
      warnings.push(`Very short video: ${probe.durationFormatted} duration`);
    }
  }

  // ---- 3. Extract key frames ----
  let frames = [];
  if (!skipFrames && probe.ok && probe.duration > 0) {
    log.head('[ 3/3 ] Key frame extraction');
    frames = extractKeyFrames(filePath, probe.duration, frameCount, framesDir);
    if (frames.length === 0) {
      warnings.push('No frames could be extracted');
    } else if (frames.length < frameCount) {
      warnings.push(`Only ${frames.length}/${frameCount} frames extracted`);
    }
  }

  // ---- Print summary ----
  printSummary({ filePath, fileSize, probe, frames, warnings });

  const ok = fileCheck.ok && probe.ok && probe.duration > 0;
  return { ok, filePath, fileSize, probe, frames, warnings };
}

module.exports = { verifyOutput, probeVideo, extractKeyFrames, checkFileExists, formatDuration, formatSize };

// ---------------------------------------------------------------------------
// CLI: node verify-output.js /path/to/video.mp4 [--frames N] [--frames-dir ./dir] [--skip-frames]
// ---------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Usage: node verify-output.js <video.mp4> [options]

Options:
  --frames <N>           Number of key frames to extract (default: 10)
  --frames-dir <dir>     Directory to save extracted frames
  --skip-frames          Skip frame extraction
  --min-size <bytes>     Minimum file size in bytes (default: 1048576)

Examples:
  node verify-output.js output/demo.mp4
  node verify-output.js output/demo.mp4 --frames 5 --frames-dir ./frames
  node verify-output.js output/demo.mp4 --skip-frames
`);
    process.exit(0);
  }

  const filePath = args[0];

  // Parse flags
  let frameCount   = 10;
  let framesDir    = null;
  let skipFrames   = false;
  let minSizeBytes = 1_048_576;

  for (let i = 1; i < args.length; i++) {
    if      (args[i] === '--frames'      && args[i+1]) { frameCount   = parseInt(args[++i], 10); }
    else if (args[i] === '--frames-dir'  && args[i+1]) { framesDir    = path.resolve(args[++i]); }
    else if (args[i] === '--skip-frames')               { skipFrames   = true; }
    else if (args[i] === '--min-size'    && args[i+1]) { minSizeBytes = parseInt(args[++i], 10); }
  }

  verifyOutput(path.resolve(filePath), { frameCount, framesDir, skipFrames, minSizeBytes })
    .then(result => {
      process.exit(result.ok ? 0 : 1);
    })
    .catch(err => {
      console.error(`Fatal error: ${err.message}`);
      process.exit(1);
    });
}
