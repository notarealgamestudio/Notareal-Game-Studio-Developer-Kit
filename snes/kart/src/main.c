/* NOTAREAL Dev Kit - SNES Mode 7 kart racer (six karts, items, laps).
   B gas, Y brake / reverse, A use item, D-pad steer, START pause. Drive over item boxes for a turbo, a homing shell or a mine; boost pads on the road give a short burst.
   The road is real Mode 7: the console rotates and tilts the circuit with one HDMA matrix table per heading, like the SNES kart games did.
   Settings come from a 56-byte block at $81:8000 ("NRGKART1"): laps, speed class, rivals, skill, title (the dev kit patches it).
   Built with PVSnesLib. tcc-816 notes: no switch, no a||b of calls, no ternaries of calls, keep to 16-bit math.
   The game logic runs at 30 steps a second (two video frames per step) so six karts, items and sprites fit the CPU budget. */
#include <snes.h>
#include <string.h>
#include "tables.h"

#define R8(a) (*(volatile u8 *)(a))
typedef const u8 *rp;
typedef union { rp p; u8 b[4]; } PU;
static PU pu;
static rp mkptr(u16 addr, u16 bank) { pu.b[0] = (u8)addr; pu.b[1] = (u8)(addr >> 8); pu.b[2] = (u8)bank; pu.b[3] = 0; return pu.p; }
static u16 plo(rp p) { pu.p = p; return pu.b[0] | (pu.b[1] << 8); }
static u8 pbk(rp p) { pu.p = p; return pu.b[2]; }

extern char nr_font, nr_font_end, nr_logo_tiles, nr_logo_tiles_end, nr_logo_map, nr_logo_pal;
extern char gnd_tiles, gnd_tiles_end, gnd_map, gnd_pal, surf_map, wp_data, spr_tiles, spr_tiles_end;
extern char tm_tab, haze_rg, haze_b, mt_ptr, mt_bank;

/* ------------------------------------------------------------------ settings (patched by the dev kit) */
static u8 cfg_laps = 3, cfg_cc = 2, cfg_rivals = 3, cfg_skill = 2;
static char title[25];
static void read_cfg(void) {
    rp c = mkptr(0x8000, 0x81); u16 i;
    strcpy(title, "NOTAREAL KART");
    if (c[0] != 'N' || c[1] != 'R' || c[2] != 'G' || c[3] != 'K') return;
    cfg_laps = c[8]; if (cfg_laps < 1) cfg_laps = 1; if (cfg_laps > 9) cfg_laps = 9;
    cfg_cc = c[9]; if (cfg_cc < 1) cfg_cc = 1; if (cfg_cc > 3) cfg_cc = 3;
    cfg_rivals = c[10]; if (cfg_rivals < 1) cfg_rivals = 1; if (cfg_rivals > 3) cfg_rivals = 3;
    cfg_skill = c[11]; if (cfg_skill < 1) cfg_skill = 1; if (cfg_skill > 3) cfg_skill = 3;
    if (c[16]) { for (i = 0; i < 24; i++) { title[i] = c[16 + i]; if (!c[16 + i]) break; } title[24] = 0; }
}

/* ------------------------------------------------------------------ small helpers */
static u16 rs = 0x2B1D;
static u16 rnd(u16 n) { rs = rs * 25173u + 13849u; return (rs >> 4) % n; }
static s16 absv(s16 v) { if (v < 0) return -v; return v; }
static s16 sn(u16 a) { return SIN[a >> 8]; }
static s16 cs(u16 a) { return SIN[(u8)((a >> 8) + 64)]; }
/* (v * s) >> 7 using the SNES hardware 8x8 multiplier; v any s16, s in -127..127 */
static s16 mul7(s16 v, s16 s) {
    u16 neg = 0, lo, hi = 0, r;
    if (v < 0) { v = -v; neg = 1; }
    if (s < 0) { s = -s; neg ^= 1; }
    R8(0x4202) = (u8)s; R8(0x4203) = (u8)v;
    if (v > 255) hi = (u16)v >> 8;
    lo = *(volatile u16 *)0x4216;
    r = (u16)(lo << 1) >> 8;
    if (hi) { R8(0x4203) = (u8)hi; r += (*(volatile u16 *)0x4216) << 1; }
    if (neg) return -(s16)r;
    return (s16)r;
}
static s16 l1(s16 dx, s16 dy) { return absv(dx) + absv(dy); }

/* ------------------------------------------------------------------ world data (waypoints cached in RAM) */
static rp surf;
static s16 WX[64], WY[64], WNX[64], WNY[64];
#define NK 6
#define NCR 24
#define NSH 8
#define NMN 12
static s16 X[NK], Y[NK], SP[NK], TX[NK], TY[NK];
static u8 SV[NK];
static u16 H[NK];
static s16 SPIN[NK], BOOST[NK], HELD[NK], IDLY[NK], WPN[NK], LANE[NK], FIN[NK];
static u16 WPC[NK], FTIME[NK], KEY[NK], RK[NK];
static s16 crx[NCR], cry[NCR], crt[NCR];
static s16 shx[NSH], shy[NSH], shl[NSH], shown[NSH]; static u16 shh[NSH];
static s16 mnx[NMN], mny[NMN], mnl[NMN], mnown[NMN], mnty[NMN];
static s16 SHLD[NK];
static u16 CH, tick, racet, nproj;
static s16 camx, camy;
static u8 racers, finorder[NK], nfin;
static s16 topspd;
static const char *NAMES[NK] = { "YOU", "MAX", "ROSE", "JADE", "SKY", "ACE" };

