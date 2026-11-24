import sys,struct
from PIL import Image
for fn in sys.argv[1:]:
    d=open(fn,'rb').read(); w,h=struct.unpack('<II',d[:8]); p=struct.unpack('<Q',d[8:16])[0]; px=d[16:]
    bpp=p//w if p//w in (2,4) else 4
    im=Image.new('RGB',(w,h))
    if bpp==4: im=Image.frombuffer('RGBX',(w,h),px,'raw','BGRX',p,1).convert('RGB')
    else: im=Image.frombuffer('RGB',(w,h),px,'raw','BGR;16',p,1)
    im.save(fn.replace('.raw','.png')); print(fn,w,h,bpp)
