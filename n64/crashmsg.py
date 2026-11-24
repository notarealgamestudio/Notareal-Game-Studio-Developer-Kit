import sys, struct, subprocess
ram=open(sys.argv[1],"rb").read(); elf=sys.argv[2]
nm=subprocess.run(["/opt/libdragon/bin/mips64-elf-nm",elf],capture_output=True,text=True).stdout
a=[int(l.split()[0],16) for l in nm.splitlines() if l.endswith(" __notareal_crash_msg")]
if not a: print("no symbol"); sys.exit()
a=a[0]&0x7fffff; out=b""
for i in range(256):
    c=ram[((a+i)&~3)+(3-((a+i)&3))]
    if c==0: break
    out+=bytes([c])
print("crash msg:", repr(out.decode("latin1")) if out else "(none)")
