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
NUM_LEDS = 16

# Colors (R, G, B)
OFF = (0, 0, 0)
SPEAK_BLUE = (0, 80, 255)
SPEAK_CYAN = (0, 200, 220)
SPEAK_WHITE = (60, 120, 255)
IDLE_DIM = (0, 5, 15)
IDLE_ACCENT = (0, 15, 40)

# --- State ---
_np = None
_frame = 0
_mode = "off"  # "off", "idle", "speaking"
# Pseudo-random energy to vary speaking intensity each frame
_energy = 5


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
    r = int(color[0] * factor)
    g = int(color[1] * factor)
    b = int(color[2] * factor)
    return (min(r, 255), min(g, 255), min(b, 255))


def _add(c1, c2):
    """Add two RGB tuples, clamped to 255."""
    return (min(c1[0] + c2[0], 255), min(c1[1] + c2[1], 255), min(c1[2] + c2[2], 255))


def update():
    """Advance one animation frame. Call from main loop (~30fps)."""
    global _frame, _energy
    if _np is None or _mode == "off":
        return

    _frame += 1
    # Simple pseudo-random energy: changes each frame for organic variation
    _energy = ((_energy * 7 + _frame * 13 + 53) % 100) / 100.0

    if _mode == "speaking":
        _update_speaking()
    elif _mode == "idle":
        _update_idle()


def _update_speaking():
    """Dual-comet chase with random intensity bursts — looks alive."""
    half = NUM_LEDS // 2

    # Two comets running opposite directions at different speeds
    pos1 = (_frame // 2) % NUM_LEDS
    pos2 = (NUM_LEDS - 1 - (_frame // 3)) % NUM_LEDS

    # Global pulse: fast triangle wave modulated by energy
    pulse = abs((_frame % 12) - 6) / 6.0
    intensity = 0.4 + pulse * 0.4 + _energy * 0.2

    for i in range(NUM_LEDS):
        # Distance to each comet (wrapping around ring)
        d1 = min(abs(i - pos1), NUM_LEDS - abs(i - pos1))
        d2 = min(abs(i - pos2), NUM_LEDS - abs(i - pos2))

        # Comet 1: cyan-white, fast
        if d1 == 0:
            c1 = _scale(SPEAK_WHITE, intensity)
        elif d1 == 1:
            c1 = _scale(SPEAK_CYAN, intensity * 0.7)
        elif d1 == 2:
            c1 = _scale(SPEAK_BLUE, intensity * 0.35)
        elif d1 == 3:
            c1 = _scale(SPEAK_BLUE, intensity * 0.12)
        else:
            c1 = OFF

        # Comet 2: blue, slower
        if d2 == 0:
            c2 = _scale(SPEAK_CYAN, intensity * 0.8)
        elif d2 == 1:
            c2 = _scale(SPEAK_BLUE, intensity * 0.5)
        elif d2 == 2:
            c2 = _scale(SPEAK_BLUE, intensity * 0.15)
        else:
            c2 = OFF

        # Combine both comets + a dim base glow
        base = _scale(SPEAK_BLUE, 0.04 + _energy * 0.06)
        _np[i] = _add(_add(c1, c2), base)

    # Sparkle: energy-driven random bright pixel
    if _energy > 0.6:
        spark_i = (_frame * 7 + int(_energy * 99)) % NUM_LEDS
        _np[spark_i] = _scale(SPEAK_WHITE, intensity)

    _np.write()


def _update_idle():
    """Traveling wave with accent pixel — subtle but alive."""
    # Breathing base: slow triangle wave (~3s cycle)
    phase = (_frame % 90) / 90.0
    if phase < 0.5:
        breath = phase * 2.0
    else:
        breath = (1.0 - phase) * 2.0
    breath = 0.1 + breath * 0.9

    # Accent pixel crawls around the ring slowly (one full loop ~5s)
    accent_pos = (_frame // 10) % NUM_LEDS

    for i in range(NUM_LEDS):
        base = _scale(IDLE_DIM, breath)
        # Accent: brighter pixel with small tail
        dist = min(abs(i - accent_pos), NUM_LEDS - abs(i - accent_pos))
        if dist == 0:
            accent = _scale(IDLE_ACCENT, breath)
        elif dist == 1:
            accent = _scale(IDLE_ACCENT, breath * 0.4)
        else:
            accent = OFF
        _np[i] = _add(base, accent)

    _np.write()
