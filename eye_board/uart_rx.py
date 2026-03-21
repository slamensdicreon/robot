from machine import UART, Pin

# Eye board UART — GP0 TX, GP1 RX (UART0 on Pico LiPo)
uart = UART(0, baudrate=9600, tx=Pin(0), rx=Pin(1))


def poll():
    """Check UART for one incoming command. Non-blocking.

    Returns a tuple (command, value) or None.
    Examples: ("EXP", "alert"), ("GAZE", "10,5"), ("BLINK", ""), ("DART", "15,-10")
    """
    if not uart.any():
        return None

    try:
        raw = uart.readline()
        if raw is None:
            return None
        line = raw.decode("utf-8").strip()
        if not line:
            return None
    except (UnicodeError, OSError):
        return None

    # Parse command:value format
    if ":" in line:
        parts = line.split(":", 1)
        return (parts[0], parts[1])
    else:
        # Commands without values (e.g., "BLINK")
        return (line, "")
