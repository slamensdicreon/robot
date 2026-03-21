import time
import random
from eye import draw_eye


def blink(gaze_x=0, gaze_y=0, expression="normal", speed=0.025):
    """Single blink — close then open over 12 frames."""
    for i in range(6):
        draw_eye(gaze_x, gaze_y, i / 6, expression)
        time.sleep(speed)
    for i in range(6, -1, -1):
        draw_eye(gaze_x, gaze_y, i / 6, expression)
        time.sleep(speed)


def double_blink(gaze_x=0, gaze_y=0, expression="normal"):
    """Two quick blinks in succession."""
    blink(gaze_x, gaze_y, expression, speed=0.02)
    time.sleep(0.08)
    blink(gaze_x, gaze_y, expression, speed=0.02)


def glance(from_x, from_y, target_x, target_y, expression="normal", steps=10):
    """Smooth gaze movement from one position to another."""
    for i in range(steps + 1):
        x = int(from_x + (target_x - from_x) * i / steps)
        y = int(from_y + (target_y - from_y) * i / steps)
        draw_eye(x, y, 0, expression)
        time.sleep(0.025)


def dart(gaze_x, gaze_y, expression="normal"):
    """Sharp snap to a position with slight settle-back."""
    draw_eye(gaze_x, gaze_y, 0, expression)
    time.sleep(0.08)
    settle_x = int(gaze_x * 0.85)
    settle_y = int(gaze_y * 0.85)
    glance(gaze_x, gaze_y, settle_x, settle_y, expression, steps=4)


def micro_drift(gaze_x, gaze_y, expression="normal"):
    """Subtle idle eye movement — small random offsets then return."""
    for _ in range(3):
        dx = gaze_x + random.randint(-4, 4)
        dy = gaze_y + random.randint(-3, 3)
        draw_eye(dx, dy, 0, expression)
        time.sleep(0.06)
    draw_eye(gaze_x, gaze_y, 0, expression)


def slow_look_down(gaze_x, gaze_y, expression="normal"):
    """Slow downward glance then return to position — used in idle."""
    glance(gaze_x, gaze_y, gaze_x, gaze_y + 20, expression, steps=15)
    time.sleep(0.3)
    glance(gaze_x, gaze_y + 20, gaze_x, gaze_y, expression, steps=15)
