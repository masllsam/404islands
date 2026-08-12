"""A PNG encoder in the standard library.

The kernel may not take dependencies (AGENTS.md §8) -- this code has to be
buildable in twenty years, and an image library is not worth breaking that for.
PNG is a small, fully-specified format (RFC 2083) whose only hard part is zlib,
which is in the standard library.  Sixty lines buys us permanent independence.
"""

from __future__ import annotations

import struct
import zlib

import numpy as np


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def encode(rgb: np.ndarray, level: int = 6) -> bytes:
    """Encode an (h, w, 3) uint8 array as a PNG byte string."""
    if rgb.ndim != 3 or rgb.shape[2] != 3:
        raise ValueError(f"expected (h, w, 3), got {rgb.shape}")
    arr = np.ascontiguousarray(rgb, dtype=np.uint8)
    h, w = arr.shape[:2]

    # Filter type 0 (None) on every scanline.  Filtering would compress better,
    # but a byte-exact, trivially re-implementable encoder is worth more here
    # than a smaller file.
    raw = np.zeros((h, w * 3 + 1), dtype=np.uint8)
    raw[:, 1:] = arr.reshape(h, w * 3)

    return b"".join([
        b"\x89PNG\r\n\x1a\n",
        _chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)),
        _chunk(b"IDAT", zlib.compress(raw.tobytes(), level)),
        _chunk(b"IEND", b""),
    ])


def write(path, rgb: np.ndarray, level: int = 6) -> None:
    with open(path, "wb") as fh:
        fh.write(encode(rgb, level))
