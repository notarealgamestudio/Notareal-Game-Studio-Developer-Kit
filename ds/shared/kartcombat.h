// NOTAREAL vehicle combat core (Twisted Metal / Vigilante 8 / Mario Kart shape): a lap race where everyone is armed. Pure integer maths, no hardware calls.
// Mirrors kit/nrarcade.js A.combat. The host engine defines, before including this file:
//   KC_W, KC_H (screen size), KC_RGB(r,g,b) (0-255 channels -> pixel), KC_RECT(x,y,w,h,c), KC_TEXT(x,y,str,c) (8x8 font), KC_SFX(kind) (0 gun,1 missile,2 mine drop,3 boom,4 pickup,5 hurt)
// and calls kc_init(cfg,seed), kc_step(keys) once per 1/60 s, kc_draw(). Positions are Q8 (256 = one road segment / the road half-width = 256).
#pragma once
#include <stdint.h>
#include <string.h>
#define KC_UP 1
#define KC_DOWN 2
#define KC_LEFT 4
#define KC_RIGHT 8
#define KC_GUN 16
#define KC_MSL 32
#define KC_MINE 64
typedef struct { int16_t laps, rivals, hp, rivalHp, missiles, mines, gunDamage, missileDamage, mineDamage, maxSpeed, curves, timeLimit, difficulty10; uint16_t color, color2; } KcCfg;   // difficulty10: 10 = normal
#define KC_TOTAL 600
#define KC_NR 16
typedef struct { int z, x, v, hp, top, fireT, mineT, dead, lane, flash; } KcRival;
typedef struct { int z, x, own, life; } KcShot;
typedef struct { int z, x, own, tg, v, life; } KcMsl;
typedef struct { int z, x, own, age, gone; } KcMine;
typedef struct { int z, x, kind, got; } KcCrate;
typedef struct { int z, x, t; } KcFx;
static KcCfg kcC;
static struct { int status, score, t, z, x, v, hp, heat, jam, missiles, mines, lap, time, place, wrecked, crash, msgT, last, gunHits, missileHits, mineHits, picked, hitsTaken; const char *msg;
    KcRival rv[KC_NR]; KcShot sh[48]; KcMsl ms[24]; KcMine mn[24]; KcCrate cr[28]; KcFx fx[12]; } kc;