static void cache_wps(void) {
    rp w = (rp)&wp_data; u16 i;
    for (i = 0; i < 64; i++) {
        WX[i] = w[i * 6] | (w[i * 6 + 1] << 8); WY[i] = w[i * 6 + 2] | (w[i * 6 + 3] << 8);
        WNX[i] = (s16)(signed char)w[i * 6 + 4]; WNY[i] = (s16)(signed char)w[i * 6 + 5];
    }
}
static u8 surface(s16 x16, s16 y16) {
    u16 px = (u16)x16 >> 4, py = (u16)y16 >> 4;
    if (px > 1023 || py > 1023) return 4;
    return surf[((py >> 3) << 7) + (px >> 3)];
}
static void set_target(u16 i) {
    TX[i] = WX[WPN[i]] + ((WNX[WPN[i]] * LANE[i]) >> 7); TY[i] = WY[WPN[i]] + ((WNY[WPN[i]] * LANE[i]) >> 7);
}
static void place_grid(void) {
    u16 i, slot; s16 bx, by, fx, fy, rx, ry, back, side;
    bx = WX[0]; by = WY[0];
    fx = sn(START_ANGLE << 8); fy = -cs(START_ANGLE << 8); rx = cs(START_ANGLE << 8); ry = sn(START_ANGLE << 8);
    for (i = 0; i < racers; i++) {
        if (i == 0) slot = racers - 1; else slot = i - 1;          /* the player starts at the back of the grid */
        back = 20 + (slot >> 1) * 22; side = -11; if (slot & 1) side = 11;
        X[i] = (bx - mul7(back, fx) + mul7(side, rx)) * 16;
        Y[i] = (by - mul7(back, fy) + mul7(side, ry)) * 16;
        H[i] = (u16)START_ANGLE << 8; SP[i] = 0; SPIN[i] = 0; BOOST[i] = 0; HELD[i] = 0; SHLD[i] = 0; IDLY[i] = 0; WPN[i] = 0; WPC[i] = 0; FIN[i] = 0; FTIME[i] = 0;
        LANE[i] = (s16)rnd(31) - 15; set_target(i); SV[i] = 1;
    }
}
static void place_crates(void) {
    u16 c, k, wi; s16 off;
    for (c = 0; c < NCR; c++) {
        k = c / 3; off = ((s16)(c % 3) - 1) * 15; wi = (k * 8 + 6) & 63;
        crx[c] = WX[wi] + ((WNX[wi] * off) >> 7); cry[c] = WY[wi] + ((WNY[wi] * off) >> 7); crt[c] = 0;
    }
}

