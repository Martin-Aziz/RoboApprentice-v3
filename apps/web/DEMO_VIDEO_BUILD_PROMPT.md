# Aurevix Demo Video Build Prompt

Use this prompt when rebuilding the Aurevix product demo video.

## Goal

Create a short Aurevix demo video focused on the two strongest use cases:

1. Teach from video and export robot code.
2. Build an ROI case before integration work.

Target length: about 1:45 to match `audio_for_demo.mp3`.

Output files:

- `apps/web/Aurevix_Demo_Video.mp4`
- `apps/web/Aurevix_Demo_Video_With_Audio.mp4`

## Brand And Messaging

- Use the real Aurevix app icon from `aurevix-app-icon.svg`.
- Use warm burnt orange `#C2410C` for video overlays.
- Do not show labels such as `Live demo`, `Demo Environment`, `Sample Data`, or `Safe demo`.
- Do not claim production metrics we do not have.
- Use this main comparison: `Days to weeks -> minutes`.
- Use ROI framing around traditional integration risk: complex cells can cost `$10K-$50K` and take weeks.
- Keep the workflow operator-first: one video demonstration becomes a reusable robot skill.

## Required Assets

Place these files before rendering:

- `multitask.mp4` at the repository root.
- `audio_for_demo.mp3` at the repository root.
- `aurevix-app-icon.svg` at the repository root.

The renderer expects:

- `apps/web/public/demos/multitask.mp4`
- `apps/web/public/aurevix-app-icon.svg`

## Preflight Checklist

From the repository root:

```bash
pnpm --filter @forge-mind/web-v3 dev
```

Keep the dev server running at `http://localhost:3000`, then verify:

```bash
cd apps/web
node verify-video-preflight.js
```

The preflight must pass before rendering. It checks:

- The app iframe fits fully inside the 1280x720 video frame.
- The 3D robot canvas exists.
- WebGL is available in Chromium.
- The WebGL fallback text is not visible.
- The red Next.js `1 Issue` button and demo labels are not visible.

It writes a visual check screenshot:

```text
apps/web/video-preflight-teach.png
```

Open that screenshot before rendering and confirm the entire app screen is visible.

## Render

From `apps/web`:

```bash
node render-video.js
```

The renderer uses Playwright Chromium with WebGL capture flags:

```text
--ignore-gpu-blocklist
--enable-gpu-rasterization
--use-angle=metal
--enable-unsafe-swiftshader
```

If `audio_for_demo.mp3` exists, the script automatically creates the narrated file:

```text
apps/web/Aurevix_Demo_Video_With_Audio.mp4
```

## Troubleshooting

If the red `1 Issue` button appears, fix the underlying Next.js console/build issue or update the recorder cleanup selectors in `render-video.js` and `verify-video-preflight.js`.

If the app is cropped, update `apps/web/public/full-video.html`. The current recording frame embeds a full `1920x1080` app viewport and scales it by `0.666667` into `1280x720`.

If the 3D robot does not appear, run the preflight again and confirm WebGL reports a renderer instead of showing `Viewport running in capture-safe mode`.

If narration ends too early or too late, adjust the final hold in `render-video.js` near the end of the summary section, then rerender.

## ElevenLabs Voiceover

Use the narration script in:

```text
apps/web/Aurevix_ElevenLabs_Voiceover_Script.md
```

Recommended voice direction:

```text
Calm, confident B2B product narrator. Medium pace. Clear articulation. Slightly warm and technical, but not theatrical.
```
