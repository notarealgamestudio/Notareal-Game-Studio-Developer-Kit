"""NOTAREAL Research Lab: fingerprint retail ROMs/discs for the dev kit.
Records what a real game uses (boot code, RSP microcodes, compression, SDK libraries,
file layout) so the kit can copy proven, emulator-friendly choices.
usage: romscan.py catalog.sqlite file [file...]"""
import sys, os, re, struct, sqlite3, zlib, hashlib, collections

def n64_load(p):
    d = open(p, "rb").read()
    m = d[:4]
    if m == b"\x37\x80\x40\x12":   # .v64 byteswapped
        d = bytes(b for i in range(0, len(d), 2) for b in (d[i+1], d[i]))
    elif m == b"\x40\x12\x37\x80": # .n64 little endian
        d = b"".join(d[i:i+4][::-1] for i in range(0, len(d), 4))
    return d

CICS = {0x6170A4A1: "6101", 0x90BB6CB5: "6102/7101", 0x0B050EE0: "6103/7103",
        0x98BC2C86: "6105/7105", 0xACC8580A: "6106/7106"}

def scan_n64(p, out):
    d = n64_load(p)
    title = d[0x20:0x34].decode("ascii", "replace").strip()
    out.append(("header", "title", title))
    out.append(("header", "game_code", d[0x3B:0x3F].decode("ascii", "replace")))
    out.append(("header", "entry", "0x%08X" % struct.unpack(">I", d[8:12])[0]))
    out.append(("header", "rom_mb", str(len(d) >> 20)))
    crc = zlib.crc32(d[0x40:0x1000]) & 0xFFFFFFFF
    out.append(("boot", "ipl3_crc32", "0x%08X" % crc))
    # RSP microcode banners (graphics + audio)
    seen = set()
    for m in re.finditer(rb"RSP (?:Gfx|SW|Audio)[ -~]{4,80}", d):
        s = m.group().decode("ascii", "replace").strip()
        if s not in seen:
            seen.add(s); out.append(("rsp_ucode", "banner", s))
    for name in (b"F3DEX2", b"F3DEX", b"F3DLX", b"F3DLP", b"S2DEX", b"L3DEX", b"F3DZEX", b"Turbo3D", b"Fast3D", b"aspMain", b"n_aspMain"):
        c = d.count(name)
        if c: out.append(("rsp_ucode", "name_hits", "%s x%d" % (name.decode(), c)))
    # SDK / library strings
    for pat in (rb"libultra[ -~]{0,40}", rb"N64 [Ss][Dd][Kk][ -~]{0,30}", rb"Nintendo 64 Library[ -~]{0,40}", rb"osInitialize", rb"__osException", rb"NuSystem[ -~]{0,30}", rb"Rare[ -~]{0,30}", rb"Factor 5[ -~]{0,30}", rb"MusyX[ -~]{0,30}"):
        m = re.search(pat, d)
        if m: out.append(("sdk", "string", m.group().decode("ascii", "replace")[:80]))
    # compression containers used by retail games
    for magic, label in ((b"MIO0", "MIO0 (Nintendo LZ)"), (b"Yay0", "Yay0 (Nintendo LZ)"), (b"Yaz0", "Yaz0 (Nintendo LZ)"), (b"\x1f\x8b\x08", "gzip"), (b"PERS-SZP", "Rare SZP")):
        c = d.count(magic)
        if c: out.append(("compression", label, "%d blocks" % c))
    # rough save type hints
    for k, label in ((b"EEPROM", "eeprom string"), (b"FLASH", "flash string"), (b"SRAM", "sram string"), (b"Controller Pak", "controller pak")):
        if k in d: out.append(("save", "hint", label))

def iso_from_bin(p):
    """Return a reader for ISO9660 2048-byte sectors from a MODE2/2352 (or 2048) image."""
    sz = os.path.getsize(p); f = open(p, "rb")
    if sz % 2352 == 0:
        f.seek(16 * 2352); raw = f.read(2352)
        if raw[24 + 1:24 + 6] == b"CD001": off, step = 24, 2352
        elif raw[16 + 1:16 + 6] == b"CD001": off, step = 16, 2352
        else: off, step = 0, 2048
    else: off, step = 0, 2048
    def sector(n): f.seek(n * step + off); return f.read(2048)
    return sector

