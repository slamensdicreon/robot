import time
import random
from eye import draw_eye
import animations
import uart_rx

# --- State ---
expression = "normal"
gaze_x = 0
gaze_y = 0

# --- Timer helpers ---
def ticks_ms():
    return time.ticks_ms()

def ticks_add(t, delta_ms):
    return time.ticks_add(t, delta_ms)

def ticks_past(deadline):
    return time.ticks_diff(ticks_ms(), deadline) >= 0

def random_interval(lo_ms, hi_ms):
    return random.randint(lo_ms, hi_ms)

# --- Timer deadlines ---
now = ticks_ms()
blink_deadline = ticks_add(now, random_interval(1500, 4000))
gaze_deadline = ticks_add(now, random_interval(2000, 5000))
drift_deadline = ticks_add(now, random_interval(1000, 2000))


def handle_command(cmd):
    """Process a parsed UART command. Updates global state."""
    global expression, gaze_x, gaze_y

    command, value = cmd

    if command == "EXP":
        if value in ("normal", "alert", "angry", "sleepy", "thinking"):
            expression = value

    elif command == "GAZE":
        try:
            parts = value.split(",")
            gaze_x = int(parts[0])
            gaze_y = int(parts[1])
        except (ValueError, IndexError):
            pass  # Malformed — ignore

    elif command == "BLINK":
        animations.blink(gaze_x, gaze_y, expression)

    elif command == "DART":
        try:
            parts = value.split(",")
            tx = int(parts[0])
            ty = int(parts[1])
            animations.dart(tx, ty, expression)
            gaze_x = int(tx * 0.85)
            gaze_y = int(ty * 0.85)
        except (ValueError, IndexError):
            pass

    elif command == "PRESENCE":
        if value == "1":
            expression = "alert"
        elif value == "0":
            expression = "sleepy"


def idle_tick():
    """Run one iteration of idle behavior. Called every frame."""
    global gaze_x, gaze_y, blink_deadline, gaze_deadline, drift_deadline

    now = ticks_ms()

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

        # 10% chance of slow downward look instead
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


# --- Main loop ---
draw_eye(gaze_x, gaze_y, 0, expression)

while True:
    # Poll UART — one command per frame max
    cmd = uart_rx.poll()
    if cmd is not None:
        handle_command(cmd)

    # Run idle behavior
    idle_tick()

    # Render current state
    draw_eye(gaze_x, gaze_y, 0, expression)

    # Frame pacing ~30fps
    time.sleep(0.033)
