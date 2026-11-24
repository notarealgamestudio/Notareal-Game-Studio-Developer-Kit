"""Pad or trim a ROM to an exact power-of-two size (some emulators dislike odd sizes or ROMs under 1 MiB)."""
import sys
p, size = sys.argv[1], int(sys.argv[2]) << 20
d = open(p, "rb").read()
assert all(b == 0 or b == 0xFF for b in d[size:]), "ROM content beyond the target size"
d = d[:size] + bytes(size - len(d[:size]))
open(p, "wb").write(d)
print(p, len(d))
