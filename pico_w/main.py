import time
import random
from eye import draw_eye
import animations
import sensors
import behavior

# --- Polling intervals (ms) ---
PIR_INTERVAL = 100
ULTRASONIC_INTERVAL = 500

# --- Timer helpers ---
def ticks_ms():
    return time.ticks_ms()

def ticks_add(t, delta_ms):
    return time.ticks_add(t, delta_ms)

def ticks_past(deadline):
    return time.ticks_diff(ticks_ms(), deadline) >= 0

def random_interval(lo_ms, hi_ms):
    return random.randint(lo_ms, hi_ms)

# --- Eye state ---
expression = "normal"
gaze_x = 0
gaze_y = 0

# --- Timer deadlines ---
now = ticks_ms()
pir_deadline = now
ultrasonic_deadline = now
blink_deadline = ticks_add(now, random_interval(1500, 4000))
gaze_deadline = ticks_add(now, random_interval(2000, 5000))
drift_deadline = ticks_add(now, random_interval(1000, 2000))

# --- Cached sensor values ---
pir_detected = False
distance_cm = None

print("Pico W starting — single board mode")

# Initial frame
draw_eye(gaze_x, gaze_y, 0, expression)

# --- Main loop (~30fps, sensors polled at their own intervals) ---
while True:
    now = ticks_ms()

    # --- Sensor polling ---
    if ticks_past(pir_deadline):
        pir_detected = sensors.poll_pir()
        pir_deadline = ticks_add(ticks_ms(), PIR_INTERVAL)

    if ticks_past(ultrasonic_deadline):
        current_state = behavior.get_state()
        if current_state in (behavior.STATE_ALERT, behavior.STATE_INTERACTING):
            distance_cm = sensors.poll_ultrasonic()
        else:
            distance_cm = None
        ultrasonic_deadline = ticks_add(ticks_ms(), ULTRASONIC_INTERVAL)

    # --- Behavior state machine ---
    api_action = behavior.tick(pir_detected, distance_cm)

    if api_action is not None:
        # TODO Phase 4: Call Claude API here
        print("API action:", api_action)
        time.sleep(1)
        behavior.interaction_done()

    # --- Apply behavior state to eye ---
    expression = behavior.target_expression

    # Handle dart command from behavior (e.g. alert snap to center)
    if behavior.consume_dart():
        animations.dart(behavior.target_gaze_x, behavior.target_gaze_y, expression)
        gaze_x = int(behavior.target_gaze_x * 0.85)
        gaze_y = int(behavior.target_gaze_y * 0.85)

    # --- Idle eye animations (only when idle or sleeping) ---
    if behavior.get_state() in (behavior.STATE_IDLE, behavior.STATE_SLEEPING):
        # Blink timer
        if ticks_past(blink_deadline):
            if random.random() < 0.2:
                animations.double_blink(gaze_x, gaze_y, expression)
            else:
                animations.blink(gaze_x, gaze_y, expression)
            blink_deadline = ticks_add(ticks_ms(), random_interval(1500, 4000))

        # Gaze shift timer
        if ticks_past(gaze_deadline):
            old_x, old_y = gaze_x, gaze_y
            gaze_x = random.randint(-25, 25)
            gaze_y = random.randint(-20, 20)

            if random.random() < 0.1:
                animations.slow_look_down(old_x, old_y, expression)
                gaze_x, gaze_y = old_x, old_y
            else:
                animations.glance(old_x, old_y, gaze_x, gaze_y, expression)

            gaze_deadline = ticks_add(ticks_ms(), random_interval(2000, 5000))

        # Micro-drift timer
        if ticks_past(drift_deadline):
            animations.micro_drift(gaze_x, gaze_y, expression)
            drift_deadline = ticks_add(ticks_ms(), random_interval(1000, 2000))

    # --- Render ---
    draw_eye(gaze_x, gaze_y, 0, expression)

    # Frame pacing ~30fps
    time.sleep(0.033)
