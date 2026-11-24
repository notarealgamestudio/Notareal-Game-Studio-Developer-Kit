#include "hal.h"
#ifndef NRMODE
#define NRMODE 0
#endif
#ifdef NRDBG
#define ST
#else
#define ST static
#endif
/* ---- sound: first song as two-voice music + 5 effects (jump coin hurt stomp clear); data at extra header +10/+12 ---- */
ST u16 mus_o, sfx_tbl; ST u8 mus_n, mus_i, mus_t, mus_fr, mus_two, mus_on, mus_a, mus_b, sfx_n, sfx_i, sfx_fr; ST u16 sfx_o;

#define D8(o)  (NRD[o])
#define D16(o) ((u16)(NRD[o] | (NRD[(o) + 1] << 8)))
#define S16(o) ((i16)D16(o))
/* header: 0 magic8 | 8 nlev | 9 lives | 10 nmeta | 11 ntypes | 12.. i16 grav jump jumpRun run runFast maxFall accel | 26 heroW heroH |
   28 u16 offCols offMeta offLevels offSpr offScr (title,win,over: each map offset then attr offset) */
#define H_NLEV 8
#define H_LIVES 9
#define H_GRAV 12
#define H_JUMP 14
#define H_JUMPR 16
#define H_RUN 18
#define H_RUNF 20
#define H_MAXF 22
#define H_ACC 24
#define H_HW 26
#define H_HH 27
#define H_OCOLS 28
#define H_OMETA 30
#define H_OLEVS 32
#define H_OSPR 34
#define H_OSCR 36
#define T_START 0
#define T_WALKER 1
#define T_HOPPER 2
#define T_FLYER 3
#define T_COIN 4
#define T_GOAL 5
#define T_SPRING 6
#define T_HEART 7
#define T_CHECK 8
#define T_HERO 9
#define MAXOBJ 40
#define XH() D16(48)
static void snd_boot(void) { u16 x = XH(); hal_snd_init(); mus_o = D16(x + 10); sfx_tbl = D16(x + 12); mus_on = 0; sfx_n = 0; }
static void mus_start(void) { if (!mus_o) return; mus_n = D8(mus_o); mus_t = D8(mus_o + 1); mus_two = D8(mus_o + 2); mus_i = 0; mus_fr = 0; mus_on = 1; mus_a = mus_b = 0; }
static void mus_stop(void) { mus_on = 0; hal_tone(0, 0, 0); hal_tone(1, 0, 0); }
static void sfx(u8 id) { if (!sfx_tbl) return; sfx_o = D16(sfx_tbl + id * 2); sfx_n = D8(sfx_o); sfx_i = 0; sfx_fr = 0; }
static void snd_tick(void) {
    if (sfx_n) {
        if (sfx_fr == 0) hal_tone(1, D8(sfx_o + 1 + sfx_i), 12);
        if (++sfx_fr >= 3) { sfx_fr = 0; if (++sfx_i >= sfx_n) { sfx_n = 0; hal_tone(1, 0, 0); mus_b = 0; } }
    }
    if (mus_on) {
        if (mus_fr == 0) {
            u8 n = D8(mus_o + 3 + mus_i);
            if (n != 255) { mus_a = n; hal_tone(0, n, n ? 9 : 0); }
            if (mus_two && !sfx_n) { n = D8(mus_o + 3 + mus_n + mus_i); if (n != 255) { mus_b = n; hal_tone(1, n, n ? 7 : 0); } }
        }
        if (++mus_fr >= mus_t) { mus_fr = 0; if (++mus_i >= mus_n) mus_i = 0; }
    }
}
static void fr(void) { snd_tick(); hal_frame(); }
ST u16 lvbase; ST u8 lw, lh, nobj, lvnum, lives, nlev;
#if NRMODE == 2
ST u8 rtx, rty;
#endif
ST u16 mapoff; ST u8 hudlives;
ST u8 otype[MAXOBJ]; ST i16 ox[MAXOBJ], oy[MAXOBJ]; ST u8 oalive[MAXOBJ], odir[MAXOBJ], otimer[MAXOBJ]; ST i16 ovy[MAXOBJ];
ST i16 px, py, vx, vy; ST u8 pfx, pfy, onground, face, inv, dead, jumpheld;
ST i16 ckx, cky; ST u16 frames; ST u8 pad, padold, coins;
ST u16 camx, camy; ST i16 winlo, winhi;
ST const i8 hover[16] = { 0, 1, 2, 3, 4, 5, 5, 6, 6, 6, 5, 5, 4, 3, 2, 1 };

