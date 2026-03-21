from picographics import PicoGraphics, DISPLAY_PICO_DISPLAY
from machine import Pin, PWM
import math

# Backlight — BL pin confirmed as Pin(20) for working display (Deck 2)
bl = PWM(Pin(20))
bl.freq(1000)
bl.duty_u16(65535)

display = PicoGraphics(display=DISPLAY_PICO_DISPLAY, rotate=90)
WIDTH, HEIGHT = display.get_bounds()  # Returns 135, 240

# Colors — created once at module level
BLACK = display.create_pen(0, 0, 0)
WHITE = display.create_pen(255, 255, 255)
BLUE = display.create_pen(30, 100, 220)
DARK_BLUE = display.create_pen(10, 40, 120)
CYAN = display.create_pen(0, 220, 255)
PUPIL = display.create_pen(5, 5, 5)
RED = display.create_pen(180, 20, 20)
DARK_RED = display.create_pen(80, 10, 10)

# Expression color map: (iris_outer, iris_mid, iris_highlight)
EXPRESSIONS = {
    "normal":   (BLUE, DARK_BLUE, CYAN),
    "alert":    (CYAN, BLUE, CYAN),
    "angry":    (RED, DARK_RED, RED),
    "sleepy":   (DARK_BLUE, BLUE, DARK_BLUE),
    "thinking": (DARK_BLUE, BLUE, DARK_BLUE),
}

# Pupil sizes per expression
PUPIL_SIZES = {
    "normal":   22,
    "alert":    28,
    "angry":    22,
    "sleepy":   18,
    "thinking": 18,
}


def fill_ellipse(cx, cy, rx, ry, pen):
    """Draw a filled ellipse using horizontal rectangle rows.
    CRITICAL: PicoGraphics has no ellipse() method — this is the only way."""
    display.set_pen(pen)
    for y in range(-ry, ry + 1):
        x_width = int(rx * math.sqrt(max(0, 1 - (y / ry) ** 2)))
        if x_width > 0:
            display.rectangle(cx - x_width, cy + y, x_width * 2, 1)


def draw_eye(gaze_x=0, gaze_y=0, lid_close=0, expression="normal"):
    """Render one complete eye frame. Call once per frame."""
    display.set_pen(BLACK)
    display.clear()
    cx = WIDTH // 2
    cy = HEIGHT // 2

    # Eye white — tall oval filling display vertically
    fill_ellipse(cx, cy, 62, 110, WHITE)

    # Iris colors by expression
    iris1, iris2, iris3 = EXPRESSIONS.get(expression, EXPRESSIONS["normal"])

    iris_x = cx + gaze_x
    iris_y = cy + gaze_y
    fill_ellipse(iris_x, iris_y, 48, 48, iris1)
    fill_ellipse(iris_x, iris_y, 40, 40, iris2)
    fill_ellipse(iris_x, iris_y, 44, 8, iris3)

    # Pupil
    pupil_size = PUPIL_SIZES.get(expression, 22)
    fill_ellipse(iris_x, iris_y, pupil_size, pupil_size, PUPIL)

    # Catchlights
    fill_ellipse(iris_x + 12, iris_y - 14, 7, 7, WHITE)
    fill_ellipse(iris_x - 8, iris_y + 10, 3, 3, WHITE)

    # Eyelids — lid_close 0=open, 1=fully closed
    if lid_close > 0:
        lid_height = int(110 * lid_close)
        display.set_pen(BLACK)
        display.rectangle(0, 0, WIDTH, cy - 110 + lid_height)
        display.rectangle(0, cy + 110 - lid_height, WIDTH, lid_height + 10)

    display.update()