/* ------------------------------------------------------------------ gameplay */
static void calc_ranks(void) {
    u16 i, j, d;
    for (i = 0; i < racers; i++) {
        d = (u16)l1(WX[WPN[i]] - ((s16)((u16)X[i] >> 4)), WY[WPN[i]] - ((s16)((u16)Y[i] >> 4))) >> 2; if (d > 63) d = 63;
        KEY[i] = (WPC[i] << 6) + (63 - d);
    }
    for (i = 0; i < racers; i++) { RK[i] = 1; for (j = 0; j < racers; j++) if (KEY[j] > KEY[i]) RK[i]++; }
}
static void spin_out(u16 i) { if (SPIN[i] > 0 || SHLD[i] > 0) return; BOOST[i] = 0; SPIN[i] = 30; }
static void give_item(u16 i) {
    u16 rk = RK[i], v = rnd(100);
    /* 1 turbo, 2 homing shell, 3 mine, 4 shield, 5 oil slick, 6 triple shells, 7 shock (hits everyone ahead): leaders get defence, the back gets attack */
    if (rk <= 2) { if (v < 22) HELD[i] = 3; else if (v < 44) HELD[i] = 4; else if (v < 66) HELD[i] = 5; else if (v < 84) HELD[i] = 2; else HELD[i] = 1; }
    else if (rk <= 4) { if (v < 20) HELD[i] = 1; else if (v < 40) HELD[i] = 2; else if (v < 55) HELD[i] = 3; else if (v < 70) HELD[i] = 4; else if (v < 85) HELD[i] = 6; else HELD[i] = 5; }
    else { if (v < 22) HELD[i] = 1; else if (v < 44) HELD[i] = 6; else if (v < 64) HELD[i] = 2; else if (v < 84) HELD[i] = 7; else HELD[i] = 4; }
    IDLY[i] = 12 + (s16)rnd(30);
}
static void fire_shell(u16 i) {
    u16 s;
    for (s = 0; s < NSH; s++) if (shl[s] <= 0) {
        shl[s] = 110; shown[s] = i; shh[s] = H[i]; nproj = 1;
        shx[s] = X[i] + mul7(14 * 16, sn(H[i])); shy[s] = Y[i] - mul7(14 * 16, cs(H[i]));
        return;
    }
}
static void drop_mine(u16 i, s16 ty) {
    u16 m;
    for (m = 0; m < NMN; m++) if (mnl[m] <= 0) {
        mnty[m] = ty; mnl[m] = 450; mnown[m] = i; nproj = 1;
        mnx[m] = X[i] - mul7(18 * 16, sn(H[i])); mny[m] = Y[i] + mul7(18 * 16, cs(H[i]));
        return;
    }
}
static void use_item(u16 i) {
    s16 h = HELD[i];
    if (h == 1) { BOOST[i] = 38; SP[i] += 12; }
    if (h == 2) fire_shell(i);
    if (h == 3) drop_mine(i, 0);
    if (h == 4) SHLD[i] = 210;
    if (h == 5) drop_mine(i, 1);
    if (h == 6) { u16 sv0 = H[i]; fire_shell(i); H[i] = sv0 + 3000; fire_shell(i); H[i] = sv0 - 3000; fire_shell(i); H[i] = sv0; }
    if (h == 7) { u16 j; for (j = 0; j < racers; j++) if (j != i && RK[j] < RK[i]) { spin_out(j); SP[j] = SP[j] >> 1; } }
    HELD[i] = 0;
}
static void kart_step(u16 i, u16 steer, u16 gas, u16 brake) {
    s16 cap, t, nx, ny, sp = SP[i]; u16 h = H[i], bo = BOOST[i]; u8 sv = SV[i];
    if (SHLD[i] > 0) SHLD[i]--;
    if (SPIN[i] > 0) {
        SPIN[i]--; h += 2800; sp = sp - (sp >> 3);
        gas = 0; steer = 0; brake = 0;
    }
    cap = topspd; if (sv == 0) cap = topspd >> 1; else if (sv == 3) cap = topspd - (topspd >> 3);
    if (bo > 0) { bo--; cap += 30; if (sp < cap - 8) sp += 5; }
    if (sv == 2) { bo = 36; if (sp < cap) sp += 6; }
    if (gas) { if (sp < cap) sp += 2; }
    else if (sp > 0) sp--;
    if (brake) { if (sp > 0) sp -= 4; else if (sp > -18) sp -= 2; }
    if (sp > cap && bo == 0) sp -= 2;
    if (sp < 0 && !brake) sp++;
    t = sp; if (t < 0) t = -t;
    if (steer && t > 3) {
        s16 rate = 500 + t * 6; if (t < 16) rate = 260 + t * 22; if (rate > 960) rate = 960;
        if (sp < 0) rate = -rate;
        if (steer == 1) h -= rate; else h += rate;
    }
    nx = X[i] + mul7(sp, sn(h)); ny = Y[i] - mul7(sp, cs(h));
    sv = surface(nx, ny);
    if (sv == 4) { sp = -(sp >> 1); if (sp > 8) sp = 8; sv = SV[i]; }
    else { X[i] = nx; Y[i] = ny; }
    SV[i] = sv; SP[i] = sp; H[i] = h; BOOST[i] = bo;
}
/* each CPU has its own preset skill: rookie / racer / ace, shifted by the race setting */
static u8 cpu_skill(u16 i) { s16 k = (s16)((i - 1) % 3) + (s16)cfg_skill - 2; if (k < 1) k = 1; if (k > 3) k = 3; return (u8)k; }
static s16 ai_top(u16 i) {
    u8 sk = cpu_skill(i);
    s16 base = topspd - (topspd >> 4) * (3 - (s16)sk);
    if (sk == 3) base += 3;
    if (RK[i] >= 4) base += 4;
    if (RK[i] == 1) base -= 3;
    return base;
}
/* AI: steer toward the next waypoint (offset to its lane) with the sign of a cross product, no trig tables needed */
static u8 AST[NK], AGAS[NK];
static void ai_step(u16 i) {
    s16 dx, dy, cr, dt, l, sh, ch; u16 steer, gas;
    if ((tick + i) & 1) { steer = AST[i]; gas = AGAS[i]; }
    else {
        steer = 0; gas = 1;
        sh = sn(H[i]); ch = cs(H[i]);
        dx = TX[i] - (s16)((u16)X[i] >> 4); dy = TY[i] - (s16)((u16)Y[i] >> 4);
        cr = mul7(dx, ch) + mul7(dy, sh);                       /* positive = target is to the right */
        dt = mul7(dx, sh) - mul7(dy, ch);                        /* positive = target is ahead */
        l = l1(dx, dy); if (l < 1) l = 1;
        if (dt < 0) { if (cr >= 0) steer = 2; else steer = 1; }
        else { if (((cr << 1) + cr) > l) steer = 2; else if (((cr << 1) + cr) < -l) steer = 1; }
        if (l < 44) { WPN[i] = (WPN[i] + 1) & 63; WPC[i]++; set_target(i); }
        if (steer && SP[i] > topspd - 6) { if (absv(cr) * 2 > l) { if (cpu_skill(i) < 3) gas = (tick & 2) != 0; } }
        AST[i] = steer; AGAS[i] = gas;
        if (HELD[i] > 0) {
            if (IDLY[i] > 0) IDLY[i]--;
            else { if (HELD[i] == 2 || HELD[i] == 6) { if (dt > 0) use_item(i); } else if (HELD[i] == 7) { if (RK[i] > 2) use_item(i); } else use_item(i); }
        }
    }
    kart_step(i, steer, gas, 0);
}
static void update_projectiles(void) {
    u16 s, m, j; s16 dx, dy, cr, bd, d, best, sh, ch;
    if (!nproj) return;
    nproj = 0;
    for (s = 0; s < NSH; s++) if (shl[s] > 0) {
        shl[s]--; nproj = 1; sh = sn(shh[s]); ch = cs(shh[s]);
        best = -1; bd = 400;
        for (j = 0; j < racers; j++) if (j != shown[s]) {
            dx = (X[j] - shx[s]) >> 4; dy = (Y[j] - shy[s]) >> 4;
            if (absv(dx) < 200 && absv(dy) < 200) { d = l1(dx, dy); if (d < bd) { bd = d; best = j; } }
        }
        if (best >= 0) {
            dx = (X[best] - shx[s]) >> 4; dy = (Y[best] - shy[s]) >> 4;
            cr = mul7(dx, ch) + mul7(dy, sh);
            if (cr > 3) shh[s] += 2600; else if (cr < -3) shh[s] -= 2600;
            if (bd < 12) { spin_out(best); shl[s] = 0; continue; }
        }
        shx[s] += mul7(topspd + 18, sh); shy[s] -= mul7(topspd + 18, ch);
        if (surface(shx[s], shy[s]) == 4) shl[s] = 0;
    }
    for (m = 0; m < NMN; m++) if (mnl[m] > 0) {
        mnl[m]--; nproj = 1;
        for (j = 0; j < racers; j++) {
            if (j == mnown[m]) { if (mnl[m] > 410) continue; }
            if (l1((X[j] - mnx[m]) >> 4, (Y[j] - mny[m]) >> 4) < 12) { if (mnty[m] == 1) { if (SHLD[j] <= 0) { SP[j] = SP[j] >> 2; if (SPIN[j] <= 0) SPIN[j] = 16; } } else spin_out(j); mnl[m] = 0; break; }
        }
    }
}
static void pickups(u16 i) {
    u16 c, g0 = (WPN[i] + 2) >> 3, g, e; s16 px = (s16)((u16)X[i] >> 4), py = (s16)((u16)Y[i] >> 4);
    g0 = (g0 + 7) & 7;
    for (g = 0; g < 2; g++) {
        e = ((g0 + g) & 7) * 3;
        for (c = e; c < e + 3; c++) {
            s16 ddx;
            if (crt[c] > 0) continue;
            ddx = crx[c] - px; if (ddx > 14 || ddx < -14) continue;
            ddx = cry[c] - py; if (ddx > 14 || ddx < -14) continue;
            crt[c] = 150; if (HELD[i] == 0) give_item(i);
        }
    }
}
static void collide(void) {
    u16 i, j; s16 dx, dy, px, py;
    for (i = 0; i < racers; i++) for (j = i + 1; j < racers; j++) {
        dx = X[i] - X[j]; if (dx > 192 || dx < -192) continue;
        dy = Y[i] - Y[j]; if (dy > 192 || dy < -192) continue;
        {
            px = 0; py = 0;
            if (dx > 0) px = 12; else if (dx < 0) px = -12;
            if (dy > 0) py = 12; else if (dy < 0) py = -12;
            if (surface(X[i] + px, Y[i] + py) != 4) { X[i] += px; Y[i] += py; }
            if (surface(X[j] - px, Y[j] - py) != 4) { X[j] -= px; Y[j] -= py; }
            if (SP[i] > SP[j]) { SP[i] -= 2; SP[j] += 1; } else { SP[j] -= 2; SP[i] += 1; }
        }
    }
}
static void race_step(u16 pad, u16 padh_) {
    u16 i, c, steer = 0, gas = 0, brake = 0; s16 save;
    tick++; racet++;
    if (!(tick & 7)) calc_ranks();
    if (pad & KEY_LEFT) steer = 1; if (pad & KEY_RIGHT) steer = 2;
    if (pad & KEY_B) gas = 1; if (pad & KEY_Y) brake = 1;
    if (padh_ & KEY_A) { if (HELD[0] > 0 && !FIN[0]) use_item(0); }
    topspd = 50 + cfg_cc * 10; save = topspd;
    for (i = 0; i < racers; i++) {
        if (i == 0) {
            if (FIN[0]) ai_step(0);
            else {
                if (l1(TX[0] - ((s16)((u16)X[0] >> 4)), TY[0] - ((s16)((u16)Y[0] >> 4))) < 44) { WPN[0] = (WPN[0] + 1) & 63; WPC[0]++; set_target(0); }
                kart_step(0, steer, gas, brake);
            }
        } else {
#ifndef NOAI
            topspd = ai_top(i); ai_step(i); topspd = save;
#endif
        }
#ifndef NOPICK
        if (i == 0 || ((tick + i) & 1)) pickups(i);
#endif
        if (!FIN[i]) { if (WPC[i] >= (u16)cfg_laps * 64 + 1) { FIN[i] = 1; FTIME[i] = racet; finorder[nfin++] = i; } }
    }
#ifndef NOCOL
    if (tick & 1) collide();
    update_projectiles();
#endif
    for (c = 0; c < NCR; c++) if (crt[c] > 0) crt[c]--;
    { s16 diff = (s16)(H[0] - CH); CH += (diff >> 2) + (diff >> 3); }
    camx = (s16)((u16)X[0] >> 4); camy = (s16)((u16)Y[0] >> 4);
}