ST const u8 *cols, *mapb, *metab; ST u16 rowp[16]; ST u16 lwpx, lhpx;
static u8 ctile(i16 x, i16 y) {                  /* collision class of the tile at pixel x,y */
    if ((u16)x >= lwpx) return 1;
    if (y < 0 || (u16)y >= lhpx) return 0;
    return cols[mapb[rowp[(u8)((u16)y >> 4)] + ((u16)x >> 4)]];
}
#if NRMODE == 0
static u8 colhit(i16 x, i16 y, u8 h) {            /* any solid tile on a vertical strip of pixels */
    i16 yy = y, e = y + h - 1;
    for (;;) { if (yy > e) yy = e; if (ctile(x, yy) == 1) return 1; if (yy == e) return 0; yy += 8; }
}
static u8 rowhit(i16 x, i16 y, u8 w) {            /* any solid tile on a horizontal strip */
    i16 xx = x, e = x + w - 1;
    for (;;) { if (xx > e) xx = e; if (ctile(xx, y) == 1) return 1; if (xx == e) return 0; xx += 8; }
}
static u8 hazard(i16 x, i16 y, u8 w, u8 h) {
    if (ctile(x, y) == 3 || ctile(x + w - 1, y) == 3 || ctile(x, y + h - 1) == 3 || ctile(x + w - 1, y + h - 1) == 3) return 1;
    return ctile(x + (w >> 1), y + (h >> 1)) == 3;
}
static u8 feet_oneway(i16 x, i16 y, u8 w, u8 h) { /* standing on a jump-through tile: feet exactly on a tile top */
    i16 fy = y + h;
    if (fy & 15) return 0;
    return ctile(x, fy) == 2 || ctile(x + w - 1, fy) == 2;
}
#endif
static void put_col(i16 hw) {
    u8 r; u16 gc, m; u8 half;
    gc = (u16)hw >> 1; half = (u8)hw & 1;
    if (gc >= lw) { hal_col_begin(hw); for (r = 0; r < lh * 2; r++) hal_col_put(r, 0); hal_col_end(); return; }
    hal_col_begin(hw);
    for (r = 0; r < lh * 2; r++) {
        m = mapb[rowp[r >> 1] + gc];
        hal_col_put(r, metab[(m << 2) + ((r & 1) << 1) + half]);
    }
    hal_col_end();
}
static void stream(void) {
    i16 lo = (i16)(camx >> 3), hi = lo + HAL_NCOL - 1; u8 n = 0;
    while (winhi < hi && n < 2) { winhi++; put_col(winhi); n++; if (winhi - winlo >= HAL_RING) winlo = winhi - HAL_RING + 1; }
    while (winlo > lo && n < 2) { winlo--; put_col(winlo); n++; if (winhi - winlo >= HAL_RING) winhi = winlo + HAL_RING - 1; }
}
void play_cs(u8 when, u8 lv);
static void load_level(u8 n) {
    u16 o = D16(D16(H_OLEVS) + n * 2), i;
    lvbase = o; lw = D8(o); lh = D8(o + 1); nobj = D8(o + 4);
    px = (i16)D8(o + 2) * 16 + 2; py = (i16)D8(o + 3) * 16 + 4; ckx = px; cky = py;
#if NRMODE == 2
    if (rtx != 255) { px = (i16)rtx * 16; py = (i16)rty * 16; } else { px = (i16)D8(o + 2) * 16; py = (i16)D8(o + 3) * 16; }
#endif
    for (i = 0; i < nobj && i < MAXOBJ; i++) {
        u16 q = o + 5 + i * 3; otype[i] = D8(q); ox[i] = (i16)D8(q + 1) * 16; oy[i] = (i16)D8(q + 2) * 16; oalive[i] = 1; odir[i] = 1; otimer[i] = (u8)(i * 7); ovy[i] = 0;
    }
    mapoff = o + 5 + nobj * 3; mapb = &NRD[mapoff]; cols = &NRD[D16(H_OCOLS)]; metab = &NRD[D16(H_OMETA)]; lwpx = (u16)lw * 16; lhpx = (u16)lh * 16;
    for (i = 0; i < lh; i++) rowp[i] = i * lw;
    vx = vy = 0; pfx = pfy = 0; inv = 60; onground = 0; face = 0; hudlives = 255;
    hal_level_begin();
    camx = 0; camy = 0;
#if NRMODE == 1 || NRMODE == 2
    { i16 cx = px + (NRMODE == 2 ? 8 : 6) - HAL_SCR_W / 2, cy = py + (NRMODE == 2 ? 8 : 4) - HAL_SCR_H / 2, mx = (i16)lw * 16 - HAL_SCR_W, my = (i16)lh * 16 - HAL_SCR_H;
      if (mx < 0) mx = 0; if (my < 0) my = 0; if (cx < 0) cx = 0; if (cx > mx) cx = mx; if (cy < 0) cy = 0; if (cy > my) cy = my; camx = cx; camy = cy; }
#endif
    winlo = (i16)(camx >> 3); winhi = winlo - 1;
    { i16 k; for (k = 0; k < HAL_NCOL && k < HAL_RING; k++) { winhi++; put_col(winhi); } }
    hal_scroll(camx, camy);
    hal_level_end();
}
#if NRMODE == 0
static void respawn(void) { px = ckx; py = cky; vx = vy = 0; pfx = pfy = 0; inv = 90; }
static void hurt(void) {
    if (inv) return;
    sfx(2);
    if (lives > 0) lives--;
    if (lives == 0) { dead = 1; return; }
    respawn();
}
static void player_step(void) {
    i16 target, acc, grav, step, n, k; u8 hw = D8(H_HW), hh = D8(H_HH);
    acc = S16(H_ACC);
    target = (pad & P_B) ? S16(H_RUNF) : S16(H_RUN);
    if (pad & P_R) { face = 0; if (vx < target) { vx += acc; if (vx > target) vx = target; } }
    else if (pad & P_L) { face = 1; if (vx > -target) { vx -= acc; if (vx < -target) vx = -target; } }
    else { if (vx > acc) vx -= acc; else if (vx < -acc) vx += acc; else vx = 0; }
    if ((pad & P_A) && !(padold & P_A) && onground) { vy = -(((vx > S16(H_RUN)) || (vx < -S16(H_RUN))) ? S16(H_JUMPR) : S16(H_JUMP)); onground = 0; sfx(0); }
    jumpheld = (pad & P_A) != 0;
    grav = S16(H_GRAV); if (vy < 0 && !jumpheld) grav = grav << 1;
    vy += grav; if (vy > S16(H_MAXF)) vy = S16(H_MAXF);
    /* horizontal */
    { i16 tot = (vx >> 8); u8 fr = (u8)(vx & 255); u16 s = pfx + fr; pfx = (u8)s; if (s > 255) tot++;
      step = tot < 0 ? -1 : 1; n = tot < 0 ? -tot : tot;
      for (k = 0; k < n; k++) { if (colhit(step > 0 ? px + hw : px - 1, py, hh)) { vx = 0; break; } px += step; } }
    /* vertical */
    { i16 tot = (vy >> 8); u8 fr = (u8)(vy & 255); u16 s = pfy + fr; pfy = (u8)s; if (s > 255) tot++;
      step = tot < 0 ? -1 : 1; n = tot < 0 ? -tot : tot; onground = 0;
      for (k = 0; k < n; k++) {
          if (step > 0) { if (rowhit(px, py + hh, hw) || feet_oneway(px, py, hw, hh)) { vy = 0; onground = 1; break; } }
          else if (rowhit(px, py - 1, hw)) { vy = 0; break; }
          py += step; }
      if (!n && vy >= 0 && (rowhit(px, py + hh, hw) || feet_oneway(px, py, hw, hh))) { onground = 1; vy = 0; } }
    if (hazard(px, py, hw, hh)) hurt();
    if (py > (i16)lh * 16 + 8) hurt();
}
static void objects_step(void) {
    u8 i, t; i16 hw = D8(H_HW), hh = D8(H_HH);
    for (i = 0; i < nobj && i < MAXOBJ; i++) {
        if (!oalive[i]) continue; t = otype[i];
        { i16 dx = ox[i] - (i16)camx; if (dx < -64 || dx > HAL_SCR_W + 64) continue; }
        if (t == T_WALKER || t == T_HOPPER) {
            i16 nx = ox[i] + (odir[i] ? 1 : -1); u8 mv = (frames & 1) == 0;
            if (mv) {
                if (ctile(nx + (odir[i] ? 15 : 0), oy[i] + 8) == 1 || (ctile(nx + (odir[i] ? 15 : 0), oy[i] + 17) == 0 && ovy[i] == 0)) odir[i] = !odir[i]; else ox[i] = nx;
            }
            ovy[i] += 12; if (ovy[i] > 1024) ovy[i] = 1024;
            { i16 dy = ovy[i] >> 8, s; if (dy < 0) dy = -((-ovy[i]) >> 8);
              if (t == T_HOPPER && ovy[i] == 12 && (++otimer[i] & 63) == 0) ovy[i] = -900;
              dy = ovy[i] >> 8; s = dy < 0 ? -1 : 1; if (dy < 0) dy = -dy;
              for (; dy > 0; dy--) { if (s > 0 && (ctile(ox[i] + 2, oy[i] + 16) == 1 || ctile(ox[i] + 13, oy[i] + 16) == 1)) { ovy[i] = 0; break; } oy[i] += s; if (oy[i] > (i16)lh * 16 + 40) { oalive[i] = 0; break; } } }
        } else if (t == T_FLYER) {
            ox[i] += (odir[i] ? 1 : -1) * ((frames & 1) ? 1 : 0); if (ctile(ox[i] + (odir[i] ? 16 : -1), oy[i] + 8) == 1) odir[i] = !odir[i];
            otimer[i]++;
        }
        /* interaction */
        if (px + hw > ox[i] + 2 && px < ox[i] + 14 && py + hh > oy[i] + 2 && py < oy[i] + 16) {
            if (t == T_WALKER || t == T_HOPPER || t == T_FLYER) {
                if (vy > 0 && (py + hh) - oy[i] < 14) { oalive[i] = 0; vy = -900; onground = 0; sfx(3); } else hurt();
            } else if (t == T_COIN) { oalive[i] = 0; if (coins < 255) coins++; sfx(1); }
            else if (t == T_HEART) { oalive[i] = 0; if (lives < 9) lives++; }
            else if (t == T_CHECK) { ckx = ox[i] + 2; cky = oy[i] - 12; }
            else if (t == T_SPRING) { if (vy > 0) { vy = -(S16(H_JUMPR) + 512); onground = 0; } }
            else if (t == T_GOAL) { sfx(4); lvnum++; if (lvnum >= nlev) { dead = 2; } else { play_cs(1, lvnum); load_level(lvnum); } return; }
        }
    }
}
#endif
ST u8 s_nf[10], s_cw[10], s_ch[10], s_pal[10], s_c0[10], s_cpf[10];
static void sprinit(void) {
    u8 t; u16 d;
    for (t = 0; t < 10; t++) { d = D16(H_OSPR) + t * 6; s_nf[t] = D8(d); s_cw[t] = D8(d + 1); s_ch[t] = D8(d + 2); s_pal[t] = D8(d + 3); s_c0[t] = (u8)D16(d + 4); s_cpf[t] = s_cw[t] * s_ch[t]; }
}
static void draw_obj(u8 t, u8 f, i16 x, i16 y, u8 flip) {
    u8 cw = s_cw[t], ch = s_ch[t], pal = s_pal[t], c = s_c0[t], cx, cy; i16 xx;
    if (f >= s_nf[t]) f = 0;
    while (f) { c += s_cpf[t]; f--; }
    for (cy = 0; cy < ch; cy++) {
        xx = flip ? x + ((i16)(cw - 1) << 3) : x;
        for (cx = 0; cx < cw; cx++) { hal_spr(xx, y, c, pal, flip); c++; if (flip) xx -= 8; else xx += 8; }
        y += 16;
    }
}
#if NRMODE == 0
static void draw_hud(void) {
    u8 i; i16 hx = 4;
    hal_hud_begin();
    for (i = 0; i < lives && i < 6; i++) { draw_obj(T_HEART, 0, hx, 2, 0); hx += 10; }
    hal_hud_end(); hudlives = lives;
}
#endif
#if NRMODE == 0
static void draw_all(void) {
    u8 i, t, f; i16 sx, sy;
    if (hudlives != lives) draw_hud();
    hal_spr_begin();
#ifndef X_DO
    for (i = 0; i < nobj && i < MAXOBJ; i++) {
        if (!oalive[i]) continue; t = otype[i]; if (t == T_START) continue;
        sx = ox[i] - (i16)camx; sy = oy[i] - (i16)camy;
        if (sx < -16 || sx > HAL_SCR_W || sy < -16 || sy > HAL_SCR_H) continue;
        f = (u8)((frames >> 3) & 1);
        if (t == T_FLYER) sy += hover[(otimer[i] >> 2) & 15];
        draw_obj(t, f, sx, sy, (t <= T_FLYER && !odir[i]) ? 1 : 0);
    }
#endif
#ifndef X_DH
    if (!(inv && (frames & 4))) {
        f = onground ? ((vx == 0) ? 0 : (u8)(1 + ((frames >> 3) & 1))) : 3;
        draw_obj(T_HERO, f, px - (i16)camx - ((16 - D8(H_HW)) >> 1), py - (i16)camy - (32 - D8(H_HH)), face);
    }
#endif
#ifndef X_DHE
    
#endif
    hal_spr_end();
}
#endif
#if NRMODE == 0
static void camera(void) {
    i16 cx = px + 8 - HAL_SCR_W / 2, cy = py + 16 - HAL_SCR_H / 2, mx = (i16)lw * 16 - HAL_SCR_W, my = (i16)lh * 16 - HAL_SCR_H;
    if (mx < 0) mx = 0; if (my < 0) my = 0;
    if (cx < 0) cx = 0; if (cx > mx) cx = mx; if (cy < 0) cy = 0; if (cy > my) cy = my;
    camx = cx; camy = cy;
}
#endif
static void screen(u8 w) { u16 o = D16(H_OSCR) + w * 4; hal_show_screen(&NRD[D16(o)], &NRD[D16(o + 2)], w); }
static void wait_start(void);
/* cutscenes: extra header +14 -> [n, (when 0 intro/1 before level/2 ending, level, screen)*n]; text screens live after title/win/over */
void play_cs(u8 when, u8 lv) { u16 p = D16(XH() + 14); u8 n, i; if (!p) return; n = D8(p); for (i = 0; i < n; i++) if (D8(p + 1 + i * 3) == when && D8(p + 2 + i * 3) == lv) { screen(D8(p + 3 + i * 3)); wait_start(); } }
static void wait_start(void) { for (;;) { fr(); padold = pad; pad = hal_pad(); if ((pad & P_START) && !(padold & P_START)) return; } }
#if NRMODE == 0
void game_main(void) {
    hal_init(); sprinit(); snd_boot();
    for (;;) {
        screen(0); wait_start();
        nlev = D8(H_NLEV); lives = D8(H_LIVES); lvnum = 0; coins = 0; dead = 0; frames = 0;
        play_cs(0, 0); play_cs(1, 0); load_level(0); mus_start();
        while (!dead) {
#ifdef X_ALL
            frames++; fr(); continue;
#endif
            padold = pad; pad = hal_pad(); frames++;
            if (inv) inv--;
            #ifndef X_PL
            player_step();
#endif
#ifndef X_OB
            objects_step();
#endif
            if (dead) break;
            camera();
#ifndef X_ST
            stream();
#endif
            hal_scroll(camx, camy);
#ifndef X_DR
            draw_all();
#endif
            fr();
        }
        mus_stop(); if (dead == 2) play_cs(2, 0);
        screen(dead == 2 ? 1 : 2); wait_start();
    }
}
#endif

