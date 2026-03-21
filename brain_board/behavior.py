import time
import uart_tx

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


def _enter(new_state):
    """Transition to a new state. Sends the appropriate UART commands."""
    global state, state_entered_at
    state = new_state
    state_entered_at = time.ticks_ms()

    if new_state == STATE_IDLE:
        uart_tx.send_expression("normal")

    elif new_state == STATE_ALERT:
        uart_tx.send_expression("alert")
        uart_tx.send_dart(0, 0)  # Snap eyes to center

    elif new_state == STATE_INTERACTING:
        uart_tx.send_expression("thinking")
        uart_tx.send_gaze(-15, -10)  # Look up-left while thinking

    elif new_state == STATE_SLEEPING:
        uart_tx.send_expression("sleepy")


def _ms_since(t):
    return time.ticks_diff(time.ticks_ms(), t)


def tick(pir, distance_cm):
    """Called each main loop iteration with current sensor readings.

    Args:
        pir: bool — True if PIR detects presence
        distance_cm: float or None — ultrasonic distance, None if no reading
    Returns:
        str or None — "greet" or "interact" if Claude API call needed, else None
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
            # Presence lost — back to idle
            _enter(STATE_IDLE)
        else:
            # Check for sustained presence → greeting
            if _ms_since(presence_start) > ALERT_GREET_MS:
                _enter(STATE_INTERACTING)
                interaction_start = time.ticks_ms()
                api_action = "greet"

            # Check proximity
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
        # Timeout — return to idle regardless
        if _ms_since(interaction_start) > INTERACT_TIMEOUT_MS:
            _enter(STATE_IDLE)

    return api_action


def interaction_done():
    """Call this after the Claude API response has been handled."""
    _enter(STATE_IDLE)


def get_state():
    return state
