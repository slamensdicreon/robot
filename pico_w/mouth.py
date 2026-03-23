"""WS2812 RGB LED ring — robot mouth.

Drives a NeoPixel ring on GP3. Audio-reactive animation during speech —
samples the live audio buffer to drive LED brightness in sync with the voice.

Wiring: GP3 → DIN, 5V → VCC, GND → GND
"""

from machine import Pin
from neopixel import NeoPixel
import audio

# --- Config ---
MOUTH_PIN = 3
NUM_LEDS = 16

# How many audio samples to average per frame (~33ms at 8kHz = 264 samples)
# We sample a window around the current playback position.
_WINDOW = 160

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
_smooth_amp = 0.0  # Smoothed amplitude (0.0-1.0)


def init(pin_num=MOUTH_PIN, num_leds=NUM_LEDS):
    """Initialize NeoPixel ring. Call once at boot."""
    global _np, NUM_LEDS
    NUM_LEDS = num_leds
    _np = NeoPixel(Pin(pin_num), num_leds)
    clear()
    print("Mouth init: GP{} x{} LEDs".format(pin_num, num_leds))


def clear():
    """Turn all LEDs off."""
    global _mode, _smooth_amp
    _mode = "off"
    _smooth_amp = 0.0
    if _np:
        for i in range(NUM_LEDS):
            _np[i] = OFF
        _np.write()


def set_mode(mode):
    """Set animation mode: 'off', 'idle', or 'speaking'."""
    global _mode, _frame, _smooth_amp
    if mode != _mode:
        _mode = mode
        _frame = 0
        _smooth_amp = 0.0


def _scale(color, factor):
    """Scale an RGB tuple by a float factor (0.0-1.0)."""
    r = int(color[0] * factor)
    g = int(color[1] * factor)
    b = int(color[2] * factor)
    return (min(r, 255), min(g, 255), min(b, 255))


def _add(c1, c2):
    """Add two RGB tuples, clamped to 255."""
    return (min(c1[0] + c2[0], 255), min(c1[1] + c2[1], 255), min(c1[2] + c2[2], 255))


def _get_amplitude():
    """Sample the audio buffer around the current playback position.

    Returns 0.0-1.0 representing current speech loudness.
    Reads mu-law bytes directly — 0x7F/0xFF are silence (near zero amplitude),
    values far from those are loud.
    """
    buf = audio._buf
    pos = audio._pos
    length = audio._length
    if buf is None or length == 0 or pos >= length:
        return 0.0

    # Sample a window of bytes centered on current position
    start = max(0, pos - _WINDOW // 2)
    end = min(length, pos + _WINDOW // 2)

    # Mu-law: byte value encodes magnitude. 0xFF and 0x7F are near-silence.
    # Deviation from 0x80 midpoint correlates with amplitude.
    total = 0
    count = 0
    step = 4  # Skip samples for speed
    for i in range(start, end, step):
        val = buf[i]
        # Distance from silence midpoint
        dev = abs(val - 128)
        total += dev
        count += 1

    if count == 0:
        return 0.0

    # Normalize: max deviation is 127, typical speech peaks ~80-100
    avg = total / count
    # Scale so typical speech maps to 0.3-1.0 range
    amp = avg / 70.0
    if amp > 1.0:
        amp = 1.0
    return amp


def update():
    """Advance one animation frame. Call from main loop (~30fps)."""
    global _frame, _smooth_amp
    if _np is None or _mode == "off":
        return

    _frame += 1

    if _mode == "speaking":
        # Get real amplitude from audio buffer
        raw_amp = _get_amplitude()
        # Smooth: fast attack (track loud sounds instantly), slow decay (fade out)
        if raw_amp > _smooth_amp:
            _smooth_amp = _smooth_amp * 0.3 + raw_amp * 0.7  # Fast attack
        else:
            _smooth_amp = _smooth_amp * 0.75 + raw_amp * 0.25  # Slow decay
        _update_speaking()
    elif _mode == "idle":
        _update_idle()


def _update_speaking():
    """Audio-reactive ring: amplitude controls how many LEDs light and how bright."""
    amp = _smooth_amp

    # Number of lit LEDs scales with amplitude (min 2, max all)
    lit_count = 2 + int(amp * (NUM_LEDS - 2))
    half_lit = lit_count // 2

    # Rotation gives motion even during sustained sounds
    rot = (_frame // 2) % NUM_LEDS

    # Color shifts with amplitude: quiet=dim blue, medium=cyan, loud=white
    for i in range(NUM_LEDS):
        # LED position relative to rotation
        ri = (i + rot) % NUM_LEDS

        # Distance from center of lit arc (centered at LED 0 after rotation)
        # Lit LEDs fill symmetrically from the "top"
        dist_from_center = min(ri, NUM_LEDS - ri)

        if dist_from_center < half_lit:
            # How far into the lit zone (0.0=edge, 1.0=center)
            if half_lit > 0:
                closeness = 1.0 - (dist_from_center / half_lit)
            else:
                closeness = 1.0

            brightness = (0.15 + closeness * 0.85) * amp

            # Color blend: louder = more cyan/white
            if amp > 0.7:
                color = _scale(SPEAK_WHITE, brightness)
            elif amp > 0.35:
                color = _scale(SPEAK_CYAN, brightness)
            else:
                color = _scale(SPEAK_BLUE, brightness)

            _np[i] = color
        else:
            # Unlit LEDs get a very dim base glow
            _np[i] = _scale(SPEAK_BLUE, amp * 0.04)

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
        dist = min(abs(i - accent_pos), NUM_LEDS - abs(i - accent_pos))
        if dist == 0:
            accent = _scale(IDLE_ACCENT, breath)
        elif dist == 1:
            accent = _scale(IDLE_ACCENT, breath * 0.4)
        else:
            accent = OFF
        _np[i] = _add(base, accent)

    _np.write()