/* ------------------------------------------------------------------ video: sprites are written straight into the OAM buffer */
static u16 oid, oidprev, omax = 128;
static void put(s16 x, s16 y, u16 tile, u16 pal, u16 hf, u16 big) {
    u16 b, n = oid; u8 hi;
    if (n >= omax) return;
    if (x < -32 || x > 255 || y < -32 || y > 223) return;
    b = n << 2;
    oamMemory[b] = (u8)x; oamMemory[b + 1] = (u8)y; oamMemory[b + 2] = (u8)tile;
    oamMemory[b + 3] = (u8)(0x30 | (pal << 1) | ((tile >> 8) & 1) | (hf << 6));
    hi = 0; if (x < 0) hi = 1; if (big) hi |= 2;
    if (hi) {
        b = 512 + (n >> 2); n &= 3;
        if (n == 0) oamMemory[b] |= hi; else if (n == 1) oamMemory[b] |= hi << 2; else if (n == 2) oamMemory[b] |= hi << 4; else oamMemory[b] |= hi << 6;
    }
    oid++;
}
static void oam_begin(void) { u16 i, e = 512 + (omax >> 2); for (i = 512; i < e; i++) oamMemory[i] = 0; oid = 0; }
static void oam_end(void) {
    u16 n = oid;
    while (n < oidprev) { oamMemory[n << 2] = 0; oamMemory[(n << 2) + 1] = 240; n++; }
    oidprev = oid;
}
/* race HUD: fixed OAM slots 96..127, only the changing tiles are rewritten */
#define HS 96
#define FONT0 208
static void hs_set(u16 slot, s16 x, s16 y, u16 tile, u16 pal) {
    u16 b = (HS + slot) << 2;
    oamMemory[b] = (u8)x; oamMemory[b + 1] = (u8)y; oamMemory[b + 2] = (u8)tile; oamMemory[b + 3] = (u8)(0x30 | (pal << 1) | ((tile >> 8) & 1));
}
static void hs_text(u16 slot, s16 x, s16 y, const char *t) { while (*t) { hs_set(slot, x, y, FONT0 + *t, 7); slot++; x += 8; t++; } }
static void hs_hide(void) { u16 i; for (i = 0; i < 32; i++) oamMemory[((HS + i) << 2) + 1] = 240; }
static void spr8(s16 x, s16 y, u16 tile, u16 pal) { put(x, y, tile, pal, 0, 0); }
static void spr32(s16 x, s16 y, u16 tile, u16 pal, u16 hf) { put(x, y, tile, pal, hf, 1); }
static void text(s16 x, s16 y, const char *s, u16 pal) {
    while (*s) { if (*s != ' ') put(x, y, 15 * 16 + (*s - 32), pal, 0, 0); x += 8; s++; }
}
static char nbuf[8];
static char *num(u16 v) { u16 i = 6; nbuf[7] = 0; nbuf[6] = '0'; if (!v) return nbuf + 6; while (v) { nbuf[i] = '0' + (v % 10); v /= 10; i--; } return nbuf + i + 1; }
static char tbuf[10];
static char *timestr(u16 f) {
    u16 s = f / 30, m = s / 60, c = ((f % 30) * 100) / 30; s = s % 60;
    tbuf[0] = '0' + (m % 10); tbuf[1] = ':'; tbuf[2] = '0' + s / 10; tbuf[3] = '0' + s % 10; tbuf[4] = '.'; tbuf[5] = '0' + c / 10; tbuf[6] = '0' + c % 10; tbuf[7] = 0;
    return tbuf;
}
static void fade(s16 from, s16 to) {
    s16 b = from;
    while (1) { setBrightness((u8)b); WaitForVBlank(); if (b == to) break; if (to > from) b++; else b--; }
}
static u16 pad, padh;
static void hdma_frame(u16 ch_) {
    u16 hi = (ch_ >> 9) & 127, a; u8 bk; rp t = (rp)&mt_ptr, b = (rp)&mt_bank;
    s16 hx = camx - 128, vy = camy - 192;
    a = t[hi * 2] | (t[hi * 2 + 1] << 8); bk = b[hi];
    R8(0x4310) = 0x03; R8(0x4311) = 0x1B; R8(0x4312) = (u8)a; R8(0x4313) = (u8)(a >> 8); R8(0x4314) = bk;
    a += TABSZ;
    R8(0x4320) = 0x03; R8(0x4321) = 0x1D; R8(0x4322) = (u8)a; R8(0x4323) = (u8)(a >> 8); R8(0x4324) = bk;
    R8(0x210D) = (u8)hx; R8(0x210D) = (u8)(hx >> 8); R8(0x210E) = (u8)vy; R8(0x210E) = (u8)(vy >> 8);
    R8(0x211F) = (u8)camx; R8(0x211F) = (u8)(camx >> 8); R8(0x2120) = (u8)camy; R8(0x2120) = (u8)(camy >> 8);
}
static void hdma_static(void) {
    rp a;
    a = (rp)&tm_tab; R8(0x4330) = 0x00; R8(0x4331) = 0x2C; R8(0x4332) = (u8)plo(a); R8(0x4333) = (u8)(plo(a) >> 8); R8(0x4334) = pbk(a);
    a = (rp)&haze_rg; R8(0x4340) = 0x02; R8(0x4341) = 0x32; R8(0x4342) = (u8)plo(a); R8(0x4343) = (u8)(plo(a) >> 8); R8(0x4344) = pbk(a);
    a = (rp)&haze_b; R8(0x4350) = 0x00; R8(0x4351) = 0x32; R8(0x4352) = (u8)plo(a); R8(0x4353) = (u8)(plo(a) >> 8); R8(0x4354) = pbk(a);
    R8(0x2130) = 0x00; R8(0x2131) = 0x21;
    R8(0x420C) = 0x3E;
}
/* one game step = two video frames: show this step's picture at the first vblank, idle through the second */
static u16 step_frames = 2;
static void frame_end(void) {
    u16 k;
#ifndef FREE
    WaitForVBlank(); oamUpdate();
    hdma_frame(CH);
#endif
    k = padsCurrent(0); padh = k & ~pad; pad = k;
#ifndef FREE
    if (step_frames > 1) WaitForVBlank();
#endif
}

