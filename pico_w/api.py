"""WiFi connection, Claude API, and ElevenLabs TTS client for Pico W.

Handles all network operations. Designed for 264KB RAM constraint:
- Claude responses capped at 100 tokens
- ElevenLabs audio buffer pre-allocated and reused
- All calls wrapped in try/except for graceful degradation
"""

import json
import time
import random
import gc
import network

# --- Pre-allocated audio receive buffer (reused across calls) ---
_AUDIO_BUF_SIZE = 40000
_audio_buf = bytearray(_AUDIO_BUF_SIZE)

# --- WiFi state ---
_wlan = None


def load_config():
    """Load config.json from Pico W filesystem."""
    with open("config.json", "r") as f:
        return json.load(f)


def connect_wifi(config):
    """Connect to WiFi with retry. Returns True on success."""
    global _wlan
    _wlan = network.WLAN(network.STA_IF)
    _wlan.active(True)

    ssid = config["wifi_ssid"]
    password = config["wifi_password"]

    for attempt in range(3):
        print("WiFi attempt {}/3: {}".format(attempt + 1, ssid))
        _wlan.connect(ssid, password)

        # Wait up to 10 seconds for connection
        for _ in range(20):
            if _wlan.isconnected():
                print("WiFi connected:", _wlan.ifconfig()[0])
                return True
            time.sleep(0.5)

        _wlan.disconnect()
        time.sleep(1)

    print("WiFi failed after 3 attempts")
    return False


def check_wifi():
    """Return True if WiFi is currently connected."""
    return _wlan is not None and _wlan.isconnected()


def reconnect_wifi(config):
    """Attempt single WiFi reconnection. Returns True on success."""
    if check_wifi():
        return True
    print("WiFi reconnecting...")
    _wlan.connect(config["wifi_ssid"], config["wifi_password"])
    for _ in range(20):
        if _wlan.isconnected():
            print("WiFi reconnected")
            return True
        time.sleep(0.5)
    return False


def _get_fallback(config):
    """Return a random fallback response string."""
    fallbacks = config.get("fallback_responses", ["Hello there."])
    return fallbacks[random.randint(0, len(fallbacks) - 1)]


def call_claude(action, config):
    """Call Claude API and return text response.

    Args:
        action: "greet" or "interact" — determines the user message
        config: dict with claude_api_key, system_prompt

    Returns:
        str — Claude's response text, or a fallback on failure
    """
    import urequests

    if action == "greet":
        user_msg = "Someone just walked up to your desk. Greet them briefly."
    elif action == "interact":
        user_msg = "Someone is standing very close to you. React to their presence."
    else:
        user_msg = "Say something."

    headers = {
        "Content-Type": "application/json",
        "x-api-key": config["claude_api_key"],
        "anthropic-version": "2023-06-01"
    }

    payload = {
        "model": "claude-haiku-4-5",
        "max_tokens": 100,
        "system": config.get("system_prompt", "You are Rudy, a sharp desk robot. 2 sentences max."),
        "messages": [{"role": "user", "content": user_msg}]
    }

    response = None
    try:
        response = urequests.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=payload
        )
        data = response.json()
        text = data["content"][0]["text"]
        print("Claude:", text)
        return text
    except Exception as e:
        print("Claude API error:", e)
        return _get_fallback(config)
    finally:
        if response:
            response.close()
        gc.collect()


def call_elevenlabs(text, config):
    """Call ElevenLabs TTS API and return mu-law audio bytes.

    Uses raw sockets for reliable binary response handling (urequests
    may not handle binary content correctly on all MicroPython builds).

    Args:
        text: string to convert to speech
        config: dict with elevenlabs_api_key, elevenlabs_voice_id

    Returns:
        memoryview of audio bytes, or None on failure
    """
    import usocket
    import ussl

    voice_id = config.get("elevenlabs_voice_id", "pNInz6obpgDQGcFmaJgB")  # Default: Adam
    api_key = config["elevenlabs_api_key"]

    # Build JSON body manually to avoid importing json encoder overhead
    body = '{"text":"' + text.replace('"', '\\"').replace('\n', ' ') + '","model_id":"eleven_turbo_v2_5"}'
    body_bytes = body.encode("utf-8")

    host = "api.elevenlabs.io"
    path = "/v1/text-to-speech/{}?output_format=ulaw_8000".format(voice_id)

    request = (
        "POST {} HTTP/1.0\r\n"
        "Host: {}\r\n"
        "xi-api-key: {}\r\n"
        "Content-Type: application/json\r\n"
        "Accept: audio/basic\r\n"
        "Content-Length: {}\r\n"
        "\r\n"
    ).format(path, host, api_key, len(body_bytes))

    sock = None
    try:
        # DNS lookup + connect
        addr = usocket.getaddrinfo(host, 443)[0][-1]
        sock = usocket.socket()
        sock.settimeout(15)
        sock.connect(addr)
        sock = ussl.wrap_socket(sock, server_hostname=host)

        # Send request + body
        sock.write(request.encode("utf-8"))
        sock.write(body_bytes)

        # Read HTTP response line
        line = sock.readline()
        if not line:
            print("ElevenLabs: empty response")
            return None

        status_code = int(line.split(b" ")[1])
        if status_code != 200:
            print("ElevenLabs HTTP", status_code)
            # Read and discard remaining headers + body for error info
            while True:
                h = sock.readline()
                if not h or h == b"\r\n":
                    break
            error_body = sock.read(500)
            if error_body:
                print("Error:", error_body[:200])
            return None

        # Skip remaining headers, look for Content-Length
        content_length = 0
        while True:
            header = sock.readline()
            if not header or header == b"\r\n":
                break
            if header.lower().startswith(b"content-length:"):
                content_length = int(header.split(b":")[1].strip())

        # Read audio body into pre-allocated buffer
        total = 0
        if content_length > 0:
            # Known length — read exactly that many bytes
            to_read = min(content_length, _AUDIO_BUF_SIZE)
            while total < to_read:
                chunk = sock.read(min(512, to_read - total))
                if not chunk:
                    break
                n = len(chunk)
                _audio_buf[total:total + n] = chunk
                total += n
        else:
            # Chunked or unknown length — read until EOF
            while total < _AUDIO_BUF_SIZE:
                chunk = sock.read(512)
                if not chunk:
                    break
                n = len(chunk)
                _audio_buf[total:total + n] = chunk
                total += n

        print("ElevenLabs: {} bytes ({:.1f}s audio)".format(total, total / 8000))

        if total == 0:
            return None

        return memoryview(_audio_buf)[:total]

    except Exception as e:
        print("ElevenLabs error:", e)
        return None
    finally:
        if sock:
            try:
                sock.close()
            except:
                pass
        gc.collect()
