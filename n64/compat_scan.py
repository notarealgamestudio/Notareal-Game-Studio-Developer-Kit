"""NOTAREAL N64 compatibility scan: fail the build if the program contains CPU
instructions that older mupen64plus-based cores (stock ParaLLEl N64 in handheld
RetroArch, n64wasm) do not implement - they quit the emulator when they hit one.
Usage: compat_scan.py game.elf"""
import subprocess, sys, re, collections, os
FATAL = {"lld", "scd", "dmfc0", "dmtc0", "tge", "tgeu", "tlt", "tltu", "tne",
         "tgei", "tgeiu", "tlti", "tltiu", "teqi", "tnei"}
# SWL/SWR/SDL/SDR to uncached memory (framebuffer, 0xA0xxxxxx) hit a BRK in the old ARM64
# dynarec (do_unalignedwritestub) -> SIGTRAP. Fatal inside memcpy/memset (the kit's
# nr_memfix.o replaces both); anywhere else it's a warning to check.
UNALIGNED_STORE_FATAL_IN = {"memcpy", "memset", "memmove"}
WARN = {"ldl", "ldr", "sdl", "sdr", "swl", "swr",   # 64-bit unaligned: mistranslated by old ARM64 dynarec (kit builds with -mmemcpy; leftovers are crash/video/decompress paths)
        "break", "bal", "bgezal", "bltzal", "bgezall", "bltzall"}   # BxxZAL: crash old ARM64 dynarec if executed (only in decompressors - keep compression off)   # only runs on divide-by-zero / asserts; fine unless reached
elf = sys.argv[1]
dis = subprocess.run([os.path.join(os.environ.get("N64_INST", "/opt/libdragon"), "bin/mips64-elf-objdump"), "-d", "--no-show-raw-insn", elf], capture_output=True, text=True).stdout
dis_raw = subprocess.run([os.path.join(os.environ.get("N64_INST", "/opt/libdragon"), "bin/mips64-elf-objdump"), "-d", elf], capture_output=True, text=True).stdout
hits = collections.defaultdict(list); func = "?"
for line in dis.splitlines():
    m = re.match(r"^[0-9a-f]+ <(.+)>:", line)
    if m: func = m.group(1); continue
    m = re.match(r"^\s*([0-9a-f]+):\s+(\S+)", line)
    if m and m.group(2) in FATAL | WARN:
        hits[m.group(2)].append((m.group(1), func))
emux = []; func = "?"
for l in dis_raw.splitlines():
    m = re.match(r"^[0-9a-f]+ <(.+)>:", l)
    if m: func = m.group(1); continue
    if re.search(r"\t4[0-3][0-9a-f]{6} \tc0\t", l):
        if func == "_abort": print("warn: raw COP0 opcode in _abort (only reached after a crash)")
        else: emux.append((l, func))
bad = 0
for op, lst in sorted(hits.items()):
    fatal = op in FATAL or (op in ("swl", "swr", "sdl", "sdr") and any(f in UNALIGNED_STORE_FATAL_IN for _, f in lst))
    level = "FAIL" if fatal else "warn"
    if fatal: bad += len(lst)
    fns = sorted(set(f for _, f in lst))
    print(f"{level}: {op} x{len(lst)} in {', '.join(fns[:6])}{' ...' if len(fns) > 6 else ''}")
if emux:
    bad += len(emux); print(f"FAIL: EMUX/raw COP0 opcode x{len(emux)} in {sorted(set(f for _, f in emux))}")
# compressed assets (header CMPx or DCAx) make libdragon run its LZ4/Shrinkler decompressors (BGEZAL -> crash on old ARM64 cores)
import glob
fsdir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(elf))), "filesystem")
for f in sorted(glob.glob(os.path.join(fsdir, "**", "*"), recursive=True)):
    if os.path.isfile(f) and open(f, "rb").read(3) in (b"CMP", b"DCA"):
        bad += 1; print("FAIL: compressed asset (rebuild with mksprite -c 0):", os.path.relpath(f, fsdir))
print("compat scan:", "PASS" if not bad else f"FAIL ({bad} problems)")
sys.exit(1 if bad else 0)
