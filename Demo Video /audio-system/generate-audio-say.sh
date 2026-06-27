#!/usr/bin/env bash
# =============================================================================
# generate-audio-say.sh
#
# Reads script.json, renders every voiceover scene with macOS `say`,
# converts each AIFF to 44100 Hz mono WAV with ffmpeg, and writes
# audio-manifest.json with start timestamps for the video compositor.
#
# Requirements:
#   - macOS (say command)
#   - ffmpeg  (brew install ffmpeg)
#   - jq      (brew install jq)
#
# Usage:
#   chmod +x generate-audio-say.sh
#   ./generate-audio-say.sh [--voice Alex] [--rate 180] [--out ./audio]
#
# Voice reference:
#   Voice      | Gender | Style                  | Rec. Rate | Best for
#   -----------|--------|------------------------|-----------|-------------------
#   Samantha   | F      | Natural, warm          | 185       | General demos
#   Alex       | M      | Clear, confident       | 180       | Enterprise SaaS
#   Daniel     | M      | British, polished      | 175       | Premium feel
#   Karen      | F      | Australian, friendly   | 185       | Approachable demos
#   Moira      | F      | Irish, distinctive     | 180       | Memorable demos
#   Ava        | F      | Modern AI feel         | 190       | Tech products
#
# say SSML tokens used in this script:
#   [[slnc N]]    — N milliseconds of silence
#   [[rate N]]    — set rate for the following text
#   [[emph +]]    — add emphasis to the next word
# =============================================================================

set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
VOICE="Alex"
RATE=180
SCRIPT_JSON="./script.json"
OUT_DIR="./audio"
MANIFEST="./audio-manifest.json"

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --voice)  VOICE="$2";       shift 2 ;;
    --rate)   RATE="$2";        shift 2 ;;
    --script) SCRIPT_JSON="$2"; shift 2 ;;
    --out)    OUT_DIR="$2";     shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Dependency checks ─────────────────────────────────────────────────────────
for cmd in say ffmpeg jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' is not installed. Install with: brew install ${cmd}"
    exit 1
  fi
done

if [[ ! -f "$SCRIPT_JSON" ]]; then
  echo "ERROR: script.json not found at $SCRIPT_JSON"
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "==> Voice: $VOICE | Rate: $RATE wpm"
echo "==> Output: $OUT_DIR"
echo ""

# ── Helper: render one line of narration ─────────────────────────────────────
# Usage: render_scene SCENE_ID TEXT
# Writes: $OUT_DIR/SCENE_ID.aiff  (raw say output)
#         $OUT_DIR/SCENE_ID.wav   (44100 Hz mono)
# Returns: actual duration in milliseconds (via ffprobe)
render_scene() {
  local scene_id="$1"
  local text="$2"
  local aiff="$OUT_DIR/${scene_id}.aiff"
  local wav="$OUT_DIR/${scene_id}.wav"

  echo "  Rendering: $scene_id"

  # say requires .aiff output; embed a 200ms lead-in silence so the
  # audio compositor has headroom before the voice starts.
  say \
    -v "$VOICE" \
    -r "$RATE"  \
    -o "$aiff"  \
    "[[slnc 200]]${text}[[slnc 300]]"

  # Convert to 44100 Hz mono WAV (industry standard for mixing)
  ffmpeg -y -loglevel error \
    -i "$aiff" \
    -ar 44100 \
    -ac 1 \
    "$wav"

  # Return actual duration in ms so the manifest is ground-truth, not estimate
  local duration_ms
  duration_ms=$(ffprobe -v error \
    -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 \
    "$wav" | awk '{printf "%d", $1 * 1000}')

  echo "$duration_ms"
}

# ── Parse script.json and render scenes ──────────────────────────────────────
# We build the manifest as a JSON array appended scene by scene.

MANIFEST_ENTRIES=()

# Running wall-clock cursor (ms) — used to place each scene in the timeline.
# Layout:
#   0 ms            → intro titlecard (video)
#   7000 ms         → intro voiceover starts
#   7000 + intro_dur → uc1 titlecard
#   ... etc.
#
# Adjust GAP_MS to match your video editor's inter-scene gap.
GAP_MS=1500          # silence between scenes
TITLE_CARD_MS=7000   # intro title card holds before VO starts
UC_TITLE_MS=4200     # use-case title card hold duration

cursor_ms=$TITLE_CARD_MS  # intro VO starts after the title card

# ─── Intro ────────────────────────────────────────────────────────────────────
echo "── Intro ──────────────────────────────────────────────────────────────"
INTRO_TEXT=$(jq -r '.intro.text' "$SCRIPT_JSON")
INTRO_DUR=$(render_scene "intro" "$INTRO_TEXT")
MANIFEST_ENTRIES+=("{\"scene\":\"intro\",\"file\":\"audio/intro.wav\",\"start_ms\":${cursor_ms},\"duration_ms\":${INTRO_DUR}}")
cursor_ms=$(( cursor_ms + INTRO_DUR + GAP_MS ))