#if NRMODE == 1
/* ================================================================ RACING (top-down circuit, 1 player + up to 3 rivals)
   same level data as the platformer: tile class 0 road, 1 wall, 2 rough (slow), 3 water/oil (back to the last checkpoint);
   objects: start = your grid slot, walker = rival car, check = checkpoint (in listed order), goal = finish line, coin = boost pad.
   extra header +16 mode, +17 laps, +18 rivals, +19 rival speed pct, +20 u16 top speed (8.8 px/frame). */
#ifndef RS
#define RS 1      /* game steps per 60 Hz frame is 1/RS: the 8-bit CPUs run the race at 30 Hz (RS 2) and scale speeds to match */
#endif
#define XM(o) D8(XH() + 16 + (o))
#define MAXCAR 4
#define MAXCP 24
ST const i8 sn64[64] = { 0, 12, 25, 37, 49, 60, 71, 81, 90, 98, 106, 112, 117, 122, 125, 126, 127, 126, 125, 122, 117, 112, 106, 98, 90, 81, 71, 60, 49, 37, 25, 12, 0, -12, -25, -37, -49, -60, -71, -81, -90, -98, -106, -112, -117, -122, -125, -126, -127, -126, -125, -122, -117, -112, -106, -98, -90, -81, -71, -60, -49, -37, -25, -12 };
ST i16 cxp[MAXCAR], cyp[MAXCAR], csp[MAXCAR], cprg[MAXCAR]; ST u8 cfx[MAXCAR], cfy[MAXCAR], chd[MAXCAR], clap[MAXCAR], cnx[MAXCAR], cdone[MAXCAR], cstk[MAXCAR], cbst[MAXCAR];
ST i16 wpx[MAXCP + 1], wpy[MAXCP + 1];
#ifdef NR3D
ST u8 m3d;
#endif
ST u8 drw[10], ndrw; ST u8 ncp, ncar, nlaps, rstate, rcnt, place, hudk, rpct, fin; ST u16 topv, rtime; ST i16 rlim;
static u8 rtile(i16 x, i16 y) { if (x < 0 || y < 0 || (u16)x >= lwpx || (u16)y >= lhpx) return 1; return cols[mapb[rowp[(u8)((u16)y >> 4)] + ((u16)x >> 4)]]; }
static u8 cwall(i16 x, i16 y) { return rtile(x - 5, y - 5) == 1 || rtile(x + 5, y - 5) == 1 || rtile(x - 5, y + 5) == 1 || rtile(x + 5, y + 5) == 1; }
static i8 fwx(u8 h) { return sn64[h & 63]; }
static i8 fwy(u8 h) { return (i8)(-sn64[(h + 16) & 63]); }
static i16 cl8(i16 v) { v >>= 3; if (v > 120) v = 120; if (v < -120) v = -120; return v; }   /* scaled to fit 16-bit products (no slow 32-bit maths on the small CPUs) */
static i16 crossp(u8 h, i16 dx, i16 dy) { dx = cl8(dx); dy = cl8(dy); return (i16)fwx(h) * dy - (i16)fwy(h) * dx; }
static i16 dotp(u8 h, i16 dx, i16 dy) { dx = cl8(dx); dy = cl8(dy); return (i16)fwx(h) * dx + (i16)fwy(h) * dy; }
static void aim(u8 i, i16 tx, i16 ty) { u8 h, bh = 0; i16 b = -32767, d; i16 dx = tx - cxp[i], dy = ty - cyp[i]; for (h = 0; h < 64; h++) { d = dotp(h, dx, dy); if (d > b) { b = d; bh = h; } } chd[i] = bh; }
static void car_place(u8 i, i16 x, i16 y) { cxp[i] = x; cyp[i] = y; cfx[i] = cfy[i] = 0; csp[i] = 0; cbst[i] = 0; cstk[i] = 0; }
static void car_back(u8 i) {                  /* water / stuck: back to the last checkpoint, facing the next one */
    u8 k = cnx[i]; i16 bx, by;
    if (k == 0) { bx = wpx[ncp]; by = wpy[ncp]; } else { bx = wpx[k - 1]; by = wpy[k - 1]; }
    car_place(i, bx, by); aim(i, wpx[k], wpy[k]);
}
static void car_move(u8 i, u8 m) {
    i16 dxs, dys, s, n, lim, x = cxp[i], y = cyp[i]; u8 hit = 0, c;
    lim = topv; if (cbst[i]) { lim += 256 * RS; cbst[i]--; }
    c = rtile(x, y); if (c == 2) lim >>= 1; else if (c == 3) { car_back(i); return; }
    if (csp[i] > lim) { csp[i] -= 24 * RS; if (csp[i] < lim) csp[i] = lim; }
    dxs = (i16)(((csp[i] >> 4) * (i16)fwx(chd[i])) >> 3); dys = (i16)(((csp[i] >> 4) * (i16)fwy(chd[i])) >> 3); if (m > 1) { dxs *= m; dys *= m; }
    s = (i16)cfx[i] + dxs; cfx[i] = (u8)(s & 255); n = s >> 8;
    if (n) { i16 e = x + n + (n > 0 ? 5 : -5); if (rtile(e, y - 5) == 1 || rtile(e, y + 5) == 1) hit = 1; else cxp[i] = x = x + n; }
    s = (i16)cfy[i] + dys; cfy[i] = (u8)(s & 255); n = s >> 8;
    if (n) { i16 e = y + n + (n > 0 ? 5 : -5); if (rtile(x - 5, e) == 1 || rtile(x + 5, e) == 1) hit = 1; else cyp[i] = y + n; }
    if (hit) { csp[i] -= csp[i] >> 2; if (i == 0 && csp[i] > 300 && (frames & 15) == 0) sfx(2); }
}
static void car_ai(u8 i, u8 m) {
    i16 dx = wpx[cnx[i]] - cxp[i], dy = wpy[cnx[i]] - cyp[i], lim = rlim, cr = crossp(chd[i], dx, dy), dt = dotp(chd[i], dx, dy);
    if (cprg[i] > cprg[0] + 40) lim -= lim >> 3; else if (cprg[i] + 40 < cprg[0]) lim += lim >> 4;
    if (cr > 6 || (dt < 0 && cr >= 0)) { chd[i] = (chd[i] + 1) & 63; if (csp[i] > (lim >> 1)) csp[i] -= 12 * m * RS; }
    else if (cr < -6 || dt < 0) { chd[i] = (chd[i] - 1) & 63; if (csp[i] > (lim >> 1)) csp[i] -= 12 * m * RS; }
    { i16 ax = cxp[i] + (fwx(chd[i]) >> 2), ay = cyp[i] + (fwy(chd[i]) >> 2); if (rtile(ax, ay) == 1) { chd[i] = (chd[i] + ((cr >= 0) ? 2 : -2)) & 63; csp[i] -= 20; } }
    if (csp[i] < lim) csp[i] += 9 * m * RS;
    if (csp[i] < 40) { if (++cstk[i] > 100) car_back(i); } else cstk[i] = 0;
}
static void car_prog(u8 i) {
    i16 dx = wpx[cnx[i]] - cxp[i], dy = wpy[cnx[i]] - cyp[i], d;
    if (dx < 0) dx = -dx; if (dy < 0) dy = -dy; d = dx > dy ? dx : dy;
    if (d < 26) {
        if (cnx[i] == ncp) { cnx[i] = 0; if (clap[i] < 99) clap[i]++; if (i == 0) sfx(4); if (clap[i] >= nlaps && !cdone[i]) cdone[i] = ++fin; }
        else cnx[i]++;
    }
    d >>= 4; if (d > 63) d = 63;
    cprg[i] = (i16)(((u16)clap[i] * (ncp + 1) + cnx[i]) * 64 + (63 - d));
}
static void car_bump(void) {
    u8 i, j; i16 dx, dy;
    for (i = 0; i < ncar; i++) for (j = i + 1; j < ncar; j++) {
        dx = cxp[j] - cxp[i]; dy = cyp[j] - cyp[i];
        if (dx > -12 && dx < 12 && dy > -12 && dy < 12) {
            i8 sx = (dx >= 0) ? 1 : -1, sy = (dy >= 0) ? 1 : -1;
            if (!cwall(cxp[j] + sx, cyp[j])) cxp[j] += sx; if (!cwall(cxp[i] - sx, cyp[i])) cxp[i] -= sx;
            if (!cwall(cxp[j], cyp[j] + sy)) cyp[j] += sy; if (!cwall(cxp[i], cyp[i] - sy)) cyp[i] -= sy;
            if (csp[i] > 200) csp[i] -= 8; if (csp[j] > 200) csp[j] -= 8;
        }
    }
}
static u8 rank_of(u8 i) { u8 j, r = 1; for (j = 0; j < ncar; j++) { if (j == i) continue; if (cdone[i]) { if (cdone[j] && cdone[j] < cdone[i]) r++; } else if (cdone[j] || cprg[j] > cprg[i]) r++; } return r; }
static void race_level(u8 lv) {
    u8 i, hasg = 0; i16 gx, gy;
    load_level(lv);
    nlaps = XM(1); if (!nlaps) nlaps = 3; rpct = XM(3); if (!rpct) rpct = 92; topv = D16(XH() + 16 + 4); if (!topv) topv = 768; rlim = (i16)((((u16)topv >> 2) * rpct) / 25);
    ncp = 0; ncar = 1; gx = px + 6; gy = py + 4;
    car_place(0, px + 6, py + 4);
    for (i = 0; i < nobj && i < MAXOBJ; i++) {
        if (otype[i] == T_CHECK && ncp < MAXCP) { wpx[ncp] = ox[i] + 8; wpy[ncp] = oy[i] + 8; ncp++; oalive[i] = 0; }
        else if (otype[i] == T_GOAL && !hasg) { gx = ox[i] + 8; gy = oy[i] + 8; hasg = 1; }
        else if (otype[i] == T_WALKER && ncar < MAXCAR && ncar <= XM(2)) { car_place(ncar, ox[i] + 8, oy[i] + 8); ncar++; oalive[i] = 0; }
    }
    wpx[ncp] = gx; wpy[ncp] = gy;
    ndrw = 0; for (i = 0; i < nobj && i < MAXOBJ; i++) if (oalive[i] && (otype[i] == T_COIN || otype[i] == T_GOAL) && ndrw < 10) drw[ndrw++] = i;
    for (i = 0; i < ncar; i++) { clap[i] = 0; cnx[i] = 0; cdone[i] = 0; cprg[i] = 0; aim(i, wpx[0], wpy[0]); }
#ifdef NR3D
    m3d = XM(6);
#endif
    fin = 0; rstate = 0; rcnt = 3; rtime = 0; hudk = 255; place = 1; frames = 0; sfx(3);
}
static void race_digit(u8 d, i16 x, i16 y) { draw_obj(T_HEART, d, x, y, 0); }
static u8 race_key(void) { u8 l = clap[0] + 1; if (l > nlaps) l = nlaps; return (u8)(rank_of(0) * 16 + l); }
static void race_hud(void) {
    u8 p = rank_of(0), l = clap[0] + 1; i16 x = 4;
    if (l > nlaps) l = nlaps;
    hal_hud_begin();
    race_digit(10, x, 2); x += 8; race_digit(p, x, 2); x += 12; race_digit(11, x, 2); x += 8; race_digit(l, x, 2); x += 8; race_digit(12, x, 2); x += 8; race_digit(nlaps, x, 2);
    hal_hud_end(); hudk = race_key();
}
static void race_draw(void) {
    u8 i, d, f, fl, c; i16 sx, sy;
    if (hudk != race_key()) race_hud();
    hal_spr_begin();
    for (c = 0; c < ndrw; c++) {
        i = drw[c]; if (!oalive[i]) continue;
        sx = ox[i] - (i16)camx; sy = oy[i] - (i16)camy; if (sx < -16 || sx > HAL_SCR_W || sy < -16 || sy > HAL_SCR_H) continue;
        draw_obj(otype[i], (u8)((frames >> 3) & 1), sx, sy, 0);
    }
    for (i = ncar; i > 0; i--) {
        c = i - 1;
        d = (u8)(((chd[c] + 2) >> 2) & 15); if (d <= 8) { f = d; fl = 0; } else { f = (u8)(16 - d); fl = 1; }
        sx = cxp[c] - 8 - (i16)camx; sy = cyp[c] - 8 - (i16)camy; if (sx < -16 || sx > HAL_SCR_W || sy < -16 || sy > HAL_SCR_H) continue;
        draw_obj(c == 0 ? T_HERO : T_WALKER, f, sx, sy, fl);
    }
    if (rstate == 0) race_digit(rcnt, HAL_SCR_W / 2 - 4, HAL_SCR_H / 2 - 28);
    hal_spr_end();
}
#ifdef NR3D
static void race_draw3d(void) {
    u8 a = chd[0], c, k, d, f, fl, t; i32 fx = fwx(a), fy = fwy(a), rx = -fy, ry = fx, cx = ((i32)cxp[0] << 8) - fx * 140, cy = ((i32)cyp[0] << 8) - fy * 140, dx, dy, dep, lat; i16 sx, sy, w;
    if (hudk != race_key()) race_hud();
    hal_ground3d(mapb, metab, lw, lh, cx, cy, a);
    for (k = 0; k < ndrw + ncar; k++) {
        i32 wx, wy;
        if (k < ndrw) { c = drw[k]; if (!oalive[c]) continue; wx = ox[c] + 8; wy = oy[c] + 8; t = otype[c]; f = (u8)((frames >> 3) & 1); fl = 0; }
        else { c = (u8)(k - ndrw); wx = cxp[c]; wy = cyp[c]; t = (c == 0) ? T_HERO : T_WALKER; d = (u8)(((chd[c] - a + 2) >> 2) & 15); if (d <= 8) { f = d; fl = 0; } else { f = (u8)(16 - d); fl = 1; } }
        dx = wx - (cx >> 8); dy = wy - (cy >> 8); dep = (dx * fx + dy * fy) / 127; lat = (dx * rx + dy * ry) / 127;
        if (dep < 14) continue;
        sx = (i16)(HAL_SCR_W / 2 + (lat * G3_F) / dep); sy = (i16)(G3_HY + ((i32)G3_H * G3_F) / dep); w = (i16)((16 * G3_F) / dep);
        hal_spr3d(sx, sy, w, (i16)dep, (u8)(s_c0[t] + f * s_cpf[t]), s_pal[t], fl);
    }
    hal_spr_begin(); if (rstate == 0) race_digit(rcnt, HAL_SCR_W / 2 - 4, HAL_SCR_H / 2 - 28); hal_spr_end();
}
#endif
static void race_cam(void) {
    i16 cx = cxp[0] - HAL_SCR_W / 2, cy = cyp[0] - HAL_SCR_H / 2, mx = (i16)lw * 16 - HAL_SCR_W, my = (i16)lh * 16 - HAL_SCR_H;
    if (mx < 0) mx = 0; if (my < 0) my = 0; if (cx < 0) cx = 0; if (cx > mx) cx = mx; if (cy < 0) cy = 0; if (cy > my) cy = my; camx = cx; camy = cy;
}
static void race_player(void) {
    if (pad & P_A) { if (csp[0] < topv + 256 * RS) csp[0] += 12 * RS; }
    else if (csp[0] > 4 * RS) csp[0] -= 4 * RS; else if (csp[0] > 0) csp[0] = 0;
    if (pad & P_B) { if (csp[0] > 0) csp[0] -= 22 * RS; else if (csp[0] > -160 * RS) csp[0] -= 8 * RS; }
    else if (csp[0] < 0) csp[0] += 8 * RS;
    if ((csp[0] > 30 || csp[0] < -30) && ((frames * RS) % 3) < RS) {
        if (pad & P_R) chd[0] = (chd[0] + (csp[0] > 0 ? 1 : -1)) & 63; else if (pad & P_L) chd[0] = (chd[0] - (csp[0] > 0 ? 1 : -1)) & 63;
    }
}
static void race_boosts(void) {
    u8 i, c; i16 dx, dy;
    for (i = 0; i < nobj && i < MAXOBJ; i++) if (oalive[i] && otype[i] == T_COIN) for (c = 0; c < ncar; c++) {
        dx = cxp[c] - ox[i] - 8; dy = cyp[c] - oy[i] - 8; if (dx > -12 && dx < 12 && dy > -12 && dy < 12) { cbst[c] = 50 / RS; if (csp[c] < topv) csp[c] = topv; if (c == 0) sfx(1); }
    }
}
void game_main(void) {
    u8 i;
    hal_init(); sprinit(); snd_boot();
    for (;;) {
        screen(0); wait_start();
        nlev = D8(H_NLEV); lvnum = 0; dead = 0; frames = 0;
        play_cs(0, 0); play_cs(1, 0); race_level(0); mus_start();
        while (!dead) {
            padold = pad; pad = hal_pad(); frames++;
            if (rstate == 0) { if ((frames % (50 / RS)) == 0) { if (rcnt > 1) { rcnt--; sfx(3); } else { rstate = 1; sfx(4); } } }
            else {
                rtime++;
                race_player();
                car_move(0, 1);
                { u8 r; for (r = 1; r < ncar; r++) if ((u8)(frames & 1) == (r & 1)) { car_ai(r, 2); car_move(r, 2); car_prog(r); } }
                if ((frames & 1) == 0) { car_bump(); race_boosts(); }
                car_prog(0);
                if (cdone[0] && rstate == 1) { rstate = 2; rcnt = 0; place = rank_of(0); }
            }
            if (rstate == 2) {
                rcnt++; if (csp[0] > 0) csp[0] -= 6 * RS;
                if (rcnt > 70 / RS && (pad & P_START) && !(padold & P_START)) {
                    if (place > 2 && ncar > 1) dead = 1;
                    else { lvnum++; if (lvnum >= nlev) dead = 2; else { play_cs(1, lvnum); race_level(lvnum); } }
                }
            }
#ifdef NR3D
            if (m3d) { race_draw3d(); fr(); continue; }
#endif
            race_cam(); stream(); hal_scroll(camx, camy); race_draw(); fr();
        }
        mus_stop(); if (dead == 2) play_cs(2, 0);
        screen(dead == 2 ? 1 : 2); wait_start();
    }
}
#endif
#if NRMODE == 2
/* ================================================================ RPG / MONSTER COLLECTING (top-down, tile by tile)
   level data = the platformer's (map + objects); tile class 0 walk, 1 solid, 2 tall grass (wild encounters), 3 solid (water).
   objects: start = where you begin, walker = person / shop, hopper = wild monster you can see, flyer = sign, coin = pickup,
   goal = door, spring = chest, check = healing spot.  Every object carries 3 info bytes (see nrmodes.js / nrmini.js).
   extra header +24 -> RPG block: 0 nspecies, 1 catch on, 2 balls, 3 potions, 4 encounter rate, 5 start level, 6 gold, 7 potion price, 8 ball price,
   10 font table, 12 species table (5 bytes: hp atk def xp-reward -), 14 string table, 16 per-level info (7 bytes: enc count, 4 species, min lv, max lv; then 3 bytes per object). */
