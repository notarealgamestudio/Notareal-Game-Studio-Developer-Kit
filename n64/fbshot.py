"""Render libdragon's display surfaces from an N64 RDRAM dump (host-endian words). usage: fbshot.py ram.bin game.elf out.png"""
import sys, struct, subprocess
from PIL import Image
ram=open(sys.argv[1],"rb").read(); elf=sys.argv[2]
nm=subprocess.run(["/opt/libdragon/bin/mips64-elf-nm",elf],capture_output=True,text=True).stdout
sym={l.split()[2]:int(l.split()[0],16) for l in nm.splitlines() if len(l.split())==3}
def w32(a): a&=0x7fffff; return struct.unpack("<I",ram[a:a+4])[0]
def b(a): a&=0x7fffff; return ram[(a&~3)+(3-(a&3))]
def h16(a): return (b(a)<<8)|b(a+1)
surf=w32(sym["surfaces"])
imgs=[]
for i in range(3):
    s=surf+i*12
    flags,wid,hei,stride=h16(s),h16(s+2),h16(s+4),h16(s+6); buf=w32(s+8)
    if not (0<wid<=640 and 0<hei<=480 and buf): continue
    im=Image.new("RGB",(wid,hei)); px=im.load()
    for y in range(hei):
        for x in range(wid):
            v=h16(buf+y*stride+x*2)
            px[x,y]=(((v>>11)&31)*8,((v>>6)&31)*8,((v>>1)&31)*8)
    imgs.append(im)
if not imgs: print("no surfaces"); sys.exit(1)
out=Image.new("RGB",(sum(i.width for i in imgs),max(i.height for i in imgs))); x=0
for im in imgs: out.paste(im,(x,0)); x+=im.width
out.save(sys.argv[3]); print("saved",len(imgs),"buffers")
