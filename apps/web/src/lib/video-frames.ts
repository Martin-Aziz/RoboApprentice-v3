/**
 * Server-side video frame extraction for the vision analysis pipeline.
 *
 * The interpretation route sends still frames sampled from a demonstration
 * video to a multimodal model so the motion policy is derived from what the
 * robot actually does on screen, rather than inferred from the title alone.
 *
 * This runs in the Node.js runtime only (it shells out to `ffmpeg`/`ffprobe`
 * and reads the filesystem). It degrades gracefully: if the video cannot be
 * located on disk (e.g. a browser `blob:` URL the server never received) or
 * ffmpeg is unavailable, it returns no frames plus a human-readable note and
 * the caller falls back to text-only interpretation.
 */

import { execFile } from "child_process";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface ExtractedFrames {
  /** Base64-encoded JPEG frames, sampled in chronological order. */
  frames: string[];
  mediaType: "image/jpeg";
  /** The resolved on-disk path that was read, or null if none was usable. */
  sourcePath: string | null;
  /** Human-readable explanation, surfaced to the operator when frames are absent. */
  note: string;
}

/**
 * Resolve a stored `videoUrl` to a readable file on disk. Public-relative URLs
 * (the bundled demo, e.g. "/demos/multitask.mp4") map into `public/`. Browser
 * `blob:`/`data:` URLs are not readable here. Absolute filesystem paths are
 * used as-is.
 */
function resolveVideoPath(videoUrl: string): { path: string | null; note: string } {
  if (!videoUrl) return { path: null, note: "No video source was recorded for this task." };
  if (videoUrl.startsWith("blob:") || videoUrl.startsWith("data:")) {
    return {
      path: null,
      note: "Uploaded videos stay in the browser as a blob URL, so the server cannot read their frames yet. Frame analysis currently runs on server-hosted videos (such as the bundled demo).",
    };
  }

  let relativePath = videoUrl;
  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
    try {
      relativePath = new URL(videoUrl).pathname;
    } catch {
      return { path: null, note: `Could not parse video URL: ${videoUrl}` };
    }
  }

  const candidates: string[] = [];
  if (relativePath.startsWith("/")) {
    candidates.push(join(process.cwd(), "public", relativePath));
  } else {
    candidates.push(relativePath, join(process.cwd(), "public", relativePath));
  }

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    return { path: null, note: `Video file not found on the server for: ${videoUrl}` };
  }
  return { path: found, note: "" };
}

async function probeDurationSeconds(path: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      path,
    ]);
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
}

/**
 * Extract up to `maxFrames` JPEG frames, evenly spaced across the video, scaled
 * down to `width` px. Returns base64 strings ready to attach as image blocks.
 */
export async function extractVideoFrames(
  videoUrl: string,
  opts: { maxFrames?: number; width?: number } = {},
): Promise<ExtractedFrames> {
  const maxFrames = Math.max(2, Math.min(opts.maxFrames ?? 8, 16));
  const width = opts.width ?? 512;
  const { path, note } = resolveVideoPath(videoUrl);
  if (!path) return { frames: [], mediaType: "image/jpeg", sourcePath: null, note };

  const duration = await probeDurationSeconds(path);
  // Without a known duration, fall back to a steady 2 fps sample and cap the count.
  const fps = duration ? Math.max(maxFrames / duration, 0.1) : 2;

  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(join(tmpdir(), "aurevix-frames-"));
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", path,
      "-vf", `fps=${fps.toFixed(4)},scale=${width}:-1`,
      "-frames:v", String(maxFrames),
      "-q:v", "4",
      join(workDir, "f-%03d.jpg"),
    ]);

    const files = (await readdir(workDir)).filter((f) => f.endsWith(".jpg")).sort();
    const frames = await Promise.all(
      files.slice(0, maxFrames).map(async (file) => {
        const buf = await readFile(join(workDir as string, file));
        return buf.toString("base64");
      }),
    );

    if (frames.length === 0) {
      return { frames: [], mediaType: "image/jpeg", sourcePath: path, note: "ffmpeg produced no frames from the video." };
    }
    return { frames, mediaType: "image/jpeg", sourcePath: path, note: "" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "frame extraction failed";
    return {
      frames: [],
      mediaType: "image/jpeg",
      sourcePath: path,
      note: `Could not extract frames (is ffmpeg installed?): ${reason}`,
    };
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
