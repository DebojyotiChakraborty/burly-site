#!/usr/bin/env python3
"""Resizes simulator PNG captures (1206 x 2622) to the site's 804 x 1748 WebP.

    to_webp.py <png dir> <out dir>
"""
import glob
import os
import sys

from PIL import Image


def main(src, dst):
    os.makedirs(dst, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(src, "*.png"))):
        image = Image.open(path).convert("RGB").resize((804, 1748), Image.LANCZOS)
        out = os.path.join(dst, os.path.basename(path)[:-4] + ".webp")
        image.save(out, "WEBP", quality=84, method=6)
        print(out, os.path.getsize(out) // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
