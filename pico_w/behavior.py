import time

# --- States ---
STATE_IDLE = "idle"
STATE_ALERT = "alert"
STATE_INTERACTING = "interacting"
STATE_SLEEPING = "sleeping"

# --- Timing constants (ms) ---
SLEEP_TIMEOUT_MS = 5 * 60 * 1000     # 5 minutes idle → sleeping
ALERT_GREET_MS = 3 * 1000            # 3s sustained presence → greet
PROXIMITY_INTERACT_MS = 5 * 1000     # 5s sustained proximity → interact
INTERACT_TIMEOUT_MS = 5 * 1000       # 5s max for API call before timeout
PROXIMITY_THRESHOLD_CM = 40          # <40cm triggers proximity reaction

# --- State machine ---
state = STATE_IDLE
state_entered_at = time.ticks_ms()
presence_start = 0
proximity_start = 0
interaction_start = 0

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

    Returns:
        str or None — "greet" or "interact" if Claude API call needed
    """
    global presence_start, proximity_start, interaction_start

    api_action = None

    # --- SLEEPING ---
    if state == STATE_SLEEPING:
        if pir:
            _enter(STATE_ALERT)
            presence_start = time.ticks_ms()

    # --- IDLE ---
    elif state == STATE_IDLE:
        if pir:
            _enter(STATE_ALERT)
            presence_start = time.ticks_ms()
        elif _ms_since(state_entered_at) > SLEEP_TIMEOUT_MS:
            _enter(STATE_SLEEPING)

    # --- ALERT ---
    elif state == STATE_ALERT:
        if not pir:
            _enter(STATE_IDLE)
        else:
            if _ms_since(presence_start) > ALERT_GREET_MS:
                _enter(STATE_INTERACTING)
                interaction_start = time.ticks_ms()
                api_action = "greet"

            if distance_cm is not None and distance_cm < PROXIMITY_THRESHOLD_CM:
                if proximity_start == 0:
                    proximity_start = time.ticks_ms()
                elif _ms_since(proximity_start) > PROXIMITY_INTERACT_MS:
                    _enter(STATE_INTERACTING)
                    interaction_start = time.ticks_ms()
                    api_action = "interact"
            else:
                proximity_start = 0

    # --- INTERACTING ---
    elif state == STATE_INTERACTING:
        if _ms_since(interaction_start) > INTERACT_TIMEOUT_MS:
            _enter(STATE_IDLE)

    return api_action


def interaction_done():
    """Call this after the Claude API response has been handled."""
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