static int16_t kc_curve[KC_TOTAL]; static uint32_t kc_rs = 1;
static int kc_rnd(int n) { kc_rs = kc_rs * 1664525u + 1013904223u; return (int)((kc_rs >> 8) % (uint32_t)(n > 0 ? n : 1)); }
static int kc_abs(int v) { return v < 0 ? -v : v; }
static int kc_clamp(int v, int a, int b) { return v < a ? a : v > b ? b : v; }
static int kc_sin(int a)   // a in 0..1023 for a full turn; returns -256..256 (Bhaskara)
{   a &= 1023; int neg = a >= 512; if (neg) a -= 512; int u = a * (512 - a); int s = (int)((int64_t)256 * 16 * u / (5 * 512 * 512 - 4 * u)) ; return neg ? -s : s; }
static void kc_say(const char *m, int t) { kc.msg = m; kc.msgT = t; }
static void kc_boom(int z, int x, int t) { for (int i = 0; i < 12; i++) if (kc.fx[i].t <= 0) { kc.fx[i].z = z; kc.fx[i].x = x; kc.fx[i].t = t; return; } }
static void kc_init(const KcCfg *c, uint32_t seed)
{   kcC = *c; if (kcC.laps < 1) kcC.laps = 2; if (kcC.rivals < 1) kcC.rivals = 1; if (kcC.rivals > KC_NR) kcC.rivals = KC_NR; if (kcC.maxSpeed < 40) kcC.maxSpeed = 150; if (kcC.hp < 10) kcC.hp = 100; if (kcC.rivalHp < 5) kcC.rivalHp = 30; if (kcC.curves < 1) kcC.curves = 2; if (kcC.timeLimit < 30) kcC.timeLimit = 150; if (kcC.difficulty10 < 3) kcC.difficulty10 = 10;
    kc_rs = seed ? seed : 1; memset(&kc, 0, sizeof kc);
    for (int i = 0; i < KC_TOTAL; i++) kc_curve[i] = (int16_t)(kc_sin(i * kcC.curves * 1024 / KC_TOTAL) * 16 / 10);
    kc.hp = kcC.hp; kc.missiles = kcC.missiles; kc.mines = kcC.mines; kc.lap = 1; kc.time = kcC.timeLimit; kc.place = kcC.rivals + 1;
    for (int i = 0; i < kcC.rivals; i++) { KcRival *e = &kc.rv[i]; e->z = (6 + i * 5) * 256; e->x = (i % 3 - 1) * 128; e->hp = kcC.rivalHp; e->top = kcC.maxSpeed * (82 + 5 * (i % 4)) / 100 * kcC.difficulty10 / 10; e->fireT = 90 + i * 20; e->mineT = 200 + i * 40; e->lane = e->x; }
    for (int i = 0; i < 28; i++) { kc.cr[i].z = (30 + i * (KC_TOTAL * kcC.laps / 28) + kc_rnd(10)) * 256; kc.cr[i].x = (kc_rnd(384) - 192) * 1; kc.cr[i].kind = i % 4; }
}
static void kc_dmg(KcRival *e, int n, int missile)
{   if (e->dead) return; e->hp -= n; e->flash = 8; if (e->hp <= 0) { e->dead = 120; kc.wrecked++; kc.score += 500 + (missile ? 200 : 0); kc_say("WRECKED!", 70); kc_boom(e->z, e->x, 20); KC_SFX(3); } }
static void kc_hurt(int n, int crash, int mine)
{   if (kc.crash > 0 && crash) return; kc.hp -= n; kc.hitsTaken++; kc.crash = crash ? 20 : 8; kc.v = mine ? kc.v / 2 : kc.v * 85 / 100; if (mine) kc_say("MINE!", 40); KC_SFX(5); }
static int kc_rank(void) { int r = 1; for (int i = 0; i < kcC.rivals; i++) if (!kc.rv[i].dead && kc.rv[i].z > kc.z) r++; return r; }
static void kc_step(unsigned k)
{   if (kc.status) return; int edge = k & ~kc.last; kc.last = (int)k; kc.t++; if (kc.t % 60 == 0) kc.time--; if (kc.msgT > 0) kc.msgT--; if (kc.crash > 0) kc.crash--;
    int cur = kc_curve[(kc.z >> 8) % KC_TOTAL], off = kc_abs(kc.x) > 269, mx = kcC.maxSpeed * (off ? 1 : 2) / (off ? 2 : 2) * (off ? 1 : 1); mx = off ? kcC.maxSpeed / 2 : kcC.maxSpeed;
    kc.v = kc_clamp(kc.v + ((k & KC_UP) ? 1 : (k & KC_DOWN) ? -2 : 0) * ((k & KC_DOWN) ? 1 : 1) , 0, mx);   // 1.2 / -2.4 / -.5 per frame: done below in tenths
    { static int fracs; fracs += (k & KC_UP) ? 2 : (k & KC_DOWN) ? -4 : -5; /* extra tenths */ if (fracs >= 10) { kc.v = kc_clamp(kc.v + fracs / 10, 0, mx); fracs %= 10; } else if (fracs <= -10) { kc.v = kc_clamp(kc.v + fracs / 10, 0, mx); fracs %= 10; } }
    int ax = ((k & KC_RIGHT) ? 1 : 0) - ((k & KC_LEFT) ? 1 : 0), vr = kc.v * 256 / kcC.maxSpeed;
    kc.x = kc_clamp(kc.x + ax * ((vr + 77) * 31 >> 10) - (cur * vr >> 8) * 3 / 250, -461, 461); kc.z += (kc.v * 273) >> 8; kc.score += kc.v / 60;
    kc.heat -= kc.jam ? 1 : 1; if (kc.heat < 0) kc.heat = 0; if (kc.jam > 0 && --kc.jam == 0) kc.heat = 0;
    if ((k & KC_GUN) && kc.jam == 0 && kc.t % 5 == 0) { for (int i = 0; i < 48; i++) if (kc.sh[i].life <= 0) { kc.sh[i] = (KcShot){ kc.z + 51, kc.x, 1, 28 }; break; } kc.heat += 7; KC_SFX(0); if (kc.heat >= 100) { kc.jam = 90; kc_say("OVERHEAT", 60); } }
    if ((edge & KC_MSL) && kc.missiles > 0) { int tg = -1, bd = 40 * 256; for (int i = 0; i < kcC.rivals; i++) { int d = kc.rv[i].z - kc.z; if (!kc.rv[i].dead && d > 256 && d < bd && kc_abs(kc.rv[i].x - kc.x) < 230) { tg = i; bd = d; } } kc.missiles--; for (int i = 0; i < 24; i++) if (kc.ms[i].life <= 0) { kc.ms[i] = (KcMsl){ kc.z + 102, kc.x, 1, tg, (kc.v * 273 >> 8) + 141, 120 }; break; } KC_SFX(1); }
    if ((edge & KC_MINE) && kc.mines > 0) { kc.mines--; for (int i = 0; i < 24; i++) if (kc.mn[i].gone || (!kc.mn[i].z && !kc.mn[i].own)) { kc.mn[i] = (KcMine){ kc.z - 154, kc.x, 1, 0, 0 }; if (!kc.mn[i].z) kc.mn[i].z = 1; break; } KC_SFX(2); }
    for (int i = 0; i < 48; i++) { KcShot *b = &kc.sh[i]; if (b->life <= 0) continue; b->life--; b->z += b->own ? 128 : -102;
        if (b->own) { for (int j = 0; j < kcC.rivals; j++) { KcRival *e = &kc.rv[j]; if (!e->dead && b->life > 0 && kc_abs(e->z - b->z) < 141 && kc_abs(e->x - b->x) < 67) { kc_dmg(e, kcC.gunDamage, 0); b->life = 0; kc.gunHits++; kc.score += 20; } } }
        else if (b->life > 0 && kc_abs(b->z - kc.z) < 128 && kc_abs(b->x - kc.x) < 67) { kc_hurt(kcC.gunDamage * 4 / 5, 0, 0); b->life = 0; } }
    for (int i = 0; i < 24; i++) { KcMsl *m = &kc.ms[i]; if (m->life <= 0) continue; m->life--;
        if (m->own) { m->z += m->v; if (m->tg >= 0 && !kc.rv[m->tg].dead) m->x += kc_clamp(kc.rv[m->tg].x - m->x, -10, 10);
            for (int j = 0; j < kcC.rivals; j++) { KcRival *e = &kc.rv[j]; if (!e->dead && m->life > 0 && kc_abs(e->z - m->z) < 154 && kc_abs(e->x - m->x) < 77) { kc_dmg(e, kcC.missileDamage, 1); m->life = 0; kc.missileHits++; kc.score += 100; kc_boom(m->z, m->x, 14); } } }
        else { m->z -= m->v; m->x += kc_clamp(kc.x - m->x, -6, 6); if (kc_abs(m->z - kc.z) < 154 && kc_abs(m->x - kc.x) < 77) { kc_hurt(kcC.missileDamage, 0, 0); m->life = 0; kc_boom(m->z, m->x, 14); } } }
    for (int i = 0; i < 24; i++) { KcMine *m = &kc.mn[i]; if (m->gone || !m->z) continue; m->age++;
        for (int j = 0; j < kcC.rivals; j++) { KcRival *e = &kc.rv[j]; if (!e->dead && kc_abs(e->z - m->z) < 128 && kc_abs(e->x - m->x) < 77 && (!m->own || m->age > 30)) { kc_dmg(e, kcC.mineDamage, 0); m->gone = 1; if (m->own) kc.mineHits++; kc.score += 80; kc_boom(m->z, m->x, 14); break; } }
        if (!m->gone && !m->own && m->age > 20 && kc_abs(kc.z - m->z) < 128 && kc_abs(kc.x - m->x) < 77) { kc_hurt(kcC.mineDamage, 0, 1); m->gone = 1; kc_boom(m->z, m->x, 14); } }
    for (int i = 0; i < 28; i++) { KcCrate *c = &kc.cr[i]; if (!c->got && kc_abs(c->z - kc.z) < 128 && kc_abs(c->x - kc.x) < 77) { c->got = 1; kc.picked++; kc.score += 50; KC_SFX(4);
        if (c->kind == 0) { kc.missiles = kc.missiles + 2 > 9 ? 9 : kc.missiles + 2; kc_say("MISSILES +2", 60); } else if (c->kind == 1) { kc.mines = kc.mines + 2 > 6 ? 6 : kc.mines + 2; kc_say("MINES +2", 60); }
        else if (c->kind == 2) { kc.hp = kc.hp + 30 > kcC.hp ? kcC.hp : kc.hp + 30; kc_say("REPAIR +30", 60); } else { kc.v = kc.v + 25 > kcC.maxSpeed * 12 / 10 ? kcC.maxSpeed * 12 / 10 : kc.v + 25; kc_say("NITRO", 60); } } }
    for (int i = 0; i < kcC.rivals; i++) { KcRival *e = &kc.rv[i]; if (e->flash > 0) e->flash--; if (e->dead > 0) { if (--e->dead == 0) e->dead = -1; continue; } if (e->dead < 0) continue;
        int gap = kc.z - e->z, rub = gap > 8 * 256 ? 112 : gap < -10 * 256 ? 90 : 100; e->v = kc_clamp(e->v + ((e->top * rub / 100) - e->v) / 20, 0, kcC.maxSpeed * 11 / 10); e->z += (e->v * 273 >> 8) * (kc_abs(e->x) > 269 ? 85 : 100) / 100;
        int ahead = -gap; if (ahead > 0 && ahead < 8 * 256 && kc_abs(e->x - kc.x) < 77) e->lane = e->x + (e->x > kc.x ? 115 : -115);
        e->x += kc_clamp(e->lane - e->x, -4, 4); if (kc_rnd(250) == 0) e->lane = (kc_rnd(384) - 192); e->lane = kc_clamp(e->lane, -230, 230);
        if (kc_abs(e->z - kc.z) < 128 && kc_abs(e->x - kc.x) < 77) { kc_hurt(6, 1, 0); e->v = e->v * 7 / 10; kc_dmg(e, 4, 0); }
        if (--e->fireT <= 0) { int behind = gap > 0 && gap < 22 * 256 && kc_abs(e->x - kc.x) < 128; if (behind) { if (kc_rnd(100) < 35) { for (int q = 0; q < 24; q++) if (kc.ms[q].life <= 0) { kc.ms[q] = (KcMsl){ e->z, e->x, 0, -1, 102, 90 }; break; } } else for (int q = 0; q < 48; q++) if (kc.sh[q].life <= 0) { kc.sh[q] = (KcShot){ e->z + 77, e->x, 0, 22 }; break; } }
            int base = 90 - 25 * kcC.difficulty10 / 10; e->fireT = (base < 25 ? 25 : base) + kc_rnd(70); }
        if (--e->mineT <= 0) { if (ahead > 0) for (int q = 0; q < 24; q++) if (kc.mn[q].gone || !kc.mn[q].z) { kc.mn[q] = (KcMine){ e->z - 154, e->x, 0, 0, 0 }; if (!kc.mn[q].z) kc.mn[q].z = 1; break; } e->mineT = 260 + kc_rnd(200); } }
    for (int i = 0; i < 12; i++) if (kc.fx[i].t > 0) kc.fx[i].t--;
    kc.place = kc_rank();
    if (kc.hp <= 0) { kc.status = 2; kc_say("WRECKED", 90); }
    if (kc.status == 0 && kc.z >= kc.lap * KC_TOTAL * 256) { kc.lap++; kc.time += 25; kc.score += 300; if (kc.lap > kcC.laps) { kc.status = kc.place <= 3 ? 1 : 2; if (kc.status == 1) kc.score += 1000 * (4 - kc.place) + kc.time * 10; } }
    { int all = 1; for (int i = 0; i < kcC.rivals; i++) if (!kc.rv[i].dead) all = 0; if (all && kc.status == 0) { kc.status = 1; kc.score += 3000; } }
    if (kc.time <= 0 && kc.status == 0) kc.status = 2;
}
static const char *kc_num(int v) { static char bb[4][12]; static int w; char *b = bb[w++ & 3]; int i = 11; b[11] = 0; if (v <= 0) { b[10] = '0'; return b + 10; } while (v > 0 && i > 0) { b[--i] = '0' + v % 10; v /= 10; } return b + i; }
static void kc_cat(char *d, const char *a, const char *b2, const char *c3, const char *d4) { d[0] = 0; const char *p[4] = { a, b2, c3, d4 }; int n = 0; for (int i = 0; i < 4; i++) if (p[i]) for (const char *s = p[i]; *s && n < 38; s++) d[n++] = *s; d[n] = 0; }
#define SX(v) ((v) * KC_W / 320)
#define SY(v) ((v) * KC_H / 240)
#define AT(zz, xx, ...) { int n_ = ((zz) - kc.z + 128) >> 8; if (n_ >= 1 && n_ < 70) { int sc = psc[n_], px = px_[n_] + (((xx) * pw_[n_]) >> 8), py = py_[n_]; (void)sc; (void)px; (void)py; __VA_ARGS__ } }
static int px_[72], py_[72], pw_[72], psc[72];
static void kc_draw(void)
{   int W = KC_W, H = KC_H, hz = H / 2; KC_RECT(0, 0, W, hz, KC_RGB(88, 184, 255)); KC_RECT(0, hz, W, H - hz, KC_RGB(42, 138, 42));
    int base = kc.z >> 8, x = 0, dx = 0, ybot = H;
    for (int n = 1; n < 70; n++) { int i = (base + n) % KC_TOTAL, sc = 65536 / (n * 31 + 51), yy = hz + (hz * sc >> 8) * 141 / 256, w = SX(150) * sc >> 8; dx += kc_curve[i] * 35 / 100; x += dx;
        int cx = W / 2 + (x * sc >> 8) * 8 / 256 - (kc.x * w >> 8) * 9 / 10; px_[n] = cx; py_[n] = yy; pw_[n] = w; psc[n] = sc; }
    for (int n = 69; n >= 1; n--) { int yy = py_[n], y0 = n < 69 ? py_[n + 1] : hz; if (yy <= y0) continue; if (yy > ybot) yy = ybot; int i = (base + n) % KC_TOTAL, cx = px_[n], w = pw_[n];
        KC_RECT(0, y0, W, yy - y0, (i % 6 < 3) ? KC_RGB(58, 138, 58) : KC_RGB(47, 122, 47)); KC_RECT(cx - w - w / 8, y0, w * 2 + w / 4, yy - y0, (i % 6 < 3) ? KC_RGB(220, 40, 40) : KC_RGB(235, 235, 235));
        KC_RECT(cx - w, y0, w * 2, yy - y0, (i % 12 < 6) ? KC_RGB(96, 96, 104) : KC_RGB(88, 88, 96)); if (i % 8 < 4) KC_RECT(cx - w / 40 - 1, y0, w / 20 + 2, yy - y0, KC_RGB(230, 230, 200)); }
    for (int i = 0; i < 28; i++) if (!kc.cr[i].got) AT(kc.cr[i].z, kc.cr[i].x, { int s = SX(18) * sc >> 8; if (s < 2) s = 2; static const uint16_t cc[4] = { 0, 0, 0, 0 }; (void)cc; KC_RECT(px - s / 2, py - s, s, s, i % 4 == 0 ? KC_RGB(255, 138, 42) : (i % 4 == 1 ? KC_RGB(138, 74, 255) : (i % 4 == 2 ? KC_RGB(74, 232, 122) : KC_RGB(74, 184, 255)))); })
    for (int i = 0; i < 24; i++) if (!kc.mn[i].gone && kc.mn[i].z > 1) AT(kc.mn[i].z, kc.mn[i].x, { int s = SX(18) * sc >> 8; if (s < 2) s = 2; KC_RECT(px - s / 2, py - s / 3, s, s / 3 + 1, KC_RGB(34, 34, 34)); KC_RECT(px - 1, py - s / 2, 2, s / 4 + 1, KC_RGB(255, 51, 51)); })
    for (int pass = 69; pass >= 1; pass--) for (int i = 0; i < kcC.rivals; i++) { KcRival *e = &kc.rv[i]; if (e->dead < 0 || ((e->z - kc.z + 128) >> 8) != pass) continue;
        AT(e->z, e->x, { int w = SX(30) * sc >> 8, h = SX(21) * sc >> 8; if (w < 3) { w = 3; h = 2; } KC_RECT(px - w / 2, py - h, w, h, e->dead > 0 ? KC_RGB(85, 85, 85) : (e->flash & 1) ? KC_RGB(255, 255, 255) : kcC.color2); if (!e->dead) { KC_RECT(px - w / 2, py - h - 3, w, 2, KC_RGB(51, 0, 0)); KC_RECT(px - w / 2, py - h - 3, w * e->hp / kcC.rivalHp > w ? w : (e->hp > 0 ? w * e->hp / kcC.rivalHp : 0), 2, KC_RGB(80, 230, 80)); } }) }
    for (int i = 0; i < 48; i++) if (kc.sh[i].life > 0) AT(kc.sh[i].z, kc.sh[i].x, { int s = 3 * sc >> 8; KC_RECT(px - 1, py - 8 * sc / 256 - s, 2, s + 2, kc.sh[i].own ? KC_RGB(255, 255, 0) : KC_RGB(255, 136, 68)); })
    for (int i = 0; i < 24; i++) if (kc.ms[i].life > 0) AT(kc.ms[i].z, kc.ms[i].x, { int s = 6 * sc >> 8; KC_RECT(px - s / 2 - 1, py - 8 * sc / 256 - s, s + 2, s + 2, kc.ms[i].own ? KC_RGB(255, 255, 255) : KC_RGB(255, 85, 85)); })
    for (int i = 0; i < 12; i++) if (kc.fx[i].t > 0) AT(kc.fx[i].z, kc.fx[i].x, { int r = (20 - kc.fx[i].t) * sc / 256 + 3; KC_RECT(px - r, py - 8 * sc / 256 - r, r * 2, r * 2, kc.fx[i].t % 4 < 2 ? KC_RGB(255, 221, 68) : KC_RGB(255, 102, 51)); })
    { int cw = SX(28), ch = SY(18), cxp = W / 2 - cw / 2 + (kc.crash % 4 < 2 ? 0 : 3), cyp = H - SY(34); KC_RECT(cxp, cyp, cw, ch, kcC.color); KC_RECT(cxp - 2, cyp + ch - 4, 6, 6, KC_RGB(17, 17, 17)); KC_RECT(cxp + cw - 4, cyp + ch - 4, 6, 6, KC_RGB(17, 17, 17)); if (kc.heat > 0) KC_RECT(W / 2 - 2, cyp - 6, 4, 6, KC_RGB(255, 255, 0)); }
    KC_RECT(0, 0, W, 24, KC_RGB(0, 0, 0)); char b[40];
    KC_TEXT(2, 2, "HP", KC_RGB(255, 255, 255)); KC_RECT(20, 3, 60, 6, KC_RGB(68, 0, 0)); KC_RECT(20, 3, kc.hp > 0 ? 60 * kc.hp / kcC.hp : 0, 6, kc.hp > kcC.hp * 3 / 10 ? KC_RGB(68, 255, 68) : KC_RGB(255, 68, 68));
    KC_RECT(20, 13, 60, 4, KC_RGB(68, 68, 34)); KC_RECT(20, 13, kc.heat > 100 ? 60 : 60 * kc.heat / 100, 4, kc.jam ? KC_RGB(255, 60, 60) : KC_RGB(255, 255, 0));
    kc_cat(b, "M", kc_num(kc.missiles), " X", kc_num(kc.mines)); KC_TEXT(88, 2, b, KC_RGB(255, 255, 255)); kc_cat(b, "POS ", kc_num(kc.place), "/", kc_num(kcC.rivals + 1)); KC_TEXT(88, 12, b, KC_RGB(255, 255, 255));
    kc_cat(b, "LAP ", kc_num(kc.lap > kcC.laps ? kcC.laps : kc.lap), "/", kc_num(kcC.laps)); KC_TEXT(W - 92, 2, b, KC_RGB(255, 255, 255)); kc_cat(b, "TIME ", kc_num(kc.time), 0, 0); KC_TEXT(W - 92, 12, b, KC_RGB(255, 255, 255));
    if (kc.msgT > 0 && kc.msg) KC_TEXT((W - (int)strlen(kc.msg) * 8) / 2, H / 4, kc.msg, KC_RGB(255, 255, 255));
    if (kc.status) { KC_RECT(0, H / 2 - 24, W, 48, KC_RGB(0, 0, 0)); const char *e = kc.status == 1 ? "YOU WIN!" : "GAME OVER"; KC_TEXT((W - (int)strlen(e) * 8) / 2, H / 2 - 12, e, kc.status == 1 ? KC_RGB(74, 232, 122) : KC_RGB(255, 90, 90)); kc_cat(b, "SCORE ", kc_num(kc.score), 0, 0); KC_TEXT((W - (int)strlen(b) * 8) / 2, H / 2 + 2, b, KC_RGB(255, 255, 255)); }
}