#ifndef RS
#define RS 1
#endif
#define RBA() D16(XH() + 24)
#define RW(o) D16(RBA() + (o))
#define RY(o) D8(RBA() + (o))
#define CW (HAL_SCR_W / 8)
enum { S_WILD, S_APPEAR, S_HIT, S_CAUGHT, S_BROKE, S_FAINT, S_WON, S_LVUP, S_RAN, S_NORUN, S_NOBALL, S_MENU1, S_MENU2, S_LV, S_HP, S_BLACK, S_HEAL, S_GOLD, S_POTION, S_BALL, S_SHOP, S_SHOP1, S_SHOP2, S_NOGOLD, S_GOT, S_NOPOT, S_PARTY, S_GO, S_FIRST };
ST u8 pspc[6], plvl[6], php[6], npart; ST u16 pxp[6];
ST u8 gone[16][5]; ST u8 gx, gy, fdir, mvn; ST i8 mdx, mdy; ST u16 gold, rseed; ST u8 npot, nball;
ST u8 tb[34], tn, mg[34], mgn; ST u16 ib;
ST u8 fspc, flvl, fhp, fmhp, fobj;
#define IB(i, k) D8(ib + 7 + (i) * 3 + (k))
static u8 rnd(void) { rseed ^= rseed << 7; rseed ^= rseed >> 9; rseed ^= rseed << 8; return (u8)(rseed >> 2); }
static u8 ft(u8 c) { return D8(RW(10) + c); }
static void ch(u8 c) { if (tn < 32) tb[tn++] = ft(c); }
static void cc(u8 c) { ch(c == '/' ? 42 : (c >= '0' && c <= '9') ? (u8)(c - '0' + 27) : (c >= 'A' && c <= 'Z') ? (u8)(c - 'A' + 1) : 0); }
static void sadd(u8 id) { u16 p = D16(RW(14) + id * 2); u8 c; while ((c = D8(p++)) < 250) ch(c); }
static void nadd(u16 v) { u8 d[3], k = 0; do { d[k++] = (u8)(v % 10); v /= 10; } while (v && k < 3); while (k) ch((u8)(d[--k] + 27)); }
static void row(u8 r, u8 centre) { u8 c = 0; if (centre && tn < CW) c = (CW - tn) >> 1; hal_put_tiles(r, c, tb, tn); tn = 0; }
static void mset(void) { u8 i; for (i = 0; i < tn; i++) mg[i] = tb[i]; mgn = tn; tn = 0; }
static void hold(u8 n) { while (n--) fr(); }
static void wait_a(void) { for (;;) { fr(); padold = pad; pad = hal_pad(); if (((pad & P_A) && !(padold & P_A)) || ((pad & P_START) && !(padold & P_START))) return; } }
static u8 sp_mhp(u8 s, u8 l) { return D8(RW(12) + s * 5) + (l << 2); }
static u8 sp_atk(u8 s, u8 l) { return D8(RW(12) + s * 5 + 1) + l; }
static u8 sp_def(u8 s, u8 l) { return D8(RW(12) + s * 5 + 2) + (l >> 1); }
static u8 dmg(u8 a, u8 d) { i16 v = (i16)a + (a >> 1) - d + (rnd() & 3); return v < 1 ? 1 : (u8)v; }
static void say(u8 id) {                          /* text pages: 250 newline, 251 next page, 252 end */
    u16 p = D16(RW(14) + id * 2); u8 c, r;
    for (;;) {
        hal_text_begin(); r = 2; tn = 0;
        for (;;) { c = D8(p++); if (c < 250) { ch(c); continue; } hal_put_tiles(r, 2, tb, tn); tn = 0; r += 2; if (c != 250) break; }
        hal_text_end(0); wait_a(); if (c == 252) return;
    }
}
static void rpg_enter(u8 lv, u8 tx, u8 ty) {
    u8 i; lvnum = lv; rtx = tx; rty = ty; load_level(lv); ib = D16(RW(16) + lv * 2);
    for (i = 0; i < nobj && i < MAXOBJ; i++) if (gone[lv][i >> 3] & (1 << (i & 7))) oalive[i] = 0;
    gx = (u8)(px >> 4); gy = (u8)(py >> 4); mvn = 0;
    hal_hud_begin(); hal_hud_end();
}
static void rpg_back(void) { rpg_enter(lvnum, gx, gy); }
static void take(u8 i) { gone[lvnum][i >> 3] |= (u8)(1 << (i & 7)); oalive[i] = 0; }
static u8 lead(void) { u8 i; for (i = 0; i < npart; i++) if (php[i]) return i; return 255; }
static void bt_draw(u8 menu) {
    u8 l = lead(), i; if (l == 255) l = 0;
    hal_text_begin();
    tn = 0; sadd(S_WILD); ch(0); sadd(S_FIRST + fspc); row(1, 1);
    sadd(S_LV); ch(0); nadd(flvl); ch(0); sadd(S_HP); ch(0); nadd(fhp); cc('/'); nadd(fmhp); row(2, 1);
    sadd(S_FIRST + pspc[l]); row(8, 1);
    sadd(S_LV); ch(0); nadd(plvl[l]); ch(0); sadd(S_HP); ch(0); nadd(php[l]); cc('/'); nadd(sp_mhp(pspc[l], plvl[l])); row(9, 1);
    for (i = 0; i < mgn; i++) tb[i] = mg[i]; tn = mgn; row(12, 1);
    if (menu) { sadd(S_MENU1); row(14, 1); sadd(S_MENU2); row(15, 1); }
    cc('G'); nadd(gold); ch(0); cc('P'); nadd(npot); ch(0); cc('B'); nadd(nball); row(16, 1);
    hal_text_end(1); hal_hud_begin(); hal_hud_end(); hal_spr_begin();
    draw_obj(T_HOPPER, fspc, HAL_SCR_W - 52, 20, 0); draw_obj(T_HOPPER, pspc[l], 28, 52, 1);
    hal_spr_end(); fr();
}
static void bshow(void) { bt_draw(0); hold(48); }
static void say_name(u8 spc, u8 id) { tn = 0; sadd(S_FIRST + spc); ch(0); sadd(id); mset(); }
static void gain(u8 l, u16 xp) {
    pxp[l] += xp;
    while (plvl[l] < 40 && pxp[l] >= (u16)plvl[l] * 6) { pxp[l] -= (u16)plvl[l] * 6; plvl[l]++; php[l] += 4; tn = 0; sadd(S_FIRST + pspc[l]); ch(0); sadd(S_LVUP); mset(); sfx(4); bshow(); }
}
static u8 battle(u8 spc, u8 lvl, u8 obj) {            /* 1 = you blacked out */
    u8 l, act, d, i, mx; fspc = spc; flvl = lvl; fmhp = sp_mhp(spc, lvl); fhp = fmhp; fobj = obj;
    tn = 0; sadd(S_WILD); ch(0); sadd(S_FIRST + spc); ch(0); sadd(S_APPEAR); mset(); sfx(3); bt_draw(0); hold(60);
    for (;;) {
        l = lead(); mgn = 0; bt_draw(1); act = 0;
        while (!act) { fr(); padold = pad; pad = hal_pad(); if ((pad & P_A) && !(padold & P_A)) act = 1; else if ((pad & P_B) && !(padold & P_B)) act = 2; else if ((pad & P_U) && !(padold & P_U)) act = 3; else if ((pad & P_START) && !(padold & P_START)) act = 4; }
        if (act == 1) {
            d = dmg(sp_atk(pspc[l], plvl[l]), sp_def(fspc, flvl)); fhp = d >= fhp ? 0 : (u8)(fhp - d); sfx(3);
            tn = 0; sadd(S_FIRST + pspc[l]); ch(0); sadd(S_HIT); ch(0); nadd(d); mset(); bshow();
            if (!fhp) {
                tn = 0; sadd(S_WON); mset(); bshow(); { u16 g = (u16)D8(RW(12) + fspc * 5 + 3) * flvl; gold += (g >> 3) + 2; gain(l, (g >> 1) + 2); }
                if (fobj != 255) take(fobj);
                return 0;
            }
        } else if (act == 2) {
            if (!RY(1) || !nball) { tn = 0; sadd(S_NOBALL); mset(); bshow(); continue; }
            nball--;
            if ((u16)rnd() < 30 + (u16)(fmhp - fhp) * 200 / fmhp) {
                if (npart < 6) { pspc[npart] = fspc; plvl[npart] = flvl; php[npart] = fhp; pxp[npart] = 0; npart++; }
                tn = 0; sadd(S_CAUGHT); mset(); sfx(4); bshow(); if (fobj != 255) take(fobj); return 0;
            }
            tn = 0; sadd(S_BROKE); mset(); bshow();
        } else if (act == 3) {
            if (!npot) { tn = 0; sadd(S_NOPOT); mset(); bshow(); continue; }
            npot--; mx = sp_mhp(pspc[l], plvl[l]); php[l] = (u8)((u16)php[l] + 25 > mx ? mx : php[l] + 25); tn = 0; sadd(S_HEAL); mset(); sfx(1); bshow();
        } else {
            if (rnd() < 170) { tn = 0; sadd(S_RAN); mset(); bshow(); return 0; }
            tn = 0; sadd(S_NORUN); mset(); bshow();
        }
        d = dmg(sp_atk(fspc, flvl), sp_def(pspc[l], plvl[l])); php[l] = d >= php[l] ? 0 : (u8)(php[l] - d); sfx(2);
        say_name(fspc, S_HIT); tn = 0; for (i = 0; i < mgn; i++) tb[i] = mg[i]; tn = mgn; ch(0); nadd(d); mset(); bshow();
        if (!php[l]) {
            say_name(pspc[l], S_FAINT); bshow();
            if (lead() == 255) { for (i = 0; i < npart; i++) php[i] = sp_mhp(pspc[i], plvl[i]); gold >>= 1; say(S_BLACK); rpg_enter(0, 255, 255); return 1; }
        }
    }
}
static void fight_at(u8 o) { u8 b = battle(IB(o, 0), IB(o, 1), o); if (!b) rpg_back(); }
static void status(void) {
    u8 i, r = 1; hal_text_begin(); tn = 0; sadd(S_PARTY); row(r, 1); r += 2;
    for (i = 0; i < npart && r < 13; i++) { sadd(S_FIRST + pspc[i]); ch(0); sadd(S_LV); nadd(plvl[i]); ch(0); nadd(php[i]); cc('/'); nadd(sp_mhp(pspc[i], plvl[i])); row(r, 0); r++; }
    cc('G'); nadd(gold); ch(0); cc('P'); nadd(npot); ch(0); cc('B'); nadd(nball); row(15, 1);
    hal_text_end(0); wait_a(); rpg_back();
}
static void shop(void) {
    u8 go = 1, m = 0;
    while (go) {
        hal_text_begin(); tn = 0; sadd(S_SHOP); row(1, 1); cc('G'); nadd(gold); ch(0); cc('P'); nadd(npot); ch(0); cc('B'); nadd(nball); row(3, 1);
        sadd(S_SHOP1); row(6, 1); nadd(RY(7)); ch(0); ch(0); ch(0); nadd(RY(8)); row(7, 1);
        if (m) { sadd(m); row(10, 1); } sadd(S_SHOP2); row(13, 1); hal_text_end(0); m = 0;
        for (;;) {
            fr(); padold = pad; pad = hal_pad();
            if ((pad & P_A) && !(padold & P_A)) { if (gold >= RY(7)) { gold -= RY(7); if (npot < 99) npot++; sfx(1); } else m = S_NOGOLD; break; }
            if ((pad & P_B) && !(padold & P_B)) { if (gold >= RY(8)) { gold -= RY(8); if (nball < 99) nball++; sfx(1); } else m = S_NOGOLD; break; }
            if ((pad & P_START) && !(padold & P_START)) { go = 0; break; }
        }
    }
    rpg_back();
}
static u8 cl(i16 x, i16 y) { if (x < 0 || y < 0 || x >= (i16)lw || y >= (i16)lh) return 1; return cols[mapb[rowp[(u8)y] + (u8)x]]; }
static u8 objat(i16 x, i16 y) {
    u8 i, t; for (i = 0; i < nobj && i < MAXOBJ; i++) { if (!oalive[i]) continue; t = otype[i]; if (t != T_WALKER && t != T_HOPPER && t != T_FLYER && t != T_SPRING) continue; if ((ox[i] >> 4) == x && (oy[i] >> 4) == y) return i; }
    return 255;
}
static void give(u8 amt, u8 kind) {
    tn = 0; sadd(S_GOT); ch(0);
    if (kind == 0) { gold += amt; nadd(amt); ch(0); sadd(S_GOLD); } else if (kind == 1) { if (npot + amt < 99) npot += amt; nadd(amt); ch(0); sadd(S_POTION); } else { if (nball + amt < 99) nball += amt; nadd(amt); ch(0); sadd(S_BALL); }
    mset(); sfx(1);
}
static void note_page(void) { u8 i; hal_text_begin(); for (i = 0; i < mgn; i++) tb[i] = mg[i]; tn = mgn; row(8, 1); hal_text_end(0); wait_a(); }
static void arrive(void) {
    u8 i, t, c = cl(gx, gy);
    for (i = 0; i < nobj && i < MAXOBJ; i++) {
        if (!oalive[i]) continue; t = otype[i]; if ((ox[i] >> 4) != gx || (oy[i] >> 4) != gy) continue;
        if (t == T_COIN) { give(IB(i, 0), IB(i, 1)); take(i); note_page(); rpg_back(); return; }
        if (t == T_CHECK) { for (c = 0; c < npart; c++) php[c] = sp_mhp(pspc[c], plvl[c]); sfx(4); say(S_HEAL); rpg_back(); return; }
        if (t == T_GOAL) { sfx(4); if (IB(i, 0) == 255) { dead = 2; return; } play_cs(1, IB(i, 0)); rpg_enter(IB(i, 0), IB(i, 1), IB(i, 2)); return; }
    }
    if (c == 2 && D8(ib) && rnd() < RY(4)) { u8 s = D8(ib + 1 + (rnd() % D8(ib))), lo = D8(ib + 5), hi = D8(ib + 6); if (!battle(s, (u8)(lo + rnd() % (u8)(hi - lo + 1)), 255)) rpg_back(); }
}
static void talk(u8 o) {
    u8 t = otype[o];
    if (t == T_WALKER) { if (IB(o, 2) == 1) { say(IB(o, 0)); shop(); } else { say(IB(o, 0)); if (IB(o, 2) == 2) dead = 2; else rpg_back(); } }
    else if (t == T_FLYER) { say(IB(o, 0)); rpg_back(); }
    else if (t == T_SPRING) { give(IB(o, 0), IB(o, 1)); take(o); note_page(); rpg_back(); }
    else if (t == T_HOPPER) fight_at(o);
}
static void rpg_walk(void) {
    i16 nx, ny; u8 o;
    if (mvn) { px += mdx; py += mdy; if (!--mvn) arrive(); return; }
    if (pad & (P_U | P_D | P_L | P_R)) {
        mdx = mdy = 0;
        if (pad & P_U) { fdir = 1; mdy = -RS; } else if (pad & P_D) { fdir = 0; mdy = RS; } else if (pad & P_L) { fdir = 2; mdx = -RS; } else { fdir = 3; mdx = RS; }
        nx = (i16)gx + (mdx < 0 ? -1 : mdx > 0 ? 1 : 0); ny = (i16)gy + (mdy < 0 ? -1 : mdy > 0 ? 1 : 0);
        o = cl(nx, ny); if (o == 1 || o == 3) return;
        o = objat(nx, ny); if (o != 255) { if (otype[o] == T_HOPPER) fight_at(o); return; }
        gx = (u8)nx; gy = (u8)ny; mvn = 16 / RS;
    } else if ((pad & P_A) && !(padold & P_A)) {
        nx = gx; ny = gy; if (fdir == 0) ny++; else if (fdir == 1) ny--; else if (fdir == 2) nx--; else nx++;
        o = objat(nx, ny); if (o != 255) talk(o);
    } else if ((pad & P_START) && !(padold & P_START)) status();
}
static void rpg_draw(void) {
    u8 i, t, f; i16 sx, sy;
    hal_spr_begin();
    for (i = 0; i < nobj && i < MAXOBJ; i++) {
        if (!oalive[i]) continue; t = otype[i]; if (t == T_START || t == T_GOAL) continue;
        sx = ox[i] - (i16)camx; sy = oy[i] - (i16)camy; if (sx < -16 || sx > HAL_SCR_W || sy < -16 || sy > HAL_SCR_H) continue;
        f = (u8)((frames >> 4) & 1); if (t == T_HOPPER) f = IB(i, 0);
        draw_obj(t, f, sx, sy, 0);
    }
    f = fdir == 0 ? 0 : fdir == 1 ? 2 : 4; if (mvn) f += (u8)((mvn >> 2) & 1);
    draw_obj(T_HERO, f, px - (i16)camx, py - (i16)camy, fdir == 2);
    hal_spr_end();
}
static void rpg_cam(void) {
    i16 cx = px + 8 - HAL_SCR_W / 2, cy = py + 8 - HAL_SCR_H / 2, mx = (i16)lw * 16 - HAL_SCR_W, my = (i16)lh * 16 - HAL_SCR_H;
    if (mx < 0) mx = 0; if (my < 0) my = 0; if (cx < 0) cx = 0; if (cx > mx) cx = mx; if (cy < 0) cy = 0; if (cy > my) cy = my; camx = cx; camy = cy;
}
static void rpg_new(void) {
    u8 i, j; npart = 1; pspc[0] = 0; plvl[0] = RY(5); php[0] = sp_mhp(0, plvl[0]); pxp[0] = 0;
    gold = RY(6); npot = RY(3); nball = RY(2);
    for (i = 0; i < 16; i++) for (j = 0; j < 5; j++) gone[i][j] = 0;
}
void game_main(void) {
    u8 k;
    hal_init(); sprinit(); snd_boot(); rseed = 0xACE1;
    for (;;) {
        screen(0); for (;;) { rseed++; fr(); padold = pad; pad = hal_pad(); if ((pad & P_START) && !(padold & P_START)) break; }
        nlev = D8(H_NLEV); dead = 0; frames = 0; fdir = 0; mgn = 0;
        rpg_new(); play_cs(0, 0); play_cs(1, 0); rpg_enter(0, 255, 255); mus_start();
        while (!dead) {
            padold = pad; pad = hal_pad(); frames++;
            rpg_walk(); if (dead) break;
            rpg_cam(); stream(); hal_scroll(camx, camy); rpg_draw();
            for (k = 0; k < RS; k++) fr();
        }
        mus_stop(); if (dead == 2) play_cs(2, 0);
        screen(dead == 2 ? 1 : 2); wait_start();
    }
}
#endif

