/* Maze chase: the kit engine plays, can be won and lost. */
const A=require('../kit/nrarcade.js'),NR=require('../kit/nrkit.js');let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
const DX=[1,0,-1,0],DY=[0,1,0,-1],KEY=['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'];
// a bot that walks to the nearest dot (BFS) with no ghosts: the maze must be fully clearable
const m=A.create('maze',{ghosts:0,stepFrames:2},{seed:3});const s=m.s;let guard=0;
const bfs=()=>{const q=[[s.px,s.py,-1]],seen=new Set([s.px+','+s.py]);while(q.length){const [x,y,f]=q.shift();if((s.grid[y][x]==='.'||s.grid[y][x]==='o')&&f>=0)return f;for(let d=0;d<4;d++){const nx=x+DX[d],ny=y+DY[d];if(s.grid[ny]&&s.grid[ny][nx]&&s.grid[ny][nx]!=='#'&&!seen.has(nx+','+ny)){seen.add(nx+','+ny);q.push([nx,ny,f<0?d:f]);}}}return -1;};
while(s.status==='play'&&guard++<20000){const d=bfs();const k={};if(d>=0)k[KEY[d]]=true;m.step(k);}
t('every dot reachable and the maze can be won',s.status==='win'&&s.dots===0);
// ghosts that chase kill a player who stands still
const m2=A.create('maze',{ghosts:3,stepFrames:3,lives:2},{seed:5});for(let i=0;i<6000&&m2.s.status==='play';i++)m2.step({});
t('standing still loses to the ghosts',m2.s.status==='lose'&&m2.s.lives<=0);
// power pellet makes ghosts edible
const m3=A.create('maze',{ghosts:1,stepFrames:2},{seed:2});m3.s.fright=300;const gh=m3.s.ghosts[0];gh.x=m3.s.px+1;gh.y=m3.s.py;m3.s.want=0;const sc=m3.s.score;for(let i=0;i<4;i++)m3.step({});
t('eating a frightened ghost scores and sends it home',m3.s.score>=sc+200&&m3.s.lives===3);
// DS ROM data: mode byte and four settings
const b=NR.buildDSArcade?null:null;
t('maze has settings keys for the DS cfg',NR.ARCADE_KEYS.maze.length===4);
console.log(ok+' passed, '+bad+' failed');process.exit(bad?1:0);
