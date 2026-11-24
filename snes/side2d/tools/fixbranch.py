"""Rewrite 8-bit branches the linker says are too far ('Too large distance') into inverse-branch + jmp."""
import glob, os, re, subprocess, sys

# compiled C (src/*.asm/.ps/.asp/.obj) must never outlive the headers it was built against
for f in glob.glob("src/*.asm") + glob.glob("src/*.ps") + glob.glob("src/*.asp") + glob.glob("src/*.obj"):
    if not f.endswith(("spcio.asm", "nrio.asm")):
        os.remove(f)
INV = {"bcs": "bcc", "bcc": "bcs", "beq": "bne", "bne": "beq", "bmi": "bpl", "bpl": "bmi", "bvs": "bvc", "bvc": "bvs"}
for _ in range(60):
    out = subprocess.run(["make", "buildActual"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True).stdout
    m = re.search(r"(\S+\.asm):(\d+): FIX_REFERENCES: Too large distance", out)
    if not m:
        print("\n".join(l for l in out.splitlines() if "rror" in l)[:2000] or "ok")
        break
    path, line = m.group(1), int(m.group(2))
    lines = open(path).read().split("\n")
    src = lines[line - 1]
    mm = re.match(r"(\s*)(b\w\w)\s+(\S+)(.*)", src)
    op, tgt = mm.group(2), mm.group(3)
    if op == "bra":
        lines[line - 1] = f"{mm.group(1)}jmp {tgt}"
    else:
        lines[line - 1] = f"{mm.group(1)}{INV[op]} +\n{mm.group(1)}jmp {tgt}\n+"
    open(path, "w").write("\n".join(lines))
    print("fixed", path, line, op, tgt)
