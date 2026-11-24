# N64/PSX Frontier mode (engine/w3soft/source/w3front.h) on the host build: talk, quests, reputation, bounty, horse, duel, dead eye.
import subprocess, sys, re
K = '/home/claude/notareal-kit/ds'; ok = bad = 0
def chk(n, c):
    global ok, bad; ok += bool(c); bad += not c; print('PASS' if c else 'FAIL', n)
subprocess.run(['node', '-e', 'const W=require("./kit/nrworld3d.js"),fs=require("fs");fs.writeFileSync("/tmp/front_t.bin",Buffer.from(W.build({arcade:{mode:"frontier3d",cfg:{title:"Dust and Lead"}}}).block));'], cwd=K, check=True)
r = subprocess.run('gcc -O1 -Wno-misleading-indentation -w -o /tmp/w3host_f engine/w3soft/source/host.c -lm', shell=True, cwd=K, capture_output=True, text=True); chk('host build compiles', r.returncode == 0)
PAT = re.compile(r'F f(\d+) near (-?\d+) dlg (-?\d+) sel (\d+) money (-?\d+) bounty (\d+) rep (-?\d+) (-?\d+) (-?\d+) qa (-?\d+) prog (\d+) done (\d+) comp (\d+) hp (\d+) mount (-?\d+) duel (\d+) down (\d) deadon (\d) meter (\d+) px ([-\d.]+) pz ([-\d.]+) state (\d) res0 (\d+)')
KEYS = 'f near dlg sel money bounty r0 r1 r2 qa prog done comp hp mount duel down deadon meter x z state res0'.split()
def run(keys, frames, env=None):
    o = subprocess.run(['/tmp/w3host_f', '/tmp/front_t.bin', str(frames), '--', keys], capture_output=True, text=True, env=dict({'W3FDBG': '1'}, **(env or {})))
    rows = [dict(zip(KEYS, [float(v) if '.' in v else int(v) for v in m.groups()])) for m in map(PAT.search, o.stderr.splitlines()) if m]; return rows
at = lambda rows, f: min(rows, key=lambda r: abs(r['f'] - f))
# 1. the sheriff: walk up, A opens the dialogue, A picks "I'LL DO IT" -> the job starts
rows = run('30-32:A;60-62:A', 120, {'W3POS': '5:-4.5:-7:1.5'})
chk('A near the sheriff opens his dialogue', at(rows, 40)['dlg'] == 0 and at(rows, 40)['near'] >= 0)
chk("choosing I'LL DO IT starts CLEAR DRY GULCH", at(rows, 100)['qa'] == 0 and at(rows, 100)['dlg'] == -1)
# 2. kill 6 outlaws, come back, turn in
kills = ','.join(f'{200 + i * 10}:0' for i in range(6))
rows = run('30-32:A;60-62:A;400-402:A;430-432:A', 520, {'W3POS': '5:-4.5:-7:1.5,395:-4.5:-7:1.5', 'W3KILL': kills})
chk('each outlaw kill counts toward the job', at(rows, 330)['prog'] == 6)
r0 = at(rows, 100); r1 = at(rows, 500)
chk('outlaw kills cost outlaw standing and raise the law\'s', r1['r1'] < 0 and r1['r0'] > r0['r0'] - 1)
chk('turning in: job done, $100 + $6x... paid, law standing up', r1['comp'] == 1 and r1['qa'] == -1 and r1['money'] >= r0['money'] + 100 and r1['done'] == 1)
# 3. wanted: killing a deputy puts a bounty on you, the preacher takes payment
rows = run('150-152:A;180-182:A', 260, {'W3KILL': '40:2', 'W3POS': '100:6:10.5:-1.57', 'W3MONEY': '200'})
chk('killing a lawman: bounty up, law standing down', at(rows, 120)['bounty'] == 50 and at(rows, 120)['r0'] <= -15)
chk('paying the bounty at the preacher clears it', at(rows, 250)['bounty'] == 0 and at(rows, 250)['money'] < at(rows, 120)['money'])
# 4. the law ignores you without a bounty and comes for you with one
rows = run('', 900, {'W3POS': '5:-3:-1:0'}); chk('deputies leave an innocent player alone', at(rows, 880)['hp'] == 100)
rows = run('', 900, {'W3POS': '5:-3:-1:0', 'W3BOUNTY': '1'}); chk('with a bounty the deputies open fire', at(rows, 880)['hp'] < 100)
# 5. horse: mount, ride faster than you walk
walk = run('10-130:UP', 140, {'W3POS': '5:0.4:20:0'}); horse = run('20-22:A;40-160:UP', 170, {'W3POS': '5:5:-28.5:0'})
chk('A next to a horse mounts it', at(horse, 60)['mount'] >= 0)
dw = abs(at(walk, 120)['z'] - 20); dh = abs(at(horse, 160)['z'] - at(horse, 40)['z'])
chk('riding is much faster than walking', dh > dw * 1.8)
# 6. high noon duel: draw in time wins, flinching early loses health
rows = run('30-32:A;60-62:A', 600, {'W3POS': '5:0:-33:0', 'W3DRAW': '1'})
chk('Black Jack duel: reacting to DRAW wins', at(rows, 590)['down'] == 1 and at(rows, 590)['hp'] == 100 and at(rows, 590)['prog'] >= 1)
rows = run('30-32:A;60-62:A', 600, {'W3POS': '5:0:-33:0', 'W3EARLY': '1'}); chk('firing before DRAW is a flinch: you are shot', at(rows, 590)['down'] == 0 and at(rows, 590)['hp'] < 100)
rows = run('30-32:A;60-62:A', 600, {'W3POS': '5:0:-33:0'}); chk('freezing loses the duel and costs health', at(rows, 590)['hp'] < 100 and at(rows, 590)['down'] == 0)
# 7. dead eye
rows = run('20-22:Y', 120); chk('Y turns on Dead Eye and the meter drains', at(rows, 60)['deadon'] == 1 and at(rows, 100)['meter'] < at(rows, 60)['meter'])
# 8. the store: ammo costs money
rows = run('30-32:A;60-62:A', 160, {'W3POS': '5:-4.5:7:1.5'}); chk('buying ammo from Abel spends $10 and adds rounds', at(rows, 150)['money'] == at(rows, 20)['money'] - 10 and at(rows, 150)['res0'] > at(rows, 20)['res0'])
print('frontier host tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)
