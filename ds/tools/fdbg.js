const F=require('../kit/nrface.js'),fs=require('fs'),{PNG}=require('pngjs'),cp=require('child_process');
F.setCascade(new Int8Array(fs.readFileSync('../kit/vendor/facefinder')));
for(const f of process.argv.slice(2)){cp.execSync(`ffmpeg -y -loglevel error -i "${f}" /tmp/face_in.png`);const p=PNG.sync.read(fs.readFileSync('/tmp/face_in.png'));const im={w:p.width,h:p.height,data:p.data};
const k=Math.min(1,640/Math.max(im.w,im.h)),w=Math.round(im.w*k),h=Math.round(im.h*k),g=new Uint8Array(w*h);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(Math.floor(y/k)*im.w+Math.floor(x/k))*4;g[y*w+x]=(2*im.data[i]+7*im.data[i+1]+im.data[i+2])/10;}
let d=F._pico.run_cascade({pixels:g,nrows:h,ncols:w,ldim:w},(()=>{const P=require('../kit/vendor/pico_mod.js');return P.unpack_cascade(new Int8Array(fs.readFileSync('../kit/vendor/facefinder')))})(),{shiftfactor:0.1,minsize:20,maxsize:1000,scalefactor:1.1});
d=F._pico.cluster_detections(d,0.2).sort((a,b)=>b[3]-a[3]).slice(0,4);console.log(f.split('/').pop(),w,h,d.map(x=>x.map(v=>v.toFixed(0)).join(',')).join(' | '));}
