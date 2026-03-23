"""WS2812 RGB LED ring — robot mouth.

Drives a NeoPixel ring on GP3. Animates during speech playback
to simulate a talking mouth. Call update() each frame from main loop.

Wiring: GP3 → DIN, 5V → VCC, GND → GND
"""

from machine import Pin
from neopixel import NeoPixel
import time

# --- Config ---
MOUTH_PIN = 3
NUM_LEDS = 12  # Common ring sizes: 8, 12, 16, 24 — adjust to match yours

# Colors (R, G, B)
OFF = (0, 0, 0)
SPEAK_COLOR = (0, 80, 255)   # Blue glow to match eye theme
SPEAK_BRIGHT = (0, 160, 255)  # Brighter pulse peak
IDLE_DIM = (0, 5, 15)         # Subtle breathing glow when idle

# --- State ---
_np = None
_frame = 0
_mode = "off"  # "off", "idle", "speaking"


def init(pin_num=MOUTH_PIN, num_leds=NUM_LEDS):
    """Initialize NeoPixel ring. Call once at boot."""
    global _np, NUM_LEDS
    NUM_LEDS = num_leds
    _np = NeoPixel(Pin(pin_num), num_leds)
    clear()
    print("Mouth init: GP{} x{} LEDs".format(pin_num, num_leds))


def clear():
    """Turn all LEDs off."""
    global _mode
    _mode = "off"
    if _np:
        for i in range(NUM_LEDS):
            _np[i] = OFF
        _np.write()


def set_mode(mode):
    """Set animation mode: 'off', 'idle', or 'speaking'."""
    global _mode, _frame
    if mode != _mode:
        _mode = mode
        _frame = 0


def _scale(color, factor):
    """Scale an RGB tuple by a float factor (0.0-1.0)."""
    return (int(color[0] * factor), int(color[1] * factor), int(color[2] * factor))


def update():
    """Advance one animation frame. Call from main loop (~30fps).

    Speaking animation: rotating bright segment that pulses,
    simulating mouth movement / sound visualization.
    """
    global _frame
    if _np is None or _mode == "off":
        return

    _frame += 1

    if _mode == "speaking":
        _update_speaking()
    elif _mode == "idle":
        _update_idle()


def _update_speaking():
    """Rotating pulse — 2-3 bright LEDs chase around the ring."""
    # Rotation speed: moves one LED every 3 frames (~10 rotations/sec at 30fps)
    pos = (_frame // 3) % NUM_LEDS

    # Pulse brightness oscillates for organic feel
    pulse = abs((_frame % 20) - 10) / 10.0  # 0.0 to 1.0 triangle wave
    bright = _scale(SPEAK_BRIGHT, 0.5 + pulse * 0.5)

    for i in range(NUM_LEDS):
        dist = min(abs(i - pos), NUM_LEDS - abs(i - pos))
        if dist == 0:
            _np[i] = bright
        elif dist == 1:
            _np[i] = _scale(SPEAK_COLOR, 0.6)
        elif dist == 2:
            _np[i] = _scale(SPEAK_COLOR, 0.2)
        else:
            _np[i] = _scale(SPEAK_COLOR, 0.05)

    _np.write()


def _update_idle():
    """Slow breathing glow — all LEDs fade in and out together."""
    # Full breath cycle every ~3 seconds (90 frames at 30fps)
    phase = (_frame % 90) / 90.0
    # Sine-like curve using triangle wave
    if phase < 0.5:
        brightness = phase * 2.0
    else:
        brightness = (1.0 - phase) * 2.0
    brightness = 0.1 + brightness * 0.9  # Range 0.1 to 1.0

    color = _scale(IDLE_DIM, brightness)
    for i in range(NUM_LEDS):
        _np[i] = color
    _np.write()
