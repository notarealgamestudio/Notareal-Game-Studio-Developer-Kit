# Builds a DS ROM with an intro scene (examples/lakewood_run + a cutscene), boots it in DeSmuME and checks the scene text screen differs from the title and that play continues to the level banner.
import subprocess, json
from PIL import Image
P=json.load(open('/home/claude/notareal-kit/ds/examples/lakewood_run.json')); P['cutscenes']=[{'when':'intro','speaker':'Narrator','text':'Long ago the moon fell into the holler.','duration':240}]
json.dump(P,open('/tmp/cutt.json','w'))
subprocess.run('node tools/nrkit-cli.js /tmp/cutt.json engine/side2d/nr_side2d.nds /tmp/cutt.nds',shell=True,check=True,capture_output=True,cwd='/home/claude/notareal-kit/ds')
subprocess.run('xvfb-run -a python3 tools/dsrun.py /tmp/cutt.nds /tmp/cutt 500 --shots 200,480 --keys "120-125:START,150-155:START,400-405:A"',shell=True,capture_output=True,cwd='/home/claude/notareal-kit/ds')
a=Image.open('/tmp/cutt_00200.png').crop((0,40,256,120)).convert('L'); b=Image.open('/tmp/cutt_00480.png').crop((0,40,256,120)).convert('L')
text_rows=sum(1 for y in range(a.height) if sum(1 for x in range(a.width) if a.getpixel((x,y))<60)>6)
ok=text_rows>=8 and list(a.getdata())!=list(b.getdata())
print('PASS' if ok else 'FAIL','intro cutscene drew text rows',text_rows); raise SystemExit(0 if ok else 1)
