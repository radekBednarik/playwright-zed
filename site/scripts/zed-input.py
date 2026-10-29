#!/usr/bin/env python3
"""Inject keyboard input through the desktop RemoteDesktop portal (feature 010).

    python3 site/scripts/zed-input.py session                 # first call: approve the dialog once
    python3 site/scripts/zed-input.py key ctrl+shift+p
    python3 site/scripts/zed-input.py type "zed: install dev extension"
    python3 site/scripts/zed-input.py key Return
    python3 site/scripts/zed-input.py seq "key ctrl+shift+p" "type zed: extensions" "key Return"
    python3 site/scripts/zed-input.py seq "moveto 1338 831" "click"   # screen pixels, left button

Used to stage documentation screenshots without touching the owner's keyboard. The first
call shows the portal's "remote control" dialog once; the answer is remembered through a
restore token stored next to the screenshot profile
(~/.cache/playwright-zed-screenshots/remote-desktop-token). Keystrokes go to the focused
window, so nobody should type while a sequence runs. Requires python3-gi.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import gi  # type: ignore

gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
from gi.repository import Gio, GLib  # type: ignore

PROFILE = Path(os.environ.get("PLAYWRIGHT_ZED_SHOT_PROFILE", Path.home() / ".cache" / "playwright-zed-screenshots"))
TOKEN_FILE = PROFILE / "remote-desktop-token"
PORTAL = "org.freedesktop.portal.Desktop"
PORTAL_PATH = "/org/freedesktop/portal/desktop"
RD = "org.freedesktop.portal.RemoteDesktop"
KEY_DELAY = 0.04

KEYSYMS = {
    "ctrl": 0xFFE3, "control": 0xFFE3, "shift": 0xFFE1, "alt": 0xFFE9, "super": 0xFFEB,
    "return": 0xFF0D, "enter": 0xFF0D, "escape": 0xFF1B, "esc": 0xFF1B, "tab": 0xFF09,
    "backspace": 0xFF08, "delete": 0xFFFF, "space": 0x20, "up": 0xFF52, "down": 0xFF54,
    "left": 0xFF51, "right": 0xFF53, "home": 0xFF50, "end": 0xFF57, "pageup": 0xFF55,
    "pagedown": 0xFF56, "period": 0x2E, "comma": 0x2C, "minus": 0x2D, "f1": 0xFFBE,
    "f2": 0xFFBF, "f5": 0xFFC2, "f11": 0xFFC8,
}


class Portal:
    def __init__(self) -> None:
        self.bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        self.sender = self.bus.get_unique_name()[1:].replace(".", "_")
        self.counter = 0
        self.session: str | None = None

    def _request(self, method: str, args: GLib.Variant, token: str, timeout: int = 120) -> dict:
        request_path = f"/org/freedesktop/portal/desktop/request/{self.sender}/{token}"
        loop = GLib.MainLoop()
        result: dict = {}

        def on_response(_c, _s, _p, _i, _sig, params):
            result["response"] = params.unpack()
            loop.quit()

        sub = self.bus.signal_subscribe(PORTAL, "org.freedesktop.portal.Request", "Response", request_path, None, Gio.DBusSignalFlags.NONE, on_response)
        self.bus.call_sync(PORTAL, PORTAL_PATH, RD, method, args, None, Gio.DBusCallFlags.NONE, timeout * 1000, None)
        GLib.timeout_add_seconds(timeout, loop.quit)
        loop.run()
        self.bus.signal_unsubscribe(sub)
        if "response" not in result:
            sys.exit(f"portal: no answer to {method} within {timeout} s (a dialog may be waiting)")
        code, data = result["response"]
        if code != 0:
            sys.exit(f"portal: {method} refused (response {code})")
        return data

    def _token(self) -> str:
        self.counter += 1
        return f"pz{self.counter}"

    def start(self) -> None:
        token = self._token()
        data = self._request("CreateSession", GLib.Variant("(a{sv})", ({
            "handle_token": GLib.Variant("s", token),
            "session_handle_token": GLib.Variant("s", f"s{token}"),
        },)), token)
        self.session = data["session_handle"]
        token = self._token()
        select = {
            "handle_token": GLib.Variant("s", token),
            "types": GLib.Variant("u", 1 | 2),  # keyboard | pointer
            "persist_mode": GLib.Variant("u", 2),  # remember across sessions
        }
        if TOKEN_FILE.is_file():
            select["restore_token"] = GLib.Variant("s", TOKEN_FILE.read_text().strip())
        self._request("SelectDevices", GLib.Variant("(oa{sv})", (self.session, select)), token)
        token = self._token()
        data = self._request("Start", GLib.Variant("(osa{sv})", (self.session, "", {"handle_token": GLib.Variant("s", token)})), token)
        restore = data.get("restore_token")
        if restore:
            TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
            TOKEN_FILE.write_text(restore)

    def keysym(self, sym: int, pressed: bool) -> None:
        assert self.session
        self.bus.call_sync(PORTAL, PORTAL_PATH, RD, "NotifyKeyboardKeysym",
                           GLib.Variant("(oa{sv}iu)", (self.session, {}, sym, 1 if pressed else 0)),
                           None, Gio.DBusCallFlags.NONE, 5000, None)
        time.sleep(KEY_DELAY)

    def key(self, combo: str) -> None:
        syms = []
        for part in [p for p in combo.lower().split("+") if p]:
            if part in KEYSYMS:
                syms.append(KEYSYMS[part])
            elif len(part) == 1:
                syms.append(ord(part))
            else:
                sys.exit(f"unknown key: {part}")
        for sym in syms:
            self.keysym(sym, True)
        for sym in reversed(syms):
            self.keysym(sym, False)
        time.sleep(0.08)

    def move(self, dx: float, dy: float) -> None:
        assert self.session
        self.bus.call_sync(PORTAL, PORTAL_PATH, RD, "NotifyPointerMotion",
                           GLib.Variant("(oa{sv}dd)", (self.session, {}, float(dx), float(dy))),
                           None, Gio.DBusCallFlags.NONE, 5000, None)
        time.sleep(KEY_DELAY)

    def moveto(self, x: float, y: float) -> None:
        # Relative motion only: park the pointer in the top-left corner first.
        self.move(-10000, -10000)
        self.move(x, y)
        time.sleep(0.1)

    def click(self, button: int = 272) -> None:  # 272 = BTN_LEFT
        assert self.session
        for state in (1, 0):
            self.bus.call_sync(PORTAL, PORTAL_PATH, RD, "NotifyPointerButton",
                               GLib.Variant("(oa{sv}iu)", (self.session, {}, button, state)),
                               None, Gio.DBusCallFlags.NONE, 5000, None)
            time.sleep(KEY_DELAY)
        time.sleep(0.1)

    def type_text(self, text: str) -> None:
        for ch in text:
            sym = KEYSYMS["return"] if ch == "\n" else ord(ch)
            self.keysym(sym, True)
            self.keysym(sym, False)
        time.sleep(0.1)


def run(portal: Portal, command: str, arg: str) -> None:
    if command == "key":
        portal.key(arg)
    elif command == "type":
        portal.type_text(arg)
    elif command == "sleep":
        time.sleep(float(arg))
    elif command == "moveto":
        x, y = arg.split()
        portal.moveto(float(x), float(y))
    elif command == "click":
        portal.click(int(arg) if arg else 272)
    else:
        sys.exit(f"unknown command: {command}")


def main() -> None:
    argv = sys.argv[1:]
    if not argv:
        sys.exit(__doc__)
    portal = Portal()
    portal.start()
    if argv[0] == "session":
        print("remote desktop session started" + (", token stored" if TOKEN_FILE.is_file() else ""))
    elif argv[0] == "seq":
        for step in argv[1:]:
            command, _, arg = step.partition(" ")
            run(portal, command, arg)
    else:
        run(portal, argv[0], " ".join(argv[1:]))


if __name__ == "__main__":
    main()
