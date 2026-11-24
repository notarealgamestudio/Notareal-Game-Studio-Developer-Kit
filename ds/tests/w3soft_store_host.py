# N64/PSX store engine logic (engine/w3soft/source/w3store.h) on the host build: walk in, clock in, serve a queued customer, count the change, check the till.
import subprocess, sys, re
K = '/home/claude/notareal-kit/ds'; ok = bad = 0
def chk(n, c):
    global ok, bad; ok += bool(c); bad += not c; print('PASS' if c else 'FAIL', n)
subprocess.run(['node', '-e', 'const W=require("./kit/nrworld3d.js"),fs=require("fs");fs.writeFileSync("/tmp/store_t.bin",Buffer.from(W.build({arcade:{mode:"store3d",cfg:{title:"Quick Mart"}}}).block));'], cwd=K, check=True)
r = subprocess.run('gcc -O1 -Wno-misleading-indentation -o /tmp/w3host_t engine/w3soft/source/host.c -lm', shell=True, cwd=K, capture_output=True, text=True); chk('host build compiles', r.returncode == 0)
def run(keys, frames, env=None):
    o = subprocess.run(['/tmp/w3host_t', '/tmp/store_t.bin', str(frames), '--', keys], capture_output=True, text=True, env=dict({'W3DBG': '1'}, **(env or {}))); rows = []
    ls = o.stderr.splitlines()
    for a, b in zip(ls[::2], ls[1::2]):
        m = re.search(r'f(\d+) px ([-\d.]+) pz ([-\d.]+).*started (\d) min (\d+)', a); n = re.search(r'regm (\d) tot (\d+) paid (\d+) give (\d+)\s+sales (\d+) till (\d+) done (\d+) rep (\d+)', b)
        x = re.search(r'stocked (\d+) sst0 (\d+) carry (\d+) wallet (\d+) mop (\d+) caught (\d+) stolen (\d+) gus (\d+) own1 (\d+) loss (\d+) state (\d+) pay (\d+) robdone (\d+)', b)
        if m and n and x: rows.append(dict(stocked=int(x[1]), sst0=int(x[2]), carry=int(x[3]), wallet=int(x[4]), mopped=int(x[5]), caught=int(x[6]), stolen=int(x[7]), gus=int(x[8]), own1=int(x[9]), loss=int(x[10]), state=int(x[11]), pay=int(x[12]), robdone=int(x[13]), f=int(m[1]), x=float(m[2]), z=float(m[3]), started=int(m[4]), minute=int(m[5]), regm=int(n[1]), tot=int(n[2]), paid=int(n[3]), give=int(n[4]), sales=int(n[5]), till=int(n[6]), done=int(n[7]), rep=int(n[8])))
    return rows
keys = '60-210:UP;211-244:LEFT;245-347:UP;3200-3203:A;3250-3252:UP;' + ';'.join(f'{3260 + i * 6}-{3262 + i * 6}:RIGHT' for i in range(12)) + ';3350-3352:A'
rows = run(keys, 3600); by = {r['f']: r for r in rows}
chk('player walks from the street into the store and the shift clock starts', by[60]['started'] == 0 and by[300]['started'] == 1 and by[300]['minute'] > 840 - 1)
chk('player reaches the cashier zone', 5.2 < by[3180]['x'] < 10.8 and -5.6 < by[3180]['z'] < -3.4)
chk('A rings up the waiting customer: register opens with total and a bill', by[3240]['regm'] == 1 and by[3240]['tot'] > 0 and by[3240]['paid'] >= by[3240]['tot'])
chk('change counted with the d-pad ($1 + 5c steps)', by[3420]['give'] == by[3420]['paid'] - by[3420]['tot'])
chk('exact change: sale booked, till grows, reputation up', by[3420]['sales'] == by[3420]['tot'] and by[3420]['till'] == 10000 + by[3420]['tot'] and by[3420]['done'] == 1 and by[3420]['rep'] > by[3180]['rep'])
last = lambda rows: rows[-1]
r = last(run('20-22:A;70-72:A', 180, {'W3POS': '10:-12.6:9.8:3.14,60:-8:-3.2:3.14'}))
chk('stocking: grab a box from the pile in the back room, put it on the soda shelf', r['stocked'] == 4 and r['sst0'] == 10 and r['carry'] == 0)
r = last(run('20-22:X;40-42:X;60-62:X', 180, {'W3POS': '10:-9.9:-12.0:0'}))
chk('Gus: three $1 gifts cost $3 and he watches the door', r['wallet'] == 2200 and r['gus'] == 1)
r = last(run('20-22:A;30-32:A;50-52:B', 180, {'W3POS': '10:23.6:-15.0:0'}))
chk('Mack: open the trunk and buy the bat with the wallet', r['own1'] == 1 and r['wallet'] == 0)
r = last(run('', 2400, {'W3THIEF': '300', 'W3CATCH': '1', 'W3POS': '5:0:-3:3.14'}))
chk('shoplifter caught with a tackle: counted, reputation up, nothing stolen', r['caught'] >= 1 and r['stolen'] == 0)
r = last(run('', 3600, {'W3THIEF': '300', 'W3POS': '5:0:-3:3.14'}))
chk('shoplifter not stopped: escapes, loss and reputation drop', r['stolen'] == 1 and r['loss'] > 0)
r = last(run('', 4200, {'W3MOP': '1', 'W3POS': '5:0:-3:3.14'}))
chk('a spill appears and holding A mops it', r['mopped'] >= 1)
r = last(run('', 18400, {'W3POS': '5:0:-3:3.14'}))
chk('an unattended shift: the robber takes the till, the shift ends with a pay summary', r['robdone'] == 1 and r['loss'] >= 10000 and r['state'] == 1 and r['pay'] >= 7200)
print('store host tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)