#if NRMODE == 4
/* ================================================================ FIRST-PERSON SHOOTER (PlayStation / Nintendo 64: the software PPU casts the walls)
   the level maps are mazes drawn with the same tile editor: tile class 1 = wall (textured with the tile art), everything else is floor.
   objects: start = where you spawn, walker / hopper / flyer = enemies that chase you, coin = score, heart = health, goal = exit.
   controls: Up/Down walk, Left/Right turn, B + Left/Right strafe, A fire.  Lives come from the header, health is 5 hearts. */
#ifndef NR3D
#error "mode 4 (first person) needs a software-PPU console (PlayStation / Nintendo 64)"
#endif
ST const i8 fsn[64] = { 0, 12, 25, 37, 49, 60, 71, 81, 90, 98, 106, 112, 117, 122, 125, 126, 127, 126, 125, 122, 117, 112, 106, 98, 90, 81, 71, 60, 49, 37, 25, 12, 0, -12, -25, -37, -49, -60, -71, -81, -90, -98, -106, -112, -117, -122, -125, -126, -127, -126, -125, -122, -117, -112, -106, -98, -90, -81, -71, -60, -49, -37, -25, -12 };
ST i32 fpx, fpy; ST u8 fang, fhp, fcool, fhurt, fhk, ehp[MAXOBJ]; ST u16 fkills, fscore;
static u8 fwall(i32 x, i32 y) { i16 a = (i16)(x >> 8), b = (i16)(y >> 8); return ctile(a - 4, b - 4) == 1 || ctile(a + 4, b - 4) == 1 || ctile(a - 4, b + 4) == 1 || ctile(a + 4, b + 4) == 1; }
static void fmove(i16 dx, i16 dy) { if (!fwall(fpx + dx, fpy)) fpx += dx; if (!fwall(fpx, fpy + dy)) fpy += dy; }
static void fp_level(u8 n) {
    u8 i; load_level(n); fpx = ((i32)px + 8) << 8; fpy = ((i32)py + 8) << 8; fang = 0; fcool = 0; fhurt = 0; fhk = 255; fhp = 5;
    for (i = 0; i < nobj && i < MAXOBJ; i++) ehp[i] = (otype[i] == T_HOPPER) ? 4 : 2;
}
static void fp_hud(void) {
    u8 i; i16 x = 4;
    hal_hud_begin(); for (i = 0; i < fhp && i < 5; i++) { draw_obj(T_HEART, 0, x, 2, 0); x += 10; }
    for (i = 0; i < lives && i < 5; i++) draw_obj(T_HERO, 0, HAL_SCR_W - 18 - i * 6, 2, 0);
    hal_hud_end(); fhk = (u8)(fhp * 8 + lives);
}
static void fp_shoot(void) {
    u8 i; i32 cx = fsn[(fang + 16) & 63], sx = fsn[fang]; i16 wd = 0, best = 9999, bi = -1; hal_fp_zbuf(60, &wd);
    for (i = 0; i < nobj && i < MAXOBJ; i++) {
        i32 dx, dy, dep, lat; if (!oalive[i]) continue; if (otype[i] != T_WALKER && otype[i] != T_HOPPER && otype[i] != T_FLYER) continue;
        dx = (ox[i] + 8) - (fpx >> 8); dy = (oy[i] + 8) - (fpy >> 8); dep = (dx * cx + dy * sx) / 127; lat = (-dx * sx + dy * cx) / 127;
        if (dep > 4 && dep < wd && (lat < 9 && lat > -9) && dep < best) { best = (i16)dep; bi = i; }
    }
    sfx(0);
    if (bi >= 0) { if (ehp[bi] > 1) { ehp[bi]--; } else { oalive[bi] = 0; fkills++; fscore += 10; sfx(3); } }
}
static void fp_enemies(void) {
    u8 i; i32 px8 = fpx >> 8, py8 = fpy >> 8;
    for (i = 0; i < nobj && i < MAXOBJ; i++) {
        i16 dx, dy, d; u8 t = otype[i]; if (!oalive[i]) continue;
        dx = (i16)(px8 - ox[i] - 8); dy = (i16)(py8 - oy[i] - 8);
        if (t == T_WALKER || t == T_HOPPER || t == T_FLYER) {
            d = (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
            if (d < 150 && (frames & 1) == 0) {
                i16 sx = dx > 3 ? 1 : dx < -3 ? -1 : 0, sy = dy > 3 ? 1 : dy < -3 ? -1 : 0;
                if (ctile(ox[i] + 8 + sx * 7, oy[i] + 8) != 1) ox[i] += sx; if (ctile(ox[i] + 8, oy[i] + 8 + sy * 7) != 1) oy[i] += sy;
            }
            if (d < 20 && fhurt == 0) { if (fhp > 0) fhp--; fhurt = 40; sfx(2); }
        } else if (dx > -10 && dx < 10 && dy > -10 && dy < 10) {
            if (t == T_COIN) { oalive[i] = 0; fscore += 5; sfx(1); }
            else if (t == T_HEART) { oalive[i] = 0; if (fhp < 5) fhp++; sfx(1); }
            else if (t == T_GOAL) { sfx(4); lvnum++; if (lvnum >= nlev) dead = 2; else { play_cs(1, lvnum); fp_level(lvnum); } return; }
        }
    }
}
static void fp_draw(void) {
    u8 i, t; i32 cx = fsn[(fang + 16) & 63], sx = fsn[fang], dx, dy, dep, lat; i16 scx, w, sy, zz;
    hal_fp3d(mapb, metab, cols, lw, lh, fpx, fpy, fang);
    for (i = 0; i < nobj && i < MAXOBJ; i++) {
        t = otype[i]; if (!oalive[i] || t == T_START || t == T_CHECK || t == T_SPRING) continue;
        dx = (ox[i] + 8) - (fpx >> 8); dy = (oy[i] + 8) - (fpy >> 8); dep = (dx * cx + dy * sx) / 127; lat = (-dx * sx + dy * cx) / 127;
        if (dep < 8) continue;
        scx = (i16)(120 + (lat * 160) / dep); w = (i16)(2400 / dep); sy = (i16)(80 + 1800 / dep);
        if (scx < -w || scx > 240 + w) continue;
        if (scx >= 0 && scx < 240) { hal_fp_zbuf((u8)(scx >> 1), &zz); if (zz < dep) continue; }
        hal_spr3d(scx, sy, w, (i16)dep, (u8)(s_c0[t] + ((frames >> 3) & 1) * s_cpf[t]), s_pal[t], 0);
    }
    if (fhk != (u8)(fhp * 8 + lives)) fp_hud();
    hal_spr_begin();
    draw_obj(T_COIN, 0, 120 - 8, 80 - 8, 0);                      /* crosshair */
    if (fcool > 6) draw_obj(T_SPRING, 0, 120 - 8, 120, 0);        /* muzzle flash */
    hal_spr_end();
}
void game_main(void) {
    hal_init(); sprinit(); snd_boot();
    for (;;) {
        screen(0); wait_start();
        nlev = D8(H_NLEV); lives = D8(H_LIVES); lvnum = 0; dead = 0; frames = 0; fkills = 0; fscore = 0; coins = 0;
        play_cs(0, 0); play_cs(1, 0); fp_level(0); mus_start();
        while (!dead) {
            i16 cx, sx, sp = 192; padold = pad; pad = hal_pad(); frames++;
            cx = fsn[(fang + 16) & 63]; sx = fsn[fang];
            if (pad & P_B) { if (pad & P_L) fmove((i16)(sx * sp / 127), (i16)(-cx * sp / 127)); if (pad & P_R) fmove((i16)(-sx * sp / 127), (i16)(cx * sp / 127)); }
            else { if ((pad & P_L) && (frames & 1)) fang = (fang - 1) & 63; if ((pad & P_R) && (frames & 1)) fang = (fang + 1) & 63; }
            if (pad & P_U) fmove((i16)(cx * sp / 127), (i16)(sx * sp / 127));
            if (pad & P_D) fmove((i16)(-cx * sp / 127), (i16)(-sx * sp / 127));
            if (fcool) fcool--; if (fhurt) fhurt--;
            if ((pad & P_A) && fcool == 0) { fcool = 12; fp_shoot(); }
            fp_enemies();
            if (fhp == 0 && !dead) { if (lives > 1) { lives--; fp_level(lvnum); } else dead = 1; }
            if (dead) break;
            fp_draw(); fr();
        }
        mus_stop(); if (dead == 2) play_cs(2, 0);
        screen(dead == 2 ? 1 : 2); wait_start();
    }
}
#endif
