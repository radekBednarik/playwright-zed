#!/usr/bin/env python3
"""Capture a documentation screenshot through the desktop portal (feature 010).

    python3 site/scripts/capture-screenshot.py <scene-id> [--delay 3] [--full]
                                               [--force] [--top <px>] [--import <png>]

Calls org.freedesktop.portal.Screenshot (non-interactive; GNOME asks for permission once
per user and remembers the answer), waits for the portal's Response signal, crops the
GNOME top bar unless --full is given, and writes
site/src/assets/screenshots/<scene-id>.png. With --import <png> an existing file (for
example one taken with GNOME's own Print-key UI) is filed instead of calling the portal.

Cropping uses ImageMagick's `magick` when present, otherwise Pillow. The default top bar
height (TOP_BAR_PX) was calibrated on the owner's 1920 x 1200 display at scale 1
(task T008). Requires python3-gi (GLib bindings), already present on Ubuntu desktops.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import unquote, urlparse

TOP_BAR_PX = 32  # GNOME 50 top bar on the owner's 1920 x 1200 display at scale 1 (task T008, measured 2026-10-29)
BOTTOM_DOCK_PX = 49  # Ubuntu dock at the bottom of the same display (measured 2026-10-29)
OUT_DIR = Path(__file__).resolve().parent.parent / "src" / "assets" / "screenshots"


def portal_screenshot(timeout_s: int = 20) -> Path:
    import gi  # type: ignore

    gi.require_version("Gio", "2.0")
    gi.require_version("GLib", "2.0")
    from gi.repository import Gio, GLib  # type: ignore

    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    loop = GLib.MainLoop()
    result: dict = {}

    def on_response(_c, _s, _p, _i, _sig, params):
        result["response"] = params.unpack()
        loop.quit()

    bus.signal_subscribe(
        "org.freedesktop.portal.Desktop",
        "org.freedesktop.portal.Request",
        "Response",
        None,
        None,
        Gio.DBusSignalFlags.NONE,
        on_response,
    )
    options = {
        "interactive": GLib.Variant("b", False),
        "modal": GLib.Variant("b", False),
    }
    bus.call_sync(
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.Screenshot",
        "Screenshot",
        GLib.Variant("(sa{sv})", ("", options)),
        None,
        Gio.DBusCallFlags.NONE,
        timeout_s * 1000,
        None,
    )
    GLib.timeout_add_seconds(timeout_s, loop.quit)
    loop.run()
    if "response" not in result:
        sys.exit("portal did not answer within %d s (a permission dialog may be open)" % timeout_s)
    code, data = result["response"]
    if code != 0:
        sys.exit("portal refused the screenshot (response code %s)" % code)
    uri = data.get("uri")
    if not uri:
        sys.exit("portal answered without a file uri")
    return Path(unquote(urlparse(uri).path))


def image_size(path: Path) -> tuple[int, int]:
    if shutil.which("magick"):
        out = subprocess.check_output(["magick", "identify", "-format", "%w %h", str(path)], text=True)
        w, h = out.split()
        return int(w), int(h)
    from PIL import Image  # type: ignore

    with Image.open(path) as im:
        return im.size


def crop_edges(src: Path, dst: Path, top: int, bottom: int) -> None:
    w, h = image_size(src)
    if top <= 0 and bottom <= 0:
        shutil.copyfile(src, dst)
        return
    if shutil.which("magick"):
        subprocess.check_call(["magick", str(src), "-crop", f"{w}x{h - top - bottom}+0+{top}", "+repage", str(dst)])
        return
    from PIL import Image  # type: ignore

    with Image.open(src) as im:
        im.crop((0, top, w, h - bottom)).save(dst)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scene", help="scene id, becomes <scene>.png (kebab-case)")
    ap.add_argument("--delay", type=float, default=3.0, help="seconds to wait before capturing (default 3)")
    ap.add_argument("--full", action="store_true", help="keep the whole screen (no top bar crop)")
    ap.add_argument("--force", action="store_true", help="overwrite an existing file")
    ap.add_argument("--top", type=int, default=TOP_BAR_PX, help="top bar height in px to crop (default %d)" % TOP_BAR_PX)
    ap.add_argument("--bottom", type=int, default=BOTTOM_DOCK_PX, help="dock height in px to crop at the bottom (default %d)" % BOTTOM_DOCK_PX)
    ap.add_argument("--import", dest="import_file", help="file this PNG instead of calling the portal")
    args = ap.parse_args()

    if not args.scene.replace("-", "").isalnum() or args.scene != args.scene.lower():
        sys.exit("scene id must be lower-case kebab-case")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dst = OUT_DIR / f"{args.scene}.png"
    if dst.exists() and not args.force:
        sys.exit(f"{dst} exists; pass --force to overwrite")

    temporary = False
    if args.import_file:
        src = Path(args.import_file).expanduser().resolve()
        if not src.is_file():
            sys.exit(f"{src} is not a file")
    else:
        if args.delay > 0:
            print(f"capturing in {args.delay:g} s ...", flush=True)
            time.sleep(args.delay)
        src = portal_screenshot()
        temporary = True

    crop_edges(src, dst, 0 if args.full else args.top, 0 if args.full else args.bottom)
    if temporary:
        try:
            os.remove(src)
        except OSError:
            pass
    w, h = image_size(dst)
    print(f"{dst} ({w} x {h})")


if __name__ == "__main__":
    main()
