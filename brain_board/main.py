import time
import sensors
import behavior
import uart_tx

# --- Polling intervals (ms) ---
PIR_INTERVAL = 100
ULTRASONIC_INTERVAL = 500

# --- Timer helpers ---
def ticks_ms():
    return time.ticks_ms()

def ticks_past(deadline):
    return time.ticks_diff(ticks_ms(), deadline) >= 0

# --- Initialize timers ---
now = ticks_ms()
pir_deadline = now
ultrasonic_deadline = now

# --- Cached sensor values ---
pir_detected = False
distance_cm = None

print("Brain board starting...")

# Initial eye state
uart_tx.send_expression("normal")

# --- Main loop ---
while True:
    now = ticks_ms()

    # Poll PIR every 100ms
    if ticks_past(pir_deadline):
        pir_detected = sensors.poll_pir()
        pir_deadline = time.ticks_add(ticks_ms(), PIR_INTERVAL)

    # Poll ultrasonic every 500ms (only when alert or interacting)
    if ticks_past(ultrasonic_deadline):
        current_state = behavior.get_state()
        if current_state in (behavior.STATE_ALERT, behavior.STATE_INTERACTING):
            distance_cm = sensors.poll_ultrasonic()
        else:
            distance_cm = None
        ultrasonic_deadline = time.ticks_add(ticks_ms(), ULTRASONIC_INTERVAL)

    # Run behavior state machine
    api_action = behavior.tick(pir_detected, distance_cm)

    if api_action is not None:
        # TODO Phase 4: Call Claude API here
        # For now, simulate with a delay and return to idle
        print("API action:", api_action)
        time.sleep(1)
        behavior.interaction_done()

    # Frame pacing — ~10Hz brain loop
    time.sleep(0.1)
