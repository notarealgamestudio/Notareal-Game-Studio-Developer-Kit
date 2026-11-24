#!/usr/bin/env python3
"""ELF -> PS-X EXE (replacement for PSn00bSDK elf2x, which aborts with a fortify
buffer-overflow when built by Ubuntu's GCC). Usage: elf2exe.py [-q] in.elf out.exe"""
import sys, struct
args = [a for a in sys.argv[1:] if a != '-q']
src, dst = args[0], (args[1] if len(args) > 1 else args[0].rsplit('.', 1)[0] + '.exe')
e = open(src, 'rb').read()
assert e[:4] == b'\x7fELF' and e[5] == 1, 'need little-endian ELF32'
entry, phoff = struct.unpack_from('<II', e, 0x18)[0], struct.unpack_from('<I', e, 0x1C)[0]
phentsize, phnum = struct.unpack_from('<HH', e, 0x2A)
segs = []
for i in range(phnum):
    p_type, off, vaddr, paddr, filesz, memsz = struct.unpack_from('<IIIIII', e, phoff + i * phentsize)
    if p_type == 1 and filesz: segs.append((vaddr, e[off:off + filesz]))
base = min(v for v, _ in segs); end = max(v + len(d) for v, d in segs)
size = (end - base + 2047) & ~2047
body = bytearray(size)
for v, d in segs: body[v - base:v - base + len(d)] = d
hdr = bytearray(2048)
hdr[0:8] = b'PS-X EXE'
struct.pack_into('<IIII', hdr, 0x10, entry, 0, base, size)
lic = b'Sony Computer Entertainment Inc. for North America area'
hdr[0x4C:0x4C + len(lic)] = lic
open(dst, 'wb').write(hdr + body)
if '-q' not in sys.argv: print(f'pc:{entry:08x} t_addr:{base:08x} t_size:{size}')
