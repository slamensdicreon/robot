from machine import Pin
import time

pir = Pin(22, Pin.IN)

print("PIR test — wave your hand in front of the sensor")
print("Reading every 0.5s for 30 seconds...")
print()

for i in range(60):
    val = pir.value()
    status = "** MOTION **" if val else "  nothing  "
    print(f"[{i*0.5:5.1f}s] PIR = {val}  {status}")
    time.sleep(0.5)

print("\nDone.")
