import time

# --- States ---
STATE_IDLE = "idle"
STATE_ALERT = "alert"
STATE_INTERACTING = "interacting"
STATE_SLEEPING = "sleeping"

# --- Timing constants (ms) ---
SLEEP_TIMEOUT_MS = 5 * 60 * 1000     # 5 minutes idle → sleeping
PROXIMITY_THRESHOLD_CM = 40          # <40cm triggers alert
PROXIMITY_CONFIRM_MS = 1000          # 1s sustained proximity before checking PIR
PIR_CHECK_WINDOW_MS = 3000           # 3s to detect PIR after proximity confirmed
INTERACT_TIMEOUT_MS = 15 * 1000      # 15s — enough for API calls + speech playback
COOLDOWN_MS = 10 * 1000              # 10s after interaction before re-triggering

# --- State machine ---
state = STATE_IDLE
state_entered_at = time.ticks_ms()
proximity_start = 0
interaction_start = 0
last_interaction_end = 0

# --- Eye state (set directly by behavior, read by main loop) ---
target_expression = "normal"
target_gaze_x = 0
target_gaze_y = 0
do_dart = False


def _enter(new_state):
    """Transition to a new state. Sets eye targets directly."""
    global state, state_entered_at
    global target_expression, target_gaze_x, target_gaze_y, do_dart
    state = new_state
    state_entered_at = time.ticks_ms()

    if new_state == STATE_IDLE:
        target_expression = "normal"

    elif new_state == STATE_ALERT:
        target_expression = "alert"
        target_gaze_x = 0
        target_gaze_y = 0
        do_dart = True

    elif new_state == STATE_INTERACTING:
        target_expression = "thinking"
        target_gaze_x = -15
        target_gaze_y = -10

    elif new_state == STATE_SLEEPING:
        target_expression = "sleepy"


def _ms_since(t):
    return time.ticks_diff(time.ticks_ms(), t)


def tick(pir, distance_cm):
    """Called each main loop iteration with current sensor readings.

    Primary trigger: ultrasonic detects proximity (< 40cm).
    Secondary check: PIR confirms human presence (heat signature).

    Returns:
        str or None — "greet" (human), "curious" (object), or None
    """
    global proximity_start, interaction_start, last_interaction_end

    api_action = None
    close = distance_cm is not None and distance_cm < PROXIMITY_THRESHOLD_CM

    # --- SLEEPING ---
    if state == STATE_SLEEPING:
        if close or pir:
            _enter(STATE_ALERT)
            proximity_start = time.ticks_ms()

    # --- IDLE ---
    elif state == STATE_IDLE:
        cooldown_ok = _ms_since(last_interaction_end) > COOLDOWN_MS
        if close and cooldown_ok:
            _enter(STATE_ALERT)
            proximity_start = time.ticks_ms()
        elif pir and cooldown_ok:
            # PIR fallback — ultrasonic may be unavailable or out of range
            _enter(STATE_INTERACTING)
            interaction_start = time.ticks_ms()
            api_action = "greet"
        elif _ms_since(state_entered_at) > SLEEP_TIMEOUT_MS:
            _enter(STATE_SLEEPING)

    # --- ALERT ---
    elif state == STATE_ALERT:
        if not close:
            # Thing moved away — back to idle
            _enter(STATE_IDLE)
        elif _ms_since(proximity_start) > PROXIMITY_CONFIRM_MS:
            # Something has been close for 1s — now check PIR
            if pir:
                # PIR confirms human — interact
                _enter(STATE_INTERACTING)
                interaction_start = time.ticks_ms()
                api_action = "greet"
            elif _ms_since(proximity_start) > PIR_CHECK_WINDOW_MS:
                # 3s close but no PIR — it's an object, not a person
                _enter(STATE_INTERACTING)
                interaction_start = time.ticks_ms()
                api_action = "curious"

    # --- INTERACTING ---
    elif state == STATE_INTERACTING:
        if _ms_since(interaction_start) > INTERACT_TIMEOUT_MS:
            _enter(STATE_IDLE)

    return api_action


def interaction_done():
    """Call this after the Claude API response has been handled."""
    global last_interaction_end
    last_interaction_end = time.ticks_ms()
    _enter(STATE_IDLE)


def get_state():
    return state


def consume_dart():
    """Check and clear the dart flag. Returns True if a dart was requested."""
    global do_dart
    if do_dart:
        do_dart = False
        return True
    return False