/* world -> screen through two small lookup tables (no divisions) */
static s16 psx, pcs, psn;
static s16 project(s16 wx, s16 wy) {
    s16 dx = wx - camx, dy = wy - camy, d, lat, yr; u16 m; s16 sh = psn, ch = pcs;
    if (dx > 250 || dx < -250 || dy > 250 || dy < -250) return -1;
    d = mul7(dx, sh) - mul7(dy, ch);
    if (d < -20 || d > 300) return -1;
    lat = mul7(dx, ch) + mul7(dy, sh);
    yr = YROW[d + 20];
    if (yr > 223) return -1;
    if (lat < 0) { m = (u16)(-lat) * KS[yr - 40]; psx = 128 - (s16)(m >> 7); }
    else { m = (u16)lat * KS[yr - 40]; psx = 128 + (s16)(m >> 7); }
    return yr;
}
typedef struct { s16 key; s16 sx; u8 kind; u8 idx; } DR;
static DR drs[48];
static u16 ndr;
static void add_dr(s16 key, s16 sx, u8 kind, u8 idx) {
    u16 k = ndr;
    if (ndr >= 48) return;
    while (k > 0 && drs[k - 1].key > key) { drs[k] = drs[k - 1]; k--; }
    drs[k].key = key; drs[k].sx = sx; drs[k].kind = kind; drs[k].idx = idx; ndr++;
}
static u16 frame_for(s16 rel, u16 *flip) {
    s16 a = rel >> 8, m; u16 f;
    *flip = 0; m = a; if (m < 0) { m = -m; *flip = 1; }
    if (m < 8) f = 0; else if (m < 24) f = 5; else if (m < 48) f = 1; else if (m < 80) f = 2; else if (m < 112) f = 3; else f = 4;
    return f;
}
static void draw_world(void) {
    u16 k, i, fl, f, tile; s16 yr, sx; u16 it;
    ndr = 0; psn = sn(CH); pcs = cs(CH);
    add_dr(1000, 128, 0, 0);
    for (i = 1; i < racers; i++) { yr = project((s16)((u16)X[i] >> 4), (s16)((u16)Y[i] >> 4)); if (yr >= 0) add_dr(yr, psx, 0, i); }
    { u16 g0 = ((WPN[0] + 2) >> 3), g, c, e; g0 = (g0 + 7) & 7;
      for (g = 0; g < 4; g++) { e = ((g0 + g) & 7) * 3; for (c = e; c < e + 3; c++) if (crt[c] == 0) { yr = project(crx[c], cry[c]); if (yr >= 0) add_dr(yr, psx, 1, c); } } }
    for (i = 0; i < NMN; i++) if (mnl[i] > 0) { yr = project(mnx[i], mny[i]); if (yr >= 0) add_dr(yr, psx, 2, i); }
    for (i = 0; i < NSH; i++) if (shl[i] > 0) { yr = project(shx[i] >> 4, shy[i] >> 4); if (yr >= 0) add_dr(yr, psx, 3, i); }
    for (k = ndr; k > 0; k--) {
        DR *d = &drs[k - 1];
        yr = d->key; sx = d->sx; i = d->idx;
        if (d->kind == 0) {
            if (i == 0) {
                s16 rel = (s16)(H[0] - CH); s16 ra;
                f = 0; fl = 0;
                if (SPIN[0] > 0) { f = (u16)((tick >> 1) & 3); if (f == 0) { f = 1; } else if (f == 1) { f = 3; fl = 1; } else if (f == 2) { f = 4; } else { f = 3; } }
                else {
                    if (pad & KEY_LEFT) { f = 5; fl = 1; }
                    if (pad & KEY_RIGHT) { f = 5; fl = 0; }
                    ra = rel >> 8; if (ra > 6 && ra < 100) { f = 5; fl = 0; } if (ra < -6 && ra > -100) { f = 5; fl = 1; }
                }
                tile = (f >> 2) * 64 + (f & 3) * 4;
                spr32(128 - 16, 192 - 26, tile, 0, fl);
                if (BOOST[0] > 0) { if (tick & 1) spr8(124, 197, 14 * 16 + 5, 6); }
            } else {
                s16 rel = (s16)(H[i] - CH);
                if (yr >= 140) { f = frame_for(rel, &fl); tile = (f >> 2) * 64 + (f & 3) * 4; spr32(sx - 16, yr - 26, tile, i, fl); }
                else if (yr >= 96) { f = frame_for(rel, &fl); f += 6; tile = (f >> 2) * 64 + (f & 3) * 4; spr32(sx - 16, yr - 26, tile, i, fl); }
                else if (yr >= 68) spr8(sx - 4, yr - 8, 14 * 16 + 4, i);
            }
        } else {
            if (d->kind == 1) it = 0; else if (d->kind == 2) { it = 3; if (mnty[i] == 1) it = 5; } else it = 2;
            if (yr >= 150) { u16 b = 12 * 16 + it * 2; spr8(sx - 8, yr - 16, b, 6); spr8(sx, yr - 16, b + 1, 6); spr8(sx - 8, yr - 8, b + 16, 6); spr8(sx, yr - 8, b + 17, 6); }
            else if (yr >= 68) spr8(sx - 4, yr - 8, 14 * 16 + (it < 4 ? it : it + 4), 6);
        }
    }
}
static u8 tmf, tms, tmm, hud_held, hud_lap, hud_pos;
static const u8 CSD1[30] = { 0,0,0,1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,9,9,9 };
static const u8 CSD2[30] = { 0,3,6,0,3,6,0,3,6,0,3,6,0,3,6,0,3,6,0,3,6,0,3,6,0,3,6,0,3,6 };
static void hud_icon(u16 it) {
    u16 b = 12 * 16 + it * 2, i; s16 y = 4; if (it == 255) y = 240;
    hs_set(19, 120, y, b, 6); hs_set(20, 128, y, b + 1, 6); hs_set(21, 120, y + 8, b + 16, 6); hs_set(22, 128, y + 8, b + 17, 6);
    if (y == 240) for (i = 19; i < 23; i++) oamMemory[((HS + i) << 2) + 1] = 240;
}
static void hud_init(void) {
    u16 i; hs_hide();
    for (i = 24; i < 32; i++) oamMemory[512 + i] = 0;                 /* hi table bytes of slots 96..127 */
    hs_text(0, 6, 6, "LAP"); hs_text(4, 42, 6, "/"); hs_set(5, 50, 6, FONT0 + '0' + cfg_laps, 7);
    hs_text(6, 190, 6, "POS"); hs_text(10, 226, 6, "/"); hs_set(11, 234, 6, FONT0 + '0' + racers, 7);
    hs_set(12, 6, 16, FONT0 + '0', 7); hs_set(13, 14, 16, FONT0 + ':', 7); hs_set(14, 22, 16, FONT0 + '0', 7); hs_set(15, 30, 16, FONT0 + '0', 7);
    hs_set(16, 38, 16, FONT0 + '.', 7); hs_set(17, 46, 16, FONT0 + '0', 7); hs_set(18, 54, 16, FONT0 + '0', 7);
    hs_set(3, 34, 6, FONT0 + '1', 7); hs_set(10 - 0, 226, 6, FONT0 + '/', 7);
    hs_set(9, 218, 6, FONT0 + '1', 7);
    tmf = 0; tms = 0; tmm = 0; hud_held = 77; hud_lap = 0; hud_pos = 0;
}
static const u8 TSU[60] = { 0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9 };
static void hud_time_tick(void) {
    tmf++; if (tmf >= 30) { tmf = 0; tms++; if (tms >= 60) { tms = 0; tmm++; } }
    if (tmm > 9) tmm = 9;
    oamMemory[((HS + 12) << 2) + 2] = FONT0 + '0' + tmm;
    oamMemory[((HS + 14) << 2) + 2] = FONT0 + '0' + (tms >= 50 ? 5 : tms >= 40 ? 4 : tms >= 30 ? 3 : tms >= 20 ? 2 : tms >= 10 ? 1 : 0);
    oamMemory[((HS + 15) << 2) + 2] = FONT0 + '0' + TSU[tms];
    oamMemory[((HS + 17) << 2) + 2] = FONT0 + '0' + CSD1[tmf];
    oamMemory[((HS + 18) << 2) + 2] = FONT0 + '0' + CSD2[tmf];
}
static void hud_update(void) {
    u16 lap = WPC[0] / 64 + 1, rk = RK[0];
    if (lap > cfg_laps) lap = cfg_laps;
    if (lap != hud_lap) { hud_lap = lap; oamMemory[((HS + 3) << 2) + 2] = FONT0 + '0' + lap; }
    if (rk != hud_pos) { hud_pos = rk; oamMemory[((HS + 9) << 2) + 2] = FONT0 + '0' + rk; }
    if (HELD[0] != hud_held) { hud_held = HELD[0]; if (hud_held > 0) hud_icon(hud_held); else hud_icon(255); }
    if (hud_held == 0) { if (tick & 8) hud_icon(0); else hud_icon(255); }
}
static void hud_hide_all(void) { hs_hide(); }

