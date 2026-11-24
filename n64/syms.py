import sys, struct, subprocess
ram=open(sys.argv[1],"rb").read(); elf=sys.argv[2]
nm=subprocess.run(["/opt/libdragon/bin/mips64-elf-nm",elf],capture_output=True,text=True).stdout
sym={}
for l in nm.splitlines():
    p=l.split()
    if len(p)==3: sym[p[2]]=int(p[0],16)
def w32(a): a&=0x7fffff; return struct.unpack("<I",ram[a:a+4])[0]
def b8(a): a&=0x7fffff; return ram[(a&~3)+(3-(a&3))]
for name in sys.argv[3:]:
    if name not in sym: print(name,"?"); continue
    a=sym[name]; print(f"{name} @{a:08x} = w32 {w32(a):08x} b8 {b8(a)}")
