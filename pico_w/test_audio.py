"""Speaker test script — generates a 440Hz sine wave and plays it.

Run this on the Pico W with the transistor circuit:
  GP2 → 1kΩ resistor → 2N3055 Base
  VSYS (5V) → Collector
  Emitter → Speaker (+)
  Speaker (-) → GND

If you hear a clear 1-second tone, the audio hardware is working.
"""

import math
import time
import audio

# --- Generate 1 second of 440Hz sine wave as mu-law ---
SAMPLE_RATE = 8000
DURATION = 1  # seconds
FREQ = 440

print("Building 440Hz tone ({} samples)...".format(SAMPLE_RATE * DURATION))

# Generate as raw 8-bit unsigned PCM first
# (We bypass mu-law encoding since audio.py has the mu-law table for decoding.
#  For this test we feed pre-decoded linear PCM values directly.)
tone = bytearray(SAMPLE_RATE * DURATION)

for i in range(len(tone)):
    # Sine wave: amplitude 0-255, centered at 128
    sample = int(128 + 100 * math.sin(2 * math.pi * FREQ * i / SAMPLE_RATE))
    tone[i] = sample

# Patch: play raw PCM directly by temporarily replacing ULAW_TABLE
# with an identity table (each byte maps to itself)
audio.init_audio(2)
audio.ULAW_TABLE = bytearray(range(256))  # Identity: table[i] = i

print("Playing 440Hz tone for 1 second...")
audio.play_buffer(tone)

# Wait for playback to finish
while audio.is_playing():
    time.sleep(0.1)

print("Done. If you heard a tone, the speaker circuit works!")
print()
print("Next test: two-tone sweep...")
time.sleep(0.5)

# --- Two-tone test: 440Hz then 880Hz ---
for freq in [440, 880]:
    for i in range(len(tone)):
        sample = int(128 + 100 * math.sin(2 * math.pi * freq * i / SAMPLE_RATE))
        tone[i] = sample
    print("Playing {}Hz...".format(freq))
    audio.play_buffer(tone)
    while audio.is_playing():
        time.sleep(0.1)
    time.sleep(0.3)

print("Audio test complete.")