/* ------------------------------------------------------------------ screens */
static void load_logo(void) {
    setBrightness(0);
    REG_BGMODE = 1;
    dmaCopyVram((u8 *)&nr_logo_tiles, 0x0000, plo((rp)&nr_logo_tiles_end) - plo((rp)&nr_logo_tiles));
    dmaCopyVram((u8 *)&nr_logo_map, 0x5400, 32 * 32 * 2);
    dmaCopyCGram((u8 *)&nr_logo_pal, 0, 32);
    bgSetGfxPtr(0, 0x0000); bgSetMapPtr(0, 0x5400, SC_32x32);
    bgSetScroll(0, 0, 0);
    bgSetEnable(0); bgSetDisable(1); bgSetDisable(2);
    setScreenOn();
}
static void splash(void) {
    u16 i;
    load_logo();
    fade(0, 15);
    for (i = 0; i < 100; i++) WaitForVBlank();
    fade(15, 0);
}
static void load_world(void) {
    setBrightness(0);
    setMode7(0);
    bgInitMapTileSet7((u8 *)&gnd_tiles, (u8 *)&gnd_map, (u8 *)&gnd_pal, plo((rp)&gnd_tiles_end) - plo((rp)&gnd_tiles), 0x0000);
    dmaCopyVram((u8 *)&spr_tiles, 0x4000, plo((rp)&spr_tiles_end) - plo((rp)&spr_tiles));
    oamInit(); oamInitGfxAttr(0x4000, OBJ_SIZE8_L32);
    oidprev = 128;
    hdma_static();
}
static void clear_race(void) {
    u16 i;
    for (i = 0; i < NSH; i++) shl[i] = 0;
    for (i = 0; i < NMN; i++) { mnl[i] = 0; mnty[i] = 0; }
    racers = cfg_rivals + 1; tick = 0; racet = 0; nfin = 0;
    place_grid(); place_crates(); calc_ranks();
    CH = H[0]; camx = (s16)((u16)X[0] >> 4); camy = (s16)((u16)Y[0] >> 4);
}
static void title_screen(void) {
    u16 t = 0, a;
    clear_race(); omax = 128; oidprev = 128;
    while (1) {
        oam_begin();
        a = (t >> 2) & 63; camx = WX[a]; camy = WY[a];
        CH = (u16)((WX[(a + 1) & 63] - WX[a]) * 0 + 0); CH = (u16)(START_ANGLE << 8) + (u16)(t * 150);
        text((256 - (u16)strlen(title) * 8) / 2, 40, title, 2);
        text(60, 60, "MODE 7 KART RACE", 7);
        text(48, 150, "B GAS   Y BRAKE   A ITEM", 7);
        if (t & 16) text(84, 180, "PRESS START", 2);
        oam_end();
        frame_end(); t++; rs += t;
        if (t == 2) fade(0, 15);
        if (padh & KEY_START) break;
    }
}
static void countdown(void) {
    u16 t;
    clear_race(); omax = 96; oidprev = 96; hud_init();
    for (t = 0; t < 100; t++) {
        oam_begin();
        draw_world();
        if (t < 30) text(124, 80, "3", 2); else if (t < 60) text(124, 80, "2", 2); else if (t < 90) text(124, 80, "1", 2); else text(112, 80, "GO!", 2);
        hud_update();
        oam_end();
        frame_end();
        if (t == 1) fade(0, 15);
    }
}
static void results(void) {
    u16 t = 0, i, j, o[NK], r, k; s16 y;
    omax = 128; oidprev = 128;
    calc_ranks();
    for (i = 0; i < nfin; i++) o[i] = finorder[i];
    j = nfin;
    for (r = 1; r <= racers; r++) for (k = 0; k < racers; k++) if (!FIN[k]) { if (RK[k] == r) { if (j < racers) o[j++] = k; } }
    while (1) {
        oam_begin(); y = 40;
        text(88, 20, "RESULTS", 2);
        for (i = 0; i < racers; i++) {
            k = o[i];
            text(40, y, num(i + 1), 7); text(56, y, NAMES[k], 7);
            if (FIN[k]) text(120, y, timestr(FTIME[k]), 7); else text(120, y, "DNF", 3);
            spr8(24, y, 14 * 16 + 4, k);
            y += 16;
        }
        if (t & 16) text(84, 190, "PRESS START", 2);
        oam_end();
        frame_end(); t++;
        if (t == 2) fade(0, 15);
        if (padh & KEY_START) { if (t > 30) break; }
    }
}

