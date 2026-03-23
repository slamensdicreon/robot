import time
import random
import gc
from eye import draw_eye
import animations
import sensors
import behavior
import api
import audio

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

# --- Speech state ---
speaking = False

print("Pico W starting — single board mode")

# --- Boot: WiFi + Audio ---
config = api.load_config()
wifi_ok = api.connect_wifi(config)
audio.init_audio(2)  # GP2 for PWM audio through 2N3055
print("Free RAM after boot:", gc.mem_free())

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
        distance_cm = sensors.poll_ultrasonic()
        if distance_cm is not None:
            print("US:{:.0f}cm PIR:{} S:{}".format(distance_cm, pir_detected, behavior.get_state()))
        ultrasonic_deadline = ticks_add(ticks_ms(), ULTRASONIC_INTERVAL)

    # --- If speaking, render eyes + check completion, skip everything else ---
    if speaking:
        if not audio.is_playing():
            speaking = False
            behavior.interaction_done()
            gc.collect()
        else:
            # Occasional blink during speech
            if ticks_past(blink_deadline):
                animations.blink(gaze_x, gaze_y, expression)
                blink_deadline = ticks_add(ticks_ms(), random_interval(2000, 5000))
        draw_eye(gaze_x, gaze_y, 0, expression)
        time.sleep(0.033)
        continue

    # --- Behavior state machine ---
    api_action = behavior.tick(pir_detected, distance_cm)

    if api_action is not None:
        # Eyes show "thinking" (set by behavior entering INTERACTING)
        expression = "thinking"
        draw_eye(-15, -10, 0, expression)

        # Step 1: Get text from Claude
        text = None
        if api.check_wifi() or api.reconnect_wifi(config):
            text = api.call_claude(api_action, config)
        if text is None:
            text = "Hello there."

        # Quick blink between API calls — keeps eyes alive
        animations.blink(-15, -10, "thinking")

        # Step 2: Get audio from ElevenLabs
        audio_data = api.call_elevenlabs(text, config)

        if audio_data is not None and len(audio_data) > 0:
            # Step 3: Start playback (non-blocking — timer ISR handles it)
            expression = "normal"
            gaze_x = 0
            gaze_y = 0
            audio.play_buffer(audio_data)
            speaking = True
        else:
            # No audio — pause briefly and return to idle
            print("Speech skipped — no audio data")
            time.sleep(1)
            behavior.interaction_done()
            gc.collect()

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
