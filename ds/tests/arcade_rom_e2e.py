# Builds every DS arcade ROM (10 games + music maker) with NR.buildDSArcade, boots each in DeSmuME (xvfb-run) and checks both screens drew and the game reacts to input.
import subprocess, sys
from PIL import Image
MODES = 'shmup breakout race fps brawler falling memory sim paint hoops music combat'.split(); ok = bad = 0
for m in MODES:
    subprocess.run(f'node tools/arcade-cli.js {m} /tmp/ar_{m}.nds', shell=True, check=True, cwd='/home/claude/notareal-kit/ds')
    subprocess.run(f'xvfb-run -a python3 tools/dsrun.py /tmp/ar_{m}.nds /tmp/ars_{m} 420 --shots 150,410 --keys "100-104:START,200-203:START,230-400:UP+A,260-330:RIGHT" --taps "205,128,96;206,128,96;207,128,96"', shell=True, capture_output=True, cwd='/home/claude/notareal-kit/ds')
    a, b = Image.open(f'/tmp/ars_{m}_00150.png').convert('RGB'), Image.open(f'/tmp/ars_{m}_00410.png').convert('RGB')
    top = a.crop((0, 0, 256, 192)).getcolors(70000); bot = b.crop((0, 192, 256, 384)).getcolors(70000)
    drew = len(top) > 3 and len(bot) > 3; moved = list(a.getdata()) != list(b.getdata())
    good = drew and moved; ok += good; bad += not good; print('PASS' if good else 'FAIL', m, 'drew' if drew else 'blank', 'changes' if moved else 'static')
print('arcade ROM tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)