def iso_walk(sector, lba, size, path="", depth=0, out=None):
    out = out if out is not None else []
    data = b"".join(sector(lba + i) for i in range((size + 2047) // 2048))
    i = 0
    while i < len(data):
        l = data[i]
        if l == 0:
            i = ((i // 2048) + 1) * 2048; continue
        rec = data[i:i + l]
        elba, esize, flags, nlen = struct.unpack("<I", rec[2:6])[0], struct.unpack("<I", rec[10:14])[0], rec[25], rec[32]
        name = rec[33:33 + nlen].decode("ascii", "replace").split(";")[0]
        if name not in ("\x00", "\x01"):
            full = path + "/" + name
            if flags & 2:
                if depth < 6: iso_walk(sector, elba, esize, full, depth + 1, out)
            else: out.append((full, elba, esize))
        i += l
    return out

def scan_psx(p, out):
    sector = iso_from_bin(p)
    pvd = sector(16)
    if pvd[1:6] != b"CD001":
        out.append(("disc", "error", "no ISO9660 found")); return
    out.append(("disc", "volume_id", pvd[40:72].decode("ascii", "replace").strip()))
    root = pvd[156:156 + 34]
    files = iso_walk(sector, struct.unpack("<I", root[2:6])[0], struct.unpack("<I", root[10:14])[0])
    out.append(("disc", "file_count", str(len(files))))
    exts = collections.Counter(os.path.splitext(f[0])[1].upper() or "(none)" for f in files)
    out.append(("disc", "extensions", ", ".join("%s:%d" % kv for kv in exts.most_common(12))))
    big = sorted(files, key=lambda f: -f[2])[:6]
    out.append(("disc", "largest", "; ".join("%s %dKB" % (f[0], f[2] >> 10) for f in big)))
    cnf = [f for f in files if f[0].upper().endswith("SYSTEM.CNF")]
    boot = None
    if cnf:
        t = b"".join(sector(cnf[0][1] + i) for i in range((cnf[0][2] + 2047) // 2048))[:cnf[0][2]].decode("ascii", "replace")
        out.append(("boot", "system.cnf", " | ".join(x.strip() for x in t.splitlines() if x.strip())))
        m = re.search(r"cdrom:\\?([^;\s]+)", t, re.I)
        if m: boot = m.group(1).replace("\\", "/").upper()
    if boot:
        ent = [f for f in files if f[0].upper().lstrip("/") == boot.lstrip("/")]
        if ent:
            exe = b"".join(sector(ent[0][1] + i) for i in range((ent[0][2] + 2047) // 2048))[:ent[0][2]]
            out.append(("boot", "exe", "%s %dKB" % (boot, len(exe) >> 10)))
            if exe[:8] == b"PS-X EXE":
                pc, gp, taddr, tsize = struct.unpack("<IIII", exe[16:32])
                out.append(("boot", "exe_header", "pc=0x%08X t_addr=0x%08X t_size=%dKB" % (pc, taddr, tsize >> 10)))
            libs = collections.Counter(m.group(1).decode() for m in re.finditer(rb"(LIB[A-Z0-9]{2,8})\b", exe))
            if libs: out.append(("sdk", "psyq_libs", ", ".join(k for k, _ in libs.most_common(20))))
            for pat in (rb"PsyQ[ -~]{0,30}", rb"Library Programs[ -~]{0,40}", rb"Sony Computer Entertainment[ -~]{0,30}", rb"Ver ?\d\.\d[ -~]{0,20}"):
                m = re.search(pat, exe)
                if m: out.append(("sdk", "string", m.group().decode("ascii", "replace")[:80]))
    for kind, exts_ in (("video", (".STR",)), ("audio", (".XA", ".VAG", ".VB", ".VH", ".SEQ", ".SEP")), ("textures", (".TIM",)), ("models", (".TMD", ".HMD"))):
        n = sum(1 for f in files if os.path.splitext(f[0])[1].upper() in exts_)
        if n: out.append(("assets", kind, "%d files" % n))

def scan_gba(p, out):
    d = open(p, "rb").read()
    out.append(("header", "title", d[0xA0:0xAC].decode("ascii", "replace").strip("\x00 ")))
    out.append(("header", "game_code", d[0xAC:0xB0].decode("ascii", "replace")))
    out.append(("header", "maker", d[0xB0:0xB2].decode("ascii", "replace")))
    out.append(("header", "rom_mb", str(len(d) >> 20)))
    for k in (b"EEPROM_V", b"SRAM_V", b"SRAM_F_V", b"FLASH_V", b"FLASH512_V", b"FLASH1M_V"):
        m = re.search(re.escape(k) + rb"[0-9]{3}", d)
        if m: out.append(("save", "library", m.group().decode()))
    for k in (b"MusicPlayer", b"m4a", b"Sappy", b"GAX", b"Krawall", b"AGB", b"Vicarious", b"Neversoft", b"Mode7", b"MP2K"):
        c = d.count(k)
        if c: out.append(("sdk", "string_hits", "%s x%d" % (k.decode(), c)))
    for magic, label in ((b"\x10", None),):
        pass

def main():
    db = sqlite3.connect(sys.argv[1])
    db.execute("CREATE TABLE IF NOT EXISTS tech_fingerprints(game TEXT, platform TEXT, area TEXT, item TEXT, value TEXT)")
    for p in sys.argv[2:]:
        name = re.sub(r"^[0-9a-f]{8}-", "", os.path.basename(p))
        name = re.sub(r"(_+Track_?0?1_?|\.bin|\.z64|\.gba|\.ecm)+$", "", name, flags=re.I).replace("_", " ").strip()
        ext = os.path.splitext(p)[1].lower()
        plat = {".z64": "N64", ".n64": "N64", ".v64": "N64", ".gba": "GBA", ".bin": "PSX"}.get(ext, "?")
        out = []
        if ext == ".ecm":
            import tempfile; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import unecm
            tmp = tempfile.NamedTemporaryFile(suffix=".bin", delete=False).name
            unecm.main(p, tmp); out.append(("file", "container", "ECM (decoded by tools/unecm.py)"))
            p, plat = tmp, "PSX"
        try:
            if plat == "N64": scan_n64(p, out)
            elif plat == "GBA": scan_gba(p, out)
            elif plat == "PSX": scan_psx(p, out)
            else: out.append(("file", "skipped", "unsupported container %s" % ext))
        except Exception as e:
            out.append(("scan", "error", repr(e)[:200]))
        db.execute("DELETE FROM tech_fingerprints WHERE game=?", (name,))
        db.executemany("INSERT INTO tech_fingerprints VALUES(?,?,?,?,?)", [(name, plat, a, i, v) for a, i, v in out])
        if not db.execute("SELECT 1 FROM games WHERE game=?", (name,)).fetchone():
            db.execute("INSERT INTO games(game, platform, size_kb, labels_source, status) VALUES(?,?,?,?,?)", (name, plat, os.path.getsize(p) >> 10, "romscan fingerprint", "fingerprinted"))
        print("==", name, "[%s]" % plat)
        for a, i, v in out: print("   %-11s %-11s %s" % (a, i, v[:150]))
    db.commit()

if __name__ == "__main__":
    main()