# ─── Use Cases ───────────────────────────────────────────────────────────────
NUM_UCS=$(jq '.useCases | length' "$SCRIPT_JSON")

for (( i=0; i<NUM_UCS; i++ )); do
  UC=$(jq ".useCases[$i]" "$SCRIPT_JSON")
  UC_ID=$(echo "$UC" | jq -r '.id')

  echo ""
  echo "── Use Case: $UC_ID ──────────────────────────────────────────────────"

  # Title card: no voiceover, just hold time — record in manifest as a gap
  TITLE_TEXT=$(echo "$UC" | jq -r '.titleCard.text')
  MANIFEST_ENTRIES+=("{\"scene\":\"${UC_ID}_titleCard\",\"file\":null,\"start_ms\":${cursor_ms},\"duration_ms\":${UC_TITLE_MS},\"text\":$(echo "$TITLE_TEXT" | jq -R .)}")
  cursor_ms=$(( cursor_ms + UC_TITLE_MS ))

  # beforePain
  TEXT=$(echo "$UC" | jq -r '.beforePain.text')
  DUR=$(render_scene "${UC_ID}_beforePain" "$TEXT")
  MANIFEST_ENTRIES+=("{\"scene\":\"${UC_ID}_beforePain\",\"file\":\"audio/${UC_ID}_beforePain.wav\",\"start_ms\":${cursor_ms},\"duration_ms\":${DUR}}")
  cursor_ms=$(( cursor_ms + DUR + GAP_MS ))

  # execution
  TEXT=$(echo "$UC" | jq -r '.execution.text')
  DUR=$(render_scene "${UC_ID}_execution" "$TEXT")
  MANIFEST_ENTRIES+=("{\"scene\":\"${UC_ID}_execution\",\"file\":\"audio/${UC_ID}_execution.wav\",\"start_ms\":${cursor_ms},\"duration_ms\":${DUR}}")
  cursor_ms=$(( cursor_ms + DUR + GAP_MS ))

  # result
  TEXT=$(echo "$UC" | jq -r '.result.text')
  DUR=$(render_scene "${UC_ID}_result" "$TEXT")
  MANIFEST_ENTRIES+=("{\"scene\":\"${UC_ID}_result\",\"file\":\"audio/${UC_ID}_result.wav\",\"start_ms\":${cursor_ms},\"duration_ms\":${DUR}}")
  cursor_ms=$(( cursor_ms + DUR + GAP_MS ))

  # board overview
  TEXT=$(echo "$UC" | jq -r '.board.text')
  DUR=$(render_scene "${UC_ID}_board" "$TEXT")
  MANIFEST_ENTRIES+=("{\"scene\":\"${UC_ID}_board\",\"file\":\"audio/${UC_ID}_board.wav\",\"start_ms\":${cursor_ms},\"duration_ms\":${DUR}}")
  cursor_ms=$(( cursor_ms + DUR + GAP_MS ))
done

# ─── Outro ────────────────────────────────────────────────────────────────────
echo ""
echo "── Outro ──────────────────────────────────────────────────────────────"
OUTRO_TEXT=$(jq -r '.outro.text' "$SCRIPT_JSON")
DUR=$(render_scene "outro" "$OUTRO_TEXT")
MANIFEST_ENTRIES+=("{\"scene\":\"outro\",\"file\":\"audio/outro.wav\",\"start_ms\":${cursor_ms},\"duration_ms\":${DUR}}")
cursor_ms=$(( cursor_ms + DUR ))

# ── Write audio-manifest.json ─────────────────────────────────────────────────
TOTAL_MS=$cursor_ms

{
  echo "{"
  echo "  \"voice\": \"$VOICE\","
  echo "  \"rate\": $RATE,"
  echo "  \"total_duration_ms\": $TOTAL_MS,"
  printf "  \"scenes\": [\n"

  last_idx=$(( ${#MANIFEST_ENTRIES[@]} - 1 ))
  for idx in "${!MANIFEST_ENTRIES[@]}"; do
    entry="${MANIFEST_ENTRIES[$idx]}"
    if [[ $idx -lt $last_idx ]]; then
      printf "    %s,\n" "$entry"
    else
      printf "    %s\n"  "$entry"
    fi
  done

  echo "  ]"
  echo "}"
} > "$MANIFEST"

echo ""
echo "==> Done."
echo "    Audio files : $OUT_DIR/"
echo "    Manifest    : $MANIFEST"
echo "    Total duration: $(( TOTAL_MS / 1000 ))s ($(( TOTAL_MS / 60000 ))m $(( (TOTAL_MS % 60000) / 1000 ))s)"
