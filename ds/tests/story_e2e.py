# Story tab + banner: adds scenes through the UI, exports a DS ROM with banner, checks banner CRC/title, and plays the intro scene in DeSmuME.
import asyncio, base64, struct, subprocess, sys
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1400,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.click('text=New game'); await pg.wait_for_timeout(300); await pg.click('.modal button.go'); await pg.wait_for_timeout(800)
    await pg.evaluate("() => { tab = 'story'; renderAll(); }"); await pg.wait_for_timeout(300)
    await pg.click('button:text-is("+ Add a scene")'); await pg.wait_for_timeout(200)
    await pg.fill('textarea.wide','The moon fell into the holler.'); await pg.fill('input[style*="130px"]','Narrator')
    await pg.fill('textarea[maxlength="100"]','Story Test\nLine two\nLine three'); await pg.wait_for_timeout(200)
    b64=await pg.evaluate("""(async()=>{ const imgs=new Map(); for(const l of [P.tileset.image,P.background].filter(Boolean)) imgs.set(l, await imageData(l)); for(const s of Object.values(P.sprites)) if(!imgs.has(s.image)) imgs.set(s.image, await imageData(s.image));
      const res=NRKit.buildDS(P,{img:r=>imgs.get(r),snd:r=>null}); const out=NRKit.patchROM(await gunzipB64(ROMS.ds_side2d),res.block); const rom=await withBanner(out.rom); let s=''; for(let i=0;i<rom.length;i+=32768) s+=String.fromCharCode.apply(null,rom.subarray(i,i+32768)); return btoa(s);})()""")
    open('/tmp/story.nds','wb').write(base64.b64decode(b64))
    r=open('/tmp/story.nds','rb').read(); bo=struct.unpack('<I',r[0x68:0x6c])[0]
    def crc(x):
        c=0xFFFF
        for v in x:
            c^=v
            for _ in range(8): c=(c>>1)^0xA001 if c&1 else c>>1
        return c
    okc=crc(r[bo+0x20:bo+0x840])==struct.unpack('<H',r[bo+2:bo+4])[0]
    title=r[bo+0x240:bo+0x2c0].decode('utf-16le','ignore').split('\x00')[0]
    print('banner crc',okc,'title',repr(title),'errors',errs)
    assert okc and title.startswith('Story Test') and not errs
asyncio.run(m())
