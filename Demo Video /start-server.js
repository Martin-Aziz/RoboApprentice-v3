/**
 * start-server.js
 *
 * startServerIfNeeded(projectDir, options?)
 *
 * - Checks if a dev server is already running (by polling a URL).
 * - If not running: spawns 'npm run dev' (Next.js) or 'npm start' (fallback).
 * - Detects the actual port from stdout (handles dynamic port allocation).
 * - Waits for the server to become healthy (polls / or /health for HTTP 200).
 * - Returns { url, port, spawned } — url is the base URL to use downstream.
 *
 * Supports: Next.js, Vite, Create React App, and any server that prints its
 * URL or port to stdout/stderr.
 *
 * Node.js built-ins only.
 */

'use strict';

const { spawn }  = require('child_process');
const http       = require('http');
const https      = require('https');
const fs         = require('fs');
const path       = require('path');

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
};
const log = {
  ok:   (m) => console.log(`${C.green}  ✔${C.reset} ${m}`),
  warn: (m) => console.log(`${C.yellow}  ⚠${C.reset} ${m}`),
  fail: (m) => console.log(`${C.red}  ✖${C.reset} ${C.bold}${m}${C.reset}`),
  info: (m) => console.log(`${C.cyan}  ℹ${C.reset} ${m}`),
  head: (m) => console.log(`\n${C.bold}${m}${C.reset}`),
};

// ---------------------------------------------------------------------------
// Utility: HTTP probe (returns status code or null)
// ---------------------------------------------------------------------------
function probe(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    try {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, { timeout: timeoutMs }, (res) => {
        res.resume(); // drain
        resolve(res.statusCode);
      });
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.on('error',   () => resolve(null));
    } catch (_) {
      resolve(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Detect what kind of project this is and which command to run
// ---------------------------------------------------------------------------
function detectProjectType(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { command: 'npm', args: ['start'], type: 'unknown', defaultPort: 3000 };
  }

  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); }
  catch (_) { pkg = {}; }

  const deps    = { ...pkg.dependencies, ...pkg.devDependencies };
  const scripts = pkg.scripts || {};

  // Next.js
  if (deps.next || scripts.dev?.includes('next')) {
    return { command: 'npm', args: ['run', 'dev'], type: 'nextjs', defaultPort: 3000 };
  }
  // Vite
  if (deps.vite || scripts.dev?.includes('vite')) {
    return { command: 'npm', args: ['run', 'dev'], type: 'vite', defaultPort: 5173 };
  }
  // Create React App / react-scripts
  if (deps['react-scripts'] || scripts.start?.includes('react-scripts')) {
    return { command: 'npm', args: ['start'], type: 'cra', defaultPort: 3000 };
  }
  // Generic 'dev' script
  if (scripts.dev) {
    return { command: 'npm', args: ['run', 'dev'], type: 'generic-dev', defaultPort: 3000 };
  }
  // Fallback: 'npm start'
  return { command: 'npm', args: ['start'], type: 'generic-start', defaultPort: 3000 };
}

// ---------------------------------------------------------------------------
// Parse a port or URL from a line of server stdout/stderr
//
// Patterns recognised:
//   Next.js:  "- Local:        http://localhost:3000"
//   Vite:     "  ➜  Local:   http://localhost:5173/"
//   CRA:      "Local:  http://localhost:3000"
//   Generic:  "listening on port 4000", "Server running on :8080", etc.
// ---------------------------------------------------------------------------
function parsePortFromOutput(line) {
  // Full URL patterns (most reliable)
  const urlMatch = line.match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)/i);
  if (urlMatch) return parseInt(urlMatch[1], 10);

  // "port NNNN" or "listening on NNNN"
  const portMatch = line.match(/(?:port|on)\s+:?(\d{4,5})/i);
  if (portMatch) return parseInt(portMatch[1], 10);

  // ":NNNN" at end of word
  const colonPort = line.match(/:(\d{4,5})\b/);
  if (colonPort) return parseInt(colonPort[1], 10);

  return null;
}

// ---------------------------------------------------------------------------
// Wait for server to respond with a 2xx or 3xx status
// ---------------------------------------------------------------------------
async function waitForServer(url, { timeoutMs = 60000, pollIntervalMs = 500, healthPaths = ['/health', '/'] } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = null;
  let dots = 0;

  process.stdout.write(`${C.cyan}  ℹ${C.reset} Waiting for server at ${url}`);

  while (Date.now() < deadline) {
    for (const p of healthPaths) {
      const status = await probe(`${url}${p}`);
      if (status && status < 400) {
        process.stdout.write(`\n`);
        log.ok(`Server ready — ${url}${p} returned ${status}`);
        return { ok: true, status, path: p };
      }
      lastStatus = status;
    }
    process.stdout.write('.');
    dots++;
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }

  process.stdout.write('\n');
  log.fail(`Server did not become ready within ${timeoutMs / 1000}s (last status: ${lastStatus ?? 'no response'})`);
  return { ok: false, status: lastStatus };
}

