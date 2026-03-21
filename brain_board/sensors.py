from machine import Pin
import time
# --- Pin setup ---
pir_pin = Pin(16, Pin.IN)
trig_pin = Pin(14, Pin.OUT)
echo_pin = Pin(15, Pin.IN)


def poll_pir():
    """Read PIR sensor. Returns True if presence detected."""
    return pir_pin.value() == 1


def poll_ultrasonic():
    """Read HC-SR04 distance in cm. Returns None on timeout.

    WIRING NOTE: ECHO pin outputs 5V — use a voltage divider
    (1kΩ + 2kΩ) to step down to 3.3V before connecting to GP15.
    """
    trig_pin.value(0)
    time.sleep_us(5)
    trig_pin.value(1)
    time.sleep_us(10)
    trig_pin.value(0)

    # Wait for echo to go high (timeout after 30ms)
    timeout = time.ticks_us()
    while echo_pin.value() == 0:
        if time.ticks_diff(time.ticks_us(), timeout) > 30000:
            return None
    start = time.ticks_us()

    # Wait for echo to go low (timeout after 30ms)
    while echo_pin.value() == 1:
        if time.ticks_diff(time.ticks_us(), start) > 30000:
            return None
    end = time.ticks_us()

    duration = time.ticks_diff(end, start)
    distance_cm = (duration * 0.0343) / 2
    return distance_cm
