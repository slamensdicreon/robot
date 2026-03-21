from machine import UART, Pin

# Brain board UART — GP12 TX, GP13 RX (UART1 on Pico W)
uart = UART(1, baudrate=9600, tx=Pin(12), rx=Pin(13))


def send(cmd):
    """Send a command string to the eye board over UART.
    Appends newline automatically."""
    uart.write(cmd.encode() + b"\n")


def send_expression(expr):
    """Send expression change: normal, alert, angry, sleepy, thinking."""
    send("EXP:" + expr)


def send_gaze(x, y):
    """Send smooth gaze shift to absolute position."""
    send("GAZE:{},{}".format(x, y))


def send_blink():
    """Trigger a single blink on the eye board."""
    send("BLINK")


def send_dart(x, y):
    """Trigger a sharp snap to position."""
    send("DART:{},{}".format(x, y))


def send_presence(detected):
    """Send presence state: True=detected, False=cleared."""
    send("PRESENCE:{}".format(1 if detected else 0))
