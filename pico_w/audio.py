"""PWM audio playback engine for Pico W.

Plays 8kHz mu-law (G.711) audio through PWM via timer interrupt.
GP2 PWM drives 8Ω 0.5W speaker directly (no amplifier).

Hardware filter recommended: 100Ω + 470nF low-pass between GP2 and
speaker(+) (~3.4kHz cutoff) to remove PWM carrier hash.
"""

from machine import Pin, PWM, Timer
from array import array

# --- Playback state (module-level, accessed by ISR) ---
_pwm = None
_timer = None
_buf = None
_pos = 0
_length = 0
_playing = False

# --- Mu-law to 16-bit PWM duty lookup table ---
# 256 entries of unsigned 16-bit values, used by ISR for zero-allocation decoding.
# 16-bit table avoids the precision loss of 8-bit + shift, reducing static.
ULAW_TABLE = None

# Volume gain: 1.0 = normal, 1.5 = 50% louder, etc.
# Keep at or below 2.0 to avoid clipping distortion.
_VOLUME_GAIN = 2.0


def _build_ulaw_table():
    """Build 256-entry mu-law to 16-bit unsigned PWM duty table (ITU-T G.711).

    Decodes mu-law to signed linear, applies gain, then scales to 0-65535
    centered at 32768 (50% duty = electrical silence).
    """
    table = array('H', [0] * 256)  # unsigned 16-bit array
    for i in range(256):
        # Complement the bits (mu-law is stored complemented)
        val = ~i & 0xFF
        sign = val & 0x80
        exponent = (val >> 4) & 0x07
        mantissa = val & 0x0F
        # Decode to 14-bit linear magnitude (0..8191)
        magnitude = ((mantissa << 1) + 33) << (exponent + 2)
        magnitude -= 33
        if magnitude > 8191:
            magnitude = 8191
        # Apply volume gain — clamp to 16383 (leaves headroom for << 1 scaling)
        magnitude = int(magnitude * _VOLUME_GAIN)
        if magnitude > 16383:
            magnitude = 16383
        # Scale to unsigned 16-bit centered at 32768
        # magnitude << 1 maps 0..16383 to 0..32766
        if sign:
            scaled = 32768 - (magnitude << 1)
        else:
            scaled = 32768 + (magnitude << 1)
        # Clamp to valid PWM range
        if scaled < 0:
            scaled = 0
        elif scaled > 65535:
            scaled = 65535
        table[i] = scaled
    return table


def _isr(timer):
    """Timer ISR — plays one sample per call at 8kHz. No allocations."""
    global _pos, _playing
    if _pos < _length:
        _pwm.duty_u16(ULAW_TABLE[_buf[_pos]])
        _pos += 1
    else:
        _pwm.duty_u16(32768)
        _playing = False
        timer.deinit()


def init_audio(pin_num=2):
    """Initialize PWM on the specified GPIO pin and build lookup table.

    Call once at boot. Does not start playback.
    """
    global _pwm, ULAW_TABLE
    _pwm = PWM(Pin(pin_num))
    _pwm.freq(31250)  # 31.25kHz — above audible range, 4000-step resolution
    _pwm.duty_u16(32768)  # 50% duty = electrical silence (no speaker current)
    ULAW_TABLE = _build_ulaw_table()
    print("Audio init: GP{} @ 31.25kHz PWM (direct speaker)".format(pin_num))


def play_buffer(audio_bytes):
    """Start playback of a mu-law encoded audio buffer.

    Args:
        audio_bytes: bytearray of mu-law samples at 8kHz sample rate
    """
    global _buf, _pos, _length, _playing, _timer

    if _playing:
        stop()

    _buf = audio_bytes
    _pos = 0
    _length = len(audio_bytes)
    _playing = True

    _timer = Timer()
    _timer.init(freq=8000, mode=Timer.PERIODIC, callback=_isr)
    print("Playing {} bytes ({:.1f}s)".format(_length, _length / 8000))


def is_playing():
    """Return True if audio is currently playing."""
    return _playing


def stop():
    """Halt playback immediately."""
    global _playing
    _playing = False
    if _timer:
        _timer.deinit()
    if _pwm:
        _pwm.duty_u16(32768)
