/**
 * music-sources.js
 *
 * Reference guide: royalty-free ambient / tech background music sources
 * and search strategies for product demo videos.
 *
 * Also documents the complete SFX approach (clicks, transitions, success tones)
 * and advanced ffmpeg / sox recipes for audio post-production.
 */

/**
 * ── PART A: ROYALTY-FREE MUSIC SOURCES ──────────────────────────────────────
 *
 * All five sources below allow use in commercial product demo videos, YouTube,
 * and embedded web players. Verify licensing terms at time of use — they can
 * change. "RF" = royalty-free; "CC" = Creative Commons.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ 1. Pixabay Music (pixabay.com/music)                                    │
 * │    License  : Pixabay License (CC0-equivalent, commercial OK)           │
 * │    Cost     : Free, no attribution required                             │
 * │    Best for : Quick iteration; large library                            │
 * │                                                                         │
 * │    Search terms:                                                        │
 * │      "ambient corporate minimal"                                        │
 * │      "tech background loop"                                             │
 * │      "soft piano corporate"                                             │
 * │      "cinematic ambient no drums"                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ 2. Uppbeat (uppbeat.io)                                                 │
 * │    License  : Free tier: personal/YouTube; paid: commercial/client work │
 * │    Cost     : Free tier available; $8/mo for commercial license         │
 * │    Best for : Curated, high-quality, demo-specific tracks               │
 * │                                                                         │
 * │    Search terms:                                                        │
 * │      "product demo" genre filter → "Corporate"                         │
 * │      "innovation tech ambient"                                          │
 * │      "minimal piano focus"                                              │
 * │      "SaaS startup background"                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ 3. Mixkit (mixkit.co/free-stock-music)                                 │
 * │    License  : Mixkit Free License (commercial use OK, no attribution)  │
 * │    Cost     : Free                                                      │
 * │    Best for : Clean, minimal tracks that don't fight voiceover          │
 * │                                                                         │
 * │    Search terms (use their filter UI):                                  │
 * │      Category → "Corporate"                                            │
 * │      Mood → "Inspiring", "Calm"                                        │
 * │      Tempo → "Slow", "Medium"                                          │
 * │      Direct URL: mixkit.co/free-stock-music/corporate/                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ 4. Freesound.org (freesound.org)                                        │
 * │    License  : Varies by track; filter for CC0 or CC BY                  │
 * │    Cost     : Free (account required for downloads)                     │
 * │    Best for : Specific sound design; drones, textures, SFX              │
 * │                                                                         │
 * │    Search terms:                                                        │
 * │      "ambient drone loop CC0"                                           │
 * │      "tech UI sound effect"                                             │
 * │      "soft pad loop seamless"                                           │
 * │      "digital notification chime"                                       │
 * │    Filter: License = "Creative Commons 0" for zero-attribution tracks  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ 5. YouTube Audio Library (studio.youtube.com/channel/UC.../music)      │
 * │    License  : YouTube Audio Library License (free for any YouTube use) │
 * │               Many tracks also allow offline / embedded use             │
 * │    Cost     : Free                                                      │
 * │    Best for : Videos that will be published on YouTube                 │
 * │                                                                         │
 * │    Search terms:                                                        │
 * │      Genre → "Ambient", "Electronic"                                   │
 * │      Mood  → "Calm", "Inspirational"                                   │
 * │      Duration → filter < 3 min for loops                               │
 * │      Attribution → filter "No attribution required"                    │
 * │    Download the CSV track list and grep for "ambient" + "no attr"      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 *
 * ── PART B: SOX AMBIENT GENERATION COMMANDS ────────────────────────────────
 *
 * Use these as fallback when no music file is available, or to layer under
 * a music track for extra depth.
 *
 *
 * B1 — Original spec: simple sine drone (360s)
 * ─────────────────────────────────────────────
 *   sox -n -r 44100 -c 2 ambient.wav \
 *     synth 360 sine 60 sine 80 sine 120 \
 *     remix - \
 *     vol 0.3 \
 *     fade 5 360 10
 *
 *   Explanation:
 *     sox -n          : no input file (generate from scratch)
 *     -r 44100        : sample rate 44100 Hz
 *     -c 2            : stereo (2 channels)
 *     synth 360       : generate 360 seconds
 *     sine 60/80/120  : three sine waves stacked (sub, bass, low-mid)
 *     remix -         : fold all synth channels into stereo
 *     vol 0.3         : master volume 30% (leaves headroom under VO)
 *     fade 5 360 10   : 5s fade-in, total 360s, 10s fade-out
 *
 *
 * B2 — Evolving pad with pitch modulation (subtle "breathing" effect)
 * ────────────────────────────────────────────────────────────────────
 *   sox -n -r 44100 -c 2 ambient-evolving.wav \
 *     synth 360 \
 *       sine:0.2  60 \
 *       sine:0.3  80 \
 *       sine:0.15 120 \
 *       brownnoise \
 *     bandpass 150 300 \
 *     remix - \
 *     vol 0.25 \
 *     fade 5 360 10
 *
 *   The `sine:0.2` syntax modulates the sine wave frequency with a 0.2 Hz LFO,
 *   creating a slow, organic pitch wobble.
 *
 *
 * B3 — Binaural focus drone (for concentration-enhancing content)
 * ───────────────────────────────────────────────────────────────
 *   # Left channel: 200 Hz
 *   # Right channel: 210 Hz
 *   # Binaural beat: 10 Hz (alpha wave range — focused calm)
 *   sox -n -r 44100 -c 1 /tmp/left.wav  synth 360 sine 200 vol 0.2 fade 5 360 10
 *   sox -n -r 44100 -c 1 /tmp/right.wav synth 360 sine 210 vol 0.2 fade 5 360 10
 *   sox -M /tmp/left.wav /tmp/right.wav ambient-binaural.wav
 *
 *
 * B4 — Layered ambient with reverb (spacious, premium feel)
 * ──────────────────────────────────────────────────────────
 *   sox -n -r 44100 -c 2 ambient-reverb.wav \
 *     synth 360 sine 80 sine 120 sine 160 \
 *     remix - \
 *     reverb 60 50 200 \
 *     vol 0.25 \
 *     fade 5 360 10
 *
 *   reverb args: reverberance(60%) HF-damping(50%) room-scale(200%)
 *
 *
 * ── PART C: SFX GENERATION WITH SOX ────────────────────────────────────────
 *
 * Generate the click.wav, success.wav, and processing.wav files used by
 * mix-audio.js without needing external SFX libraries.
 *
 *
 * C1 — UI click (sharp, clean)
 * ──────────────────────────────
 *   sox -n -r 44100 -c 1 sfx/click.wav \
 *     synth 0.04 sine 1200 \
 *     fade 0 0.04 0.01 \
 *     vol 0.8
 *
 *
 * C2 — Success chime (rising two-tone)
 * ──────────────────────────────────────
 *   # Note 1: 880 Hz (A5)
 *   sox -n -r 44100 -c 1 /tmp/note1.wav synth 0.15 sine 880 fade 0 0.15 0.05 vol 0.5
 *   # Note 2: 1174 Hz (D6) — a perfect fourth above
 *   sox -n -r 44100 -c 1 /tmp/note2.wav synth 0.20 sine 1174 fade 0 0.20 0.08 vol 0.5
 *   # Concatenate with 50ms gap
 *   sox /tmp/note1.wav /tmp/silence.wav /tmp/note2.wav sfx/success.wav
 *   # (generate silence: sox -n -r 44100 -c 1 /tmp/silence.wav trim 0 0.05)
 *
 *
 * C3 — Processing spinner tone (looping, subtle)
 * ────────────────────────────────────────────────
 *   sox -n -r 44100 -c 1 sfx/processing.wav \
 *     synth 1.0 sine 440 \
 *     fade 0.05 1.0 0.05 \
 *     vol 0.15
 *
 *
 * ── PART D: FFMPEG ADVANCED MIXING RECIPES ──────────────────────────────────
 *
 * D1 — Manual volume ducking (no sidechain, predictable)
 * ────────────────────────────────────────────────────────
 *   Use when sidechaincompress is unavailable (older ffmpeg builds).
 *   Replace the sidechain section in mix-audio.js with volume automation:
 *
 *   [1:a]volume='if(between(t,7,20),0.05,if(between(t,25,38),0.05,0.20))':eval=frame[music_ducked]
 *
 *   Adjust the time ranges to match your voiceover start/end times.
 *
 *
 * D2 — Stereo widening for the final mix
 * ─────────────────────────────────────────
 *   Add this to the end of the filter_complex chain:
 *
 *   [final_audio]stereotools=mlev=0.015:slev=1.0:sbal=0:mbal=0:mode=lr>ms[out_wide]
 *
 *   This converts to mid-side, applies subtle stereo widening, and converts back.
 *
 *
 * D3 — Loudness normalization to broadcast standard (-14 LUFS)
 * ─────────────────────────────────────────────────────────────
 *   Run as a post-process after mix-audio.js:
 *
 *   ffmpeg -i output_with_audio.mp4 \
 *     -af "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=summary" \
 *     -c:v copy \
 *     output_normalized.mp4
 *
 *   -14 LUFS is the YouTube recommended target.
 *   -16 LUFS is the Spotify / Apple Music target.
 *
 *
 * D4 — Extract audio-only WAV from final video (for QA listening)
 * ───────────────────────────────────────────────────────────────
 *   ffmpeg -i output_with_audio.mp4 \
 *     -vn -c:a pcm_s16le -ar 44100 \
 *     output_audio_qa.wav
 *
 *
 * D5 — Verify LUFS of final output
 * ──────────────────────────────────
 *   ffmpeg -i output_with_audio.mp4 \
 *     -af ebur128 \
 *     -f null - 2>&1 | grep "I:" | tail -1
 *
 *   Target output: "I: -14.0 LUFS" for web/YouTube
 */

module.exports = {}; // This file is a reference doc; no runtime exports needed.
