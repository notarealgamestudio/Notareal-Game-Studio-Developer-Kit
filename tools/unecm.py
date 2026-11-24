#!/usr/bin/env python3
"""Minimal ECM decoder (Neill Corlett format). Restores sector layout; EDC/ECC are
zero-filled, which is fine for reading files (catalog scans) but NOT for burning."""
import sys
def main(src, dst):
    f = open(src, 'rb'); o = open(dst, 'wb')
    if f.read(4) != b'ECM\0': sys.exit('not ECM')
    sync = b'\x00' + b'\xff'*10 + b'\x00'
    while True:
        c = f.read(1)[0]; t = c & 3; n = (c >> 2) & 0x1F; bits = 5
        while c & 0x80:
            c = f.read(1)[0]; n |= (c & 0x7F) << bits; bits += 7
        if n == 0xFFFFFFFF: break
        n += 1
        if t == 0:
            o.write(f.read(n)); continue
        for _ in range(n):
            if t == 1:
                addr = f.read(3); data = f.read(2048)
                o.write(sync + addr + b'\x01' + data + bytes(288))
            elif t == 2:
                d = f.read(2052); o.write(d[:4] + d + bytes(280))
            else:
                d = f.read(2328); o.write(d[:4] + d + bytes(4))
    o.close()
if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
