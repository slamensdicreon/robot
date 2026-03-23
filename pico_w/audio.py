"""PWM audio playback engine for Pico W.

Plays 8kHz mu-law (G.711) audio through PWM via timer interrupt.
GP2 PWM drives 2N3055 transistor base via 1kΩ resistor.
Transistor switches speaker current from VSYS (5V) for louder output.
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

# Volume gain: 1.0 = normal, 2.0 = double amplitude, etc.
_VOLUME_GAIN = 3.0


def _build_ulaw_table():
    """Build 256-entry mu-law to 16-bit unsigned PWM duty table (ITU-T G.711)."""
    table = array('H', [0] * 256)  # unsigned 16-bit array
    for i in range(256):
        # Complement the bits (mu-law is stored complemented)
        val = ~i & 0xFF
        sign = val & 0x80
        exponent = (val >> 4) & 0x07
        mantissa = val & 0x0F
        # Decode to 14-bit linear magnitude
        magnitude = ((mantissa << 1) + 33) << (exponent + 2)
        magnitude -= 33
        if magnitude > 8191:
            magnitude = 8191
        # Apply volume gain to magnitude before scaling
        magnitude = int(magnitude * _VOLUME_GAIN)
        if magnitude > 8191:
            magnitude = 8191
        # Scale signed 14-bit to unsigned 16-bit (0..65535) for PWM duty
        # Center at 32768 (50% duty = silence)
        if sign:
            scaled = 32768 - (magnitude << 2)
        else:
            scaled = 32768 + (magnitude << 2)
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
        _pwm.duty_u16(0)
        _playing = False
        timer.deinit()


def init_audio(pin_num=2):
    """Initialize PWM on the specified GPIO pin and build lookup table.

    Call once at boot. Does not start playback.
    """
    global _pwm, ULAW_TABLE
    _pwm = PWM(Pin(pin_num))
    _pwm.freq(62500)  # 62.5kHz — well above audible range
    _pwm.duty_u16(0)
    ULAW_TABLE = _build_ulaw_table()
    print("Audio init: GP{} @ 62.5kHz PWM".format(pin_num))


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
        _pwm.duty_u16(0)
