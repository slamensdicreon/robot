"""Quick test for HC-SR04 ultrasonic sensor on GP26 (trig) / GP27 (echo).

Paste into Thonny REPL or run as a file. Prints distance every second.
If you only see 'TIMEOUT', check wiring:
  - TRIG → GP26
  - ECHO → 1kΩ+2kΩ voltage divider → GP27
  - VCC  → VSYS (5V)
  - GND  → GND
"""
from machine import Pin
import time

trig = Pin(26, Pin.OUT)
echo = Pin(27, Pin.IN)

print("Ultrasonic test — GP26 trig, GP27 echo")
print("Hold your hand at different distances...\n")

while True:
    trig.value(0)
    time.sleep_us(5)
    trig.value(1)
    time.sleep_us(10)
    trig.value(0)

    # Wait for echo HIGH
    t0 = time.ticks_us()
    while echo.value() == 0:
        if time.ticks_diff(time.ticks_us(), t0) > 30000:
            break
    start = time.ticks_us()

    # Wait for echo LOW
    while echo.value() == 1:
        if time.ticks_diff(time.ticks_us(), start) > 30000:
            break
    end = time.ticks_us()

    dur = time.ticks_diff(end, start)
    if dur >= 30000:
        print("TIMEOUT  — no echo received (check wiring)")
    else:
        cm = (dur * 0.0343) / 2
        print("{:.1f} cm".format(cm))

    time.sleep(1)