volatile u16 prof_a, prof_b, prof_c, prof_d;
#ifdef PROFILE
static void profile(void) {
    u16 i;
    clear_race(); for (i = 0; i < 12; i++) race_step(KEY_B, 0);
    prof_a = 1; for (i = 0; i < 100; i++) race_step(KEY_B, 0);
    prof_b = 1; for (i = 0; i < 100; i++) { oam_begin(); draw_world(); oam_end(); }
    prof_c = 1; for (i = 0; i < 100; i++) { oam_begin(); hud_update(); oam_end(); }
    prof_d = 1; for (i = 0; i < 100; i++) calc_ranks();
    prof_d = 2; for (i = 0; i < 100; i++) pickups(i % 6);
    prof_d = 3; for (i = 0; i < 100; i++) { collide(); update_projectiles(); }
    prof_d = 4; for (i = 0; i < 100; i++) ai_step(1 + (i % 5));
    prof_d = 5; while (1) { }
}
#endif
int main(void) {
    u16 paused;
    read_cfg();
    consoleInit();
    surf = (rp)&surf_map; cache_wps();
    splash();
    load_world();
    setScreenOn();
#ifdef PROFILE
    profile();
#endif
    while (1) {
        title_screen();
        fade(15, 0);
        countdown();
        while (1) {
            frame_end();
            if (padh & KEY_START) {
                paused = 1;
                while (paused) { oam_begin(); draw_world(); text(104, 90, "PAUSED", 2); oam_end(); frame_end(); if (padh & KEY_START) paused = 0; }
            }
#ifndef NOSTEP
            race_step(pad, padh);
#else
            tick++;
#endif
            oam_begin();
#ifndef NODRAW
            draw_world();
#endif
            hud_time_tick(); hud_update();
            if (FIN[0]) text(96, 90, "FINISH!", 2);
            oam_end();
            if (FIN[0]) { if (racet > FTIME[0] + 120) break; }
            if (nfin >= racers) break;
        }
        fade(15, 0);
        results();
        fade(15, 0);
    }
    return 0;
}