// ---------------------------------------------------------------------------
// PUBLIC API: startServerIfNeeded
// ---------------------------------------------------------------------------

/**
 * @param {string} projectDir   - Absolute path to the project root.
 * @param {object} options
 * @param {number}   options.expectedPort  - Port to check first (default: auto-detect).
 * @param {number}   options.startTimeoutMs - Max ms to wait for server (default: 60000).
 * @param {boolean}  options.verbose       - Stream server stdout to console (default: false).
 * @param {function} options.onLine        - Callback(line) for each stdout/stderr line.
 *
 * @returns {Promise<{url: string, port: number, spawned: boolean, process: ChildProcess|null}>}
 */
async function startServerIfNeeded(projectDir, options = {}) {
  const {
    expectedPort   = null,
    startTimeoutMs = 60000,
    verbose        = false,
    onLine         = null,
  } = options;

  log.head('[ Auto Server Start ]');

  const projectType = detectProjectType(projectDir);
  log.info(`Project type detected: ${projectType.type}`);
  log.info(`Default port: ${projectType.defaultPort}`);

  const checkPort  = expectedPort || projectType.defaultPort;
  const checkUrl   = `http://localhost:${checkPort}`;

  // ---- 1. Check if server is already running ----
  const existingStatus = await probe(checkUrl);
  if (existingStatus && existingStatus < 400) {
    log.ok(`Server already running at ${checkUrl} (status ${existingStatus}) — skipping start.`);
    return { url: checkUrl, port: checkPort, spawned: false, process: null };
  }

  log.info(`No server found at ${checkUrl} — starting with: ${projectType.command} ${projectType.args.join(' ')}`);

  // ---- 2. Spawn the dev server ----
  let resolvedPort = checkPort;
  let portResolved = false;

  const child = spawn(projectType.command, projectType.args, {
    cwd:   projectDir,
    shell: true,  // needed on Windows; harmless on macOS/Linux
    env:   { ...process.env, BROWSER: 'none', NO_COLOR: '1' }, // prevent browser auto-open
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Track output lines for port detection and verbose mode
  const processLine = (line) => {
    if (verbose) log.info(`[server] ${line}`);
    if (onLine)  onLine(line);

    if (!portResolved) {
      const detected = parsePortFromOutput(line);
      if (detected && detected > 0) {
        resolvedPort = detected;
        portResolved = true;
        log.ok(`Detected server port from output: ${resolvedPort}`);
      }
    }
  };

  let buffer = '';
  const collectLines = (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop(); // last partial line stays in buffer
    lines.forEach(processLine);
  };

  child.stdout.on('data', collectLines);
  child.stderr.on('data', collectLines);

  child.on('error', (err) => {
    log.fail(`Failed to spawn server: ${err.message}`);
  });

  // Provide a way for callers to kill the server later
  const killServer = () => {
    if (!child.killed) {
      child.kill('SIGTERM');
      log.info('Dev server process terminated.');
    }
  };

  // Register cleanup on process exit so we don't leave orphan processes
  process.on('exit',    killServer);
  process.on('SIGINT',  () => { killServer(); process.exit(130); });
  process.on('SIGTERM', () => { killServer(); process.exit(143); });

  // ---- 3. Wait for server to become reachable ----
  // Give the process a brief moment to start and potentially print its port
  await new Promise(r => setTimeout(r, 1500));

  // Use the resolved port if we got it from stdout, else fall back to default
  const finalPort = portResolved ? resolvedPort : checkPort;
  const finalUrl  = `http://localhost:${finalPort}`;

  const readyResult = await waitForServer(finalUrl, {
    timeoutMs:     startTimeoutMs - 1500,
    healthPaths:   ['/health', '/', '/api/health'],
  });

  if (!readyResult.ok) {
    log.fail(`Server did not start successfully. Check ${projectDir} for errors.`);
    // Return anyway so caller can decide what to do
    return { url: finalUrl, port: finalPort, spawned: true, process: child, ready: false };
  }

  log.ok(`Dev server started and ready at ${finalUrl}`);
  return { url: finalUrl, port: finalPort, spawned: true, process: child, ready: true, killServer };
}

module.exports = { startServerIfNeeded, waitForServer, detectProjectType, parsePortFromOutput };

// ---------------------------------------------------------------------------
// CLI: node start-server.js /path/to/project [port]
// ---------------------------------------------------------------------------
if (require.main === module) {
  const [,, projectDir = process.cwd(), portArg] = process.argv;
  startServerIfNeeded(path.resolve(projectDir), {
    expectedPort: portArg ? parseInt(portArg, 10) : null,
    verbose:      true,
  }).then(result => {
    if (!result.ready && result.spawned) {
      process.exit(1);
    }
    console.log(JSON.stringify({ url: result.url, port: result.port, spawned: result.spawned }));
  });
}
