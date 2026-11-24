/* NOTAREAL DS engine - WORLD MODE (included by main.c).
   Plays World projects made in the studio's World builder: maps of any size (top-down or side view), two tile layers,
   people, enemies, items, doors, signs, chests, shops, save points, triggers and spawners, and rule byte-code
   (WRLD / WTXT sections written by NRWorld.compileDS). Same rules as the studio's in-app player (kit/nrworld.js).
   Top screen: the world. Bottom screen: HUD, dialog, questions, shop and bag. */
enum { T_START, T_NPC, T_ENEMY, T_ITEM, T_DOOR, T_SIGN, T_CHEST, T_SHOP, T_SAVE, T_TRIGGER, T_SPAWNER, T_PROP, T_BULLET };
enum { OP_END, OP_SAY, OP_CHOICE, OP_GIVE, OP_TAKE, OP_MONEY, OP_HEAL, OP_HURT, OP_FLAG, OP_ADDFLAG, OP_IF, OP_WARP, OP_MUSIC, OP_SOUND, OP_TILE, OP_REMOVE, OP_SPAWN, OP_SHOP, OP_WAIT, OP_WIN, OP_LOSE, OP_JMP };
enum { TR_TALK = 1, TR_TOUCH, TR_ENTER, TR_DEFEAT, TR_LOAD };
static const u8 *WR, *WT; static int w_nmaps, w_nitems;
static const char *wstr(int i) { if (!WT || i == 0xFFFF || i >= rd16(WT)) return ""; return (const char *)WT + rd32(WT + 4 + i * 4); }
static const u8 *witem(int i) { return WR + 12 + w_nmaps * 4 + i * 8; }
/* current map */
static const u8 *MP; static int mw, mh, mview, mtoff, mid_i; static u8 g_ground[256 * 256], g_over[256 * 256];
typedef struct { const u8 *rec; const u8 *rules; u8 t, dead, sheet, dir; s32 x, y, vx, vy; int hp, timer, from, fired, inside, msg, touched; } Ent;
#define MAXE 120
static Ent E[MAXE]; static int ne;
/* game state */
static int w_hp, w_maxhp, w_money, w_inv[64], w_flags[64], w_attack, w_over, w_win; static s32 w_speed;
static u32 w_taken[1024]; static int n_taken;
static int taken(u32 k) { for (int i = 0; i < n_taken; i++) if (w_taken[i] == k) return 1; return 0; }
static void take_k(u32 k) { if (!taken(k) && n_taken < 1024) w_taken[n_taken++] = k; }
#define KEY_ENT(e) (((u32)mid_i << 16) | (u32)((e)->rec ? ((e)->rec - MP) : 0xFFFF))
static s32 wx, wy, wvx, wvy; static int wface = 2, wground, wcoy, wjbuf, winv, watk, wcamx, wcamy;
#define WHW 12
#define WHH 12
/* ------------------------------------------------------------ bottom screen */
static char ui_line[4][33]; static int ui_dirty = 1;
static int pn_on, pn_tab, pn_dirty = 1, pn_sel = -1, pn_page; static u32 pn_seen; static char pn_msg[32];
static void ui_hud(void) {
    printf("\x1b[0;0H");
    char h[40]; int i, n = 0;
    for (i = 0; i < w_maxhp && i < 16; i++) h[n++] = i < w_hp ? '*' : '.'; h[n] = 0;
    printf("HP %-16s  $%-6d\n", h, w_money);
    printf("%-32.32s", wstr(rd16(MP)));
    printf("\x1b[3;0H");
    if (pn_on) return;
    int shown = 0;
    for (i = 0; i < w_nitems && shown < 4; i++) if (w_inv[i] > 0) { printf("%.10s x%d  ", wstr(rd16(witem(i))), w_inv[i]); shown++; }
    printf("\x1b[K");
}
/* text box: wraps at 30 columns on rows 8-15 */
static void ui_box(const char *s, const char *opt0, const char *opt1, int sel) {
    printf("\x1b[6;0H--------------------------------");
    for (int r = 7; r < 23; r++) printf("\x1b[%d;0H\x1b[K", r);
    int row = 7, col = 0; char word[40]; int wl = 0;
    const char *p = s; const char *colon = strchr(s, ':');
    if (colon && colon - s < 16) { printf("\x1b[7;0H\x1b[33m%.*s\x1b[39m", (int)(colon - s), s); p = colon + 1; while (*p == ' ') p++; row = 9; }
    printf("\x1b[%d;1H", row); col = 1;
    for (;; p++) {
        if (*p && *p != ' ' && *p != '\n') { if (wl < 38) word[wl++] = *p; continue; }
        if (wl) { if (col + wl > 31) { row++; col = 1; printf("\x1b[%d;1H", row); } word[wl] = 0; printf("%s", word); col += wl; wl = 0; }
        if (!*p) break;
        if (*p == '\n') { row++; col = 1; printf("\x1b[%d;1H", row); } else if (col < 31) { printf(" "); col++; }
    }
    if (opt0) { printf("\x1b[19;4H%s %s", sel == 0 ? ">" : " ", opt0); printf("\x1b[20;4H%s %s", sel == 1 ? ">" : " ", opt1); }
    else printf("\x1b[22;28H(A)");
}
static void ui_clear_box(void) { for (int r = 6; r < 24; r++) printf("\x1b[%d;0H\x1b[K", r); pn_dirty = 1; }
/* ------------------------------------------------------------ map */
static int w_col(int x, int y) {
    if (x < 0 || y < 0) return COL_SOLID; int mx = x >> 4, my = y >> 4; if (mx >= mw || my >= mh) return COL_SOLID;
    int o = g_over[my * mw + mx]; if (o && o < nmtil && mcol[o] == COL_SOLID) return COL_SOLID;
    int g = g_ground[my * mw + mx]; return g < nmtil ? mcol[g] : 0;
}
static int ent_solid_at(int x, int y, int w, int h, Ent *self) {
    for (int i = 0; i < ne; i++) { Ent *e = &E[i]; if (e == self || e->dead) continue;
        int s = e->t == T_NPC || e->t == T_SHOP || e->t == T_SIGN || e->t == T_CHEST || e->t == T_SAVE || (e->t == T_PROP && e->rec[9]);
        if (!s) continue; int ex = e->x >> 8, ey = e->y >> 8; if (x < ex + 14 && ex + 2 < x + w && y < ey + 14 && ey + 2 < y + h) return 1; }
    return 0;
}
static int w_blocked(int x, int y, int w, int h, Ent *self) {
    if (w_col(x, y) == COL_SOLID || w_col(x + w - 1, y) == COL_SOLID || w_col(x, y + h - 1) == COL_SOLID || w_col(x + w - 1, y + h - 1) == COL_SOLID || w_col(x + w / 2, y + h - 1) == COL_SOLID) return 1;
    return ent_solid_at(x, y, w, h, self);
}
static u32 tagk[16][32];
static u16 *map2;
static void w_draw_tiles(void) {
    int c0 = wcamx >> 4, r0 = wcamy >> 4;
    for (int my = r0 - 1; my <= r0 + 13; my++) for (int mx = c0 - 1; mx <= c0 + 17; mx++) {
        int sx = mx & 31, sy = my & 15; u32 key = ((u32)(my & 0xFFFF) << 16) | (mx & 0xFFFF);
        if (tagk[sy][sx] == key) continue; tagk[sy][sx] = key;
        int g = (mx >= 0 && my >= 0 && mx < mw && my < mh) ? g_ground[my * mw + mx] : 0, o = (mx >= 0 && my >= 0 && mx < mw && my < mh) ? g_over[my * mw + mx] : 0;
        for (int k = 0; k < 4; k++) { int x = sx * 2 + (k & 1), y = sy * 2 + (k >> 1), at = (x >= 32 ? 1024 : 0) + y * 32 + (x & 31);
            map0[at] = g ? g * 4 + k : 0; map2[at] = o ? o * 4 + k : 0; }
    }
    bgSetScroll(bg0, wcamx & 511, wcamy & 255); bgSetScroll(2, wcamx & 511, wcamy & 255);
    if (mview) bgSetScroll(bg1, (wcamx / 2) & 511, 0);
}
/* ------------------------------------------------------------ scripts */
typedef struct { const u8 *code; int pc; Ent *e; } Run;
static Run RQ[16]; static int nrq;
enum { B_NONE, B_SAY, B_CHOICE, B_SHOP, B_BAG, B_WAIT };
static int busy, bsel, bwait; static const char *btext; static const u8 *bshop; static int bshopn; static Run *bchoice; static int bchoice_else;
static int cond3(int k, int a, int b) {

    if (k == 1) return a < 64 && w_inv[a] >= (b ? b : 1);
    if (k == 2) return w_flags[a & 63] >= b; if (k == 3) return !w_flags[a & 63]; if (k == 4) return w_money >= b; return 1;
}
static int cond_ok(const u8 *c) { return cond3(c[0], c[1], (s16)rd16(c + 2)); }
static void queue_code(const u8 *code, Ent *e) { if (nrq < 16) { RQ[nrq].code = code; RQ[nrq].pc = 0; RQ[nrq].e = e; nrq++; } }
static const u8 *rule_at(Ent *e, int idx, int *len) { const u8 *r = e->rules; for (int i = 0; i < idx; i++) { int cl = rd16(r + 6); r += 8 + cl + ((8 + cl) & 1); } *len = rd16(r + 6); return r; }
static void run_rules(Ent *e, int trig, int first_only) {
    int n = e->rec[25];
    for (int i = 0; i < n; i++) { int cl; const u8 *r = rule_at(e, i, &cl);
        if (r[0] != trig || !cond3(r[1], r[2], (s16)rd16(r + 4))) continue;
        u32 k = KEY_ENT(e) ^ (0x80000000u | (u32)i << 24); if (r[3] && taken(k)) continue; if (r[3]) take_k(k);
        queue_code(r + 8, e); if (first_only) return; }
}
static void w_load(int mi, int tx, int ty);
static void add_item(int it, int n, int pickup) {
    if (it >= w_nitems) return; const u8 *I = witem(it); int kind = I[2], val = I[3];
    if (kind == 3) w_money += n * (val ? val : 1);
    else if (kind == 2 && pickup && w_hp < w_maxhp) { w_hp += n * (val ? val : 1); if (w_hp > w_maxhp) w_hp = w_maxhp; }
    else w_inv[it] += n;
    ui_dirty = 1;
}
static void w_damage(int n) { if (winv) return; w_hp -= n; winv = 60; sfx(SFX_HURT); ui_dirty = 1; if (w_hp <= 0) { w_over = 1; w_win = 0; } }
static void spawn_enemy(int sheet, int hp, s32 x, s32 y, int from);
static int step_scripts(void) {     /* runs until something waits; returns 1 if busy */
    while (!busy && nrq) {
        Run *R = &RQ[0]; const u8 *c = R->code + R->pc; int op = c[0];
        if (op == OP_END) { for (int i = 1; i < nrq; i++) RQ[i - 1] = RQ[i]; nrq--; continue; }
        switch (op) {
        case OP_SAY: btext = wstr(rd16(c + 1)); busy = B_SAY; R->pc += 3; ui_box(btext, 0, 0, 0); break;
        case OP_CHOICE: btext = wstr(rd16(c + 1)); busy = B_CHOICE; bsel = 0; bchoice = R; bchoice_else = rd16(c + 3); R->pc += 5; ui_box(btext, "Yes", "No", 0); break;
        case OP_GIVE: add_item(c[1], c[2], 0); R->pc += 3; break;
        case OP_TAKE: if (c[1] < 64) { w_inv[c[1]] -= c[2]; if (w_inv[c[1]] < 0) w_inv[c[1]] = 0; } ui_dirty = 1; R->pc += 3; break;
        case OP_MONEY: w_money += (s16)rd16(c + 1); if (w_money < 0) w_money = 0; ui_dirty = 1; R->pc += 3; break;
        case OP_HEAL: w_hp += c[1]; if (w_hp > w_maxhp) w_hp = w_maxhp; ui_dirty = 1; R->pc += 2; break;
        case OP_HURT: w_damage(c[1]); R->pc += 2; break;
        case OP_FLAG: w_flags[c[1] & 63] = (s16)rd16(c + 2); R->pc += 4; break;
        case OP_ADDFLAG: w_flags[c[1] & 63] += (s16)rd16(c + 2); R->pc += 4; break;
        case OP_IF: if (cond_ok(c + 1)) R->pc += 7; else R->pc = rd16(c + 5); break;
        case OP_JMP: R->pc = rd16(c + 1); break;
        case OP_WARP: R->pc += 4; if (c[1] < w_nmaps) { w_load(c[1], c[2], c[3]); return busy; } break;
        case OP_MUSIC: play_song(c[1]); R->pc += 2; break;
        case OP_SOUND: sfx(c[1]); R->pc += 2; break;
        case OP_TILE: if (c[1] < mw && c[2] < mh) { g_ground[c[2] * mw + c[1]] = c[3] ? c[3] + mtoff : 0; memset(tagk, 0xFF, sizeof tagk); } R->pc += 4; break;
        case OP_REMOVE: if (R->e) { R->e->dead = 1; take_k(KEY_ENT(R->e)); } R->pc += 1; break;
        case OP_SPAWN: spawn_enemy(c[1], c[2], R->e ? R->e->x : wx, R->e ? R->e->y : wy, -1); R->pc += 3; break;
        case OP_SHOP: busy = B_SHOP; bshop = c + 2; bshopn = c[1]; bsel = 0; R->pc += 2 + c[1] * 3; break;
        case OP_WAIT: busy = B_WAIT; bwait = rd16(c + 1); R->pc += 3; break;
        case OP_WIN: case OP_LOSE: w_over = 1; w_win = op == OP_WIN; btext = wstr(rd16(c + 1)); R->pc += 3; ui_box(btext, 0, 0, 0); break;
        default: R->pc = 0; nrq = 0; break;
        }
    }
    return busy;
}
static void draw_shop(void) {
    ui_clear_box(); printf("\x1b[6;0H--------------------------------\x1b[7;1HSHOP          money $%d", w_money);
    for (int i = 0; i < bshopn; i++) { const u8 *s = bshop + i * 3; printf("\x1b[%d;2H%s %-14.14s $%d", 9 + i, bsel == i ? ">" : " ", wstr(rd16(witem(s[0]))), rd16(s + 1)); }
    printf("\x1b[%d;2H%s Leave", 9 + bshopn, bsel == bshopn ? ">" : " ");
}
static int bag_list[64], bag_n;
static void draw_bag(void) {
    ui_clear_box(); printf("\x1b[6;0H--------------------------------\x1b[7;1HBAG  (A use, B close)"); bag_n = 0;
    for (int i = 0; i < w_nitems; i++) if (w_inv[i] > 0 && bag_n < 12) { printf("\x1b[%d;2H%s %-16.16s x%d", 9 + bag_n, bsel == bag_n ? ">" : " ", wstr(rd16(witem(i))), w_inv[i]); bag_list[bag_n++] = i; }
    printf("\x1b[%d;2H%s Close", 9 + bag_n, bsel == bag_n ? ">" : " ");
}
/* ------------------------------------------------------------ bottom-screen panel (world.panel): MAP / WORLD / ITEMS / CHESTS tabs, touch or L/R */
static int pn_list[64], pn_n;
static const char *PN_TAB[4] = { "MAP", "WORLD", "ITEMS", "CHESTS" };
static const char *map_name(int i) { return wstr(rd16(WR + rd32(WR + 12 + i * 4))); }
static void pn_tabs(void) {
    printf("\x1b[4;0H");
    for (int i = 0; i < 4; i++) { char b[10]; snprintf(b, sizeof b, i == pn_tab ? "[%s]" : " %s ", PN_TAB[i]); if (i == pn_tab) printf("\x1b[33m"); printf("%-8s", b); if (i == pn_tab) printf("\x1b[39m"); }
    printf("\x1b[5;0H--------------------------------");
}
static void pn_clear(void) { for (int r = 6; r <= 24; r++) printf("\x1b[%d;0H\x1b[K", r); }
static void pn_map(void) {
    int s = 1; while ((mw + s - 1) / s > 30 || (mh + s - 1) / s > 15) s++;
    int cw = (mw + s - 1) / s, ch = (mh + s - 1) / s; static char cell[15][32]; static u8 clr[15][32];
    for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) { int solid = w_col((x * s + s / 2) * 16 + 8, (y * s + s / 2) * 16 + 8) == COL_SOLID; cell[y][x] = solid ? '#' : '.'; clr[y][x] = solid ? 36 : 34; }
    for (int i = 0; i < ne; i++) { Ent *e = &E[i]; if (e->dead) continue; int cx = (e->x >> 8) / 16 / s, cy = (e->y >> 8) / 16 / s; if (cx >= cw || cy >= ch || cx < 0 || cy < 0) continue; char c = 0; int k = 37;
        switch (e->t) { case T_CHEST: c = taken(KEY_ENT(e)) ? 'c' : 'C'; k = taken(KEY_ENT(e)) ? 32 : 33; break; case T_DOOR: c = 'D'; k = 35; break; case T_SHOP: c = '$'; k = 33; break; case T_SAVE: c = 'S'; k = 32; break; case T_NPC: c = 'n'; k = 37; break; case T_ITEM: c = '!'; k = 33; break; case T_ENEMY: c = 'e'; k = 31; break; case T_SIGN: c = '?'; k = 37; break; }
        if (c) { cell[cy][cx] = c; clr[cy][cx] = k; } }
    int px = ((wx >> 8) + 6) / 16 / s, py = ((wy >> 8) + 6) / 16 / s; if (px < cw && py < ch && px >= 0 && py >= 0 && ((frame >> 4) & 1)) { cell[py][px] = '@'; clr[py][px] = 97; }
    int x0 = 1 + (30 - cw) / 2;
    for (int y = 0; y < ch; y++) { printf("\x1b[%d;%dH", 6 + y, x0); int last = -1; for (int x = 0; x < cw; x++) { if (clr[y][x] != last) { printf("\x1b[%dm", clr[y][x]); last = clr[y][x]; } printf("%c", cell[y][x]); } printf("\x1b[39m"); }
    if (!(pn_dirty & 2)) {}
}
static void pn_world(void) {
    int nm = w_nmaps > 32 ? 32 : w_nmaps, seen = 0; for (int i = 0; i < nm; i++) if (pn_seen & (1u << i)) seen++;
    printf("\x1b[6;1HPlaces found %d / %d", seen, nm);
    int per = 14, pages = (nm + per - 1) / per; if (pn_page >= pages) pn_page = 0;
    for (int k = 0; k < per; k++) { int i = pn_page * per + k; if (i >= nm) break; printf("\x1b[%d;1H", 8 + k); if (i == mid_i) printf("\x1b[97m@ %-22.22s HERE\x1b[39m", map_name(i)); else if (pn_seen & (1u << i)) printf("  %-22.22s", map_name(i)); else printf("\x1b[34m  ???\x1b[39m"); }
    if (pages > 1) printf("\x1b[23;1H[PREV]   page %d/%d   [NEXT]", pn_page + 1, pages);
}
static void pn_items(void) {
    pn_n = 0; for (int i = 0; i < w_nitems && pn_n < 14; i++) if (w_inv[i] > 0) pn_list[pn_n++] = i;
    printf("\x1b[6;1HMoney $%d", w_money);
    if (!pn_n) printf("\x1b[8;1HYour bag is empty.");
    if (pn_sel >= pn_n) pn_sel = pn_n - 1;
    for (int k = 0; k < pn_n; k++) { int it = pn_list[k]; printf("\x1b[%d;1H%s %-18.18s x%d", 8 + k, k == pn_sel ? ">" : " ", wstr(rd16(witem(it))), w_inv[it]); }
    if (pn_n && pn_sel >= 0) printf("\x1b[22;1H\x1b[33m[USE]   [DROP]\x1b[39m"); else if (pn_n) printf("\x1b[22;1HTap an item.");
    if (pn_msg[0]) printf("\x1b[23;1H%.30s", pn_msg);
}
static void pn_chests(void) {
    int n = 0, op = 0; for (int i = 0; i < ne; i++) if (E[i].t == T_CHEST) { n++; if (taken(KEY_ENT(&E[i]))) op++; }
    printf("\x1b[6;1H%.20s: opened %d / %d", map_name(mid_i), op, n); if (!n) printf("\x1b[8;1HNo chests in this area.");
    int row = 0; for (int i = 0; i < ne && row < 14; i++) if (E[i].t == T_CHEST) { Ent *e = &E[i]; int tk = taken(KEY_ENT(e)); printf("\x1b[%d;1H", 8 + row++);
        if (tk) { int it = e->rec[16]; printf("\x1b[32mOPEN \x1b[39m(%2d,%2d) %.13s x%d", e->x >> 12, e->y >> 12, it < w_nitems ? wstr(rd16(witem(it))) : "?", e->rec[17] ? e->rec[17] : 1); } else printf("\x1b[33mCLOSED\x1b[39m(%2d,%2d) ???", e->x >> 12, e->y >> 12); }
}
static void ui_panel(void) {
    pn_tabs(); if (pn_dirty & 1) { pn_clear(); }
    switch (pn_tab) { case 0: pn_map(); if (pn_dirty & 1) printf("\x1b[22;1H@you C chest D door $ shop"); break; case 1: pn_world(); break; case 2: pn_items(); break; default: pn_chests(); }
}
static void pn_touch(int px, int py) {
    int col = px / 8, row = py / 8 + 1;
    if (row >= 3 && row <= 5) { int t = col / 8; if (t > 3) t = 3; if (t != pn_tab) { pn_tab = t; pn_sel = -1; pn_msg[0] = 0; pn_dirty = 1; } return; }
    if (pn_tab == 2) { if (row >= 8 && row < 8 + pn_n) { pn_sel = row - 8; pn_msg[0] = 0; pn_dirty = 1; }
        else if (row == 22 && pn_sel >= 0 && pn_sel < pn_n) { int it = pn_list[pn_sel]; const u8 *I = witem(it);
            if (col < 8) { if (I[2] == 2 && w_hp < w_maxhp) { w_hp += I[3] ? I[3] : 1; if (w_hp > w_maxhp) w_hp = w_maxhp; w_inv[it]--; ui_dirty = 1; snprintf(pn_msg, sizeof pn_msg, "Used %.14s.", wstr(rd16(witem(it)))); } else snprintf(pn_msg, sizeof pn_msg, "Can't use that now."); }
            else if (col >= 9 && col < 17) { w_inv[it]--; snprintf(pn_msg, sizeof pn_msg, "Dropped %.14s.", wstr(rd16(witem(it)))); }
            pn_dirty = 1; } }
    else if (pn_tab == 1 && row >= 23) { int pages = ((w_nmaps > 32 ? 32 : w_nmaps) + 13) / 14; if (pages > 1) { pn_page = col < 14 ? (pn_page + pages - 1) % pages : (pn_page + 1) % pages; pn_dirty = 1; } }
}
/* ------------------------------------------------------------ entities */
static void spawn_enemy(int sheet, int hp, s32 x, s32 y, int from) {
    if (ne >= MAXE) return; Ent *e = &E[ne++]; memset(e, 0, sizeof *e); e->t = T_ENEMY; e->sheet = sheet; e->hp = hp; e->x = x; e->y = y; e->from = from; e->rec = 0;
}
static const u8 *ent_rules(const u8 *rec) { return rec + 32; }
static void w_load(int mi, int tx, int ty) {
    const u8 *maps = WR + 12; MP = WR + rd32(maps + mi * 4); mid_i = mi;
    mw = MP[2]; mh = MP[3]; mview = MP[4]; mtoff = MP[5]; if (mi < 32) pn_seen |= 1u << mi;
    int n = rd16(MP + 10); const u8 *p = MP + 12;
    memcpy(g_ground, p, mw * mh); memcpy(g_over, p + mw * mh, mw * mh); p += 2 * mw * mh; p = MP + (((p - MP) + 3) & ~3);
    ne = 0;
    for (int i = 0; i < n; i++) {
        const u8 *rec = p; int nr = rec[25]; const u8 *r = rec + 32;
        for (int k = 0; k < nr; k++) { int cl = rd16(r + 6); r += 8 + cl + ((8 + cl) & 1); }
        p = r;
        if (ne >= MAXE) continue;
        Ent *e = &E[ne]; memset(e, 0, sizeof *e); e->rec = rec; e->rules = ent_rules(rec); e->t = rec[0]; e->sheet = rec[3]; e->hp = rec[5];
        e->x = rec[1] * 16 * FX; e->y = rec[2] * 16 * FX;
        if (taken(KEY_ENT(e)) && (e->t == T_ITEM || e->t == T_ENEMY)) continue;
        ne++;
    }
    wx = tx * 16 * FX; wy = ty * 16 * FX; wvx = wvy = 0; wground = 0;
    memset(tagk, 0xFF, sizeof tagk);
    if (mview) REG_DISPCNT |= DISPLAY_BG1_ACTIVE; else REG_DISPCNT &= ~DISPLAY_BG1_ACTIVE;
    BG_PALETTE[0] = mview ? RGB15(13, 22, 29) : RGB15(5, 5, 7);
    play_song(MP[6]);
    ui_dirty = 1; ui_clear_box();
    int intro = rd16(MP + 8);
    if (intro != 0xFFFF && (MP[7] || !taken(0x40000000u | mi))) {
        take_k(0x40000000u | mi);
        /* each line of the intro becomes its own text box: build tiny SAY programs in RAM */
        static u8 introcode[4]; introcode[0] = OP_SAY; introcode[1] = intro & 255; introcode[2] = intro >> 8; introcode[3] = 0; queue_code(introcode, 0);
    }
    for (int i = 0; i < ne; i++) if (E[i].rec) run_rules(&E[i], TR_LOAD, 0);
}
static void say_lines(Ent *e) {     /* NPC default lines / sign text: shown as one box (lines joined) */
    static u8 code[8]; int s = rd16(e->rec + 30), nm = rd16(e->rec + 28);
    (void)nm; code[0] = OP_SAY; code[1] = s & 255; code[2] = s >> 8; code[3] = 0; queue_code(code, e);
}
static void interact(Ent *e) {
    int n = e->rec[25];
    if (e->t == T_NPC) { int had = nrq; run_rules(e, TR_TALK, 1); if (nrq == had) say_lines(e); }
    else if (e->t == T_SIGN) { say_lines(e); run_rules(e, TR_TALK, 0); }
    else if (e->t == T_CHEST) {
        static u8 code[4] = { OP_SAY, 0, 0, 0 };
        if (!taken(KEY_ENT(e))) { take_k(KEY_ENT(e)); add_item(e->rec[16], e->rec[17], 0); sfx(SFX_1UP); }
        run_rules(e, TR_TALK, 0); (void)code;
    }
    else if (e->t == T_SAVE) { w_hp = w_maxhp; ui_dirty = 1; sfx(SFX_1UP); run_rules(e, TR_TALK, 0); }
    else if (n) run_rules(e, TR_TALK, 1);
}
static void defeat(Ent *e) {
    e->dead = 1; if (e->rec) take_k(KEY_ENT(e)); sfx(SFX_STOMP);
    if (e->rec) { int dk = e->rec[22]; if (dk == 1) { w_money += e->rec[23]; ui_dirty = 1; } else if (dk == 2) add_item(e->rec[24], e->rec[23], 0); run_rules(e, TR_DEFEAT, 0); }
}
/* ------------------------------------------------------------ update */
static int pA, pB, pU, pD, pX;
static void w_update(void) {
    pA = kd & KEY_A; pB = kd & KEY_B; pU = kd & KEY_UP; pD = kd & KEY_DOWN; pX = kd & (KEY_X | KEY_SELECT);
    if (w_over) return;
    if (busy) {
        if (busy == B_WAIT) { if (--bwait <= 0) busy = 0; }
        else if (busy == B_SAY) { if (pA || pB) { busy = 0; ui_clear_box(); } }
        else if (busy == B_CHOICE) { if (pU || pD) { bsel ^= 1; ui_box(btext, "Yes", "No", bsel); } if (pA) { busy = 0; ui_clear_box(); if (bsel) bchoice->pc = bchoice_else; } }
        else if (busy == B_SHOP) { int n = bshopn + 1; if (pU) bsel = (bsel + n - 1) % n; if (pD) bsel = (bsel + 1) % n;
            if (pB || (pA && bsel == bshopn)) { busy = 0; ui_clear_box(); ui_dirty = 1; }
            else if (pA) { const u8 *s = bshop + bsel * 3; int pr = rd16(s + 1); if (w_money >= pr) { w_money -= pr; add_item(s[0], 1, 0); sfx(SFX_COIN); } }
            if (busy) draw_shop(); }
        else if (busy == B_BAG) { int n = bag_n + 1; if (pU) bsel = (bsel + n - 1) % n; if (pD) bsel = (bsel + 1) % n;
            if (pB || pX || (pA && bsel == bag_n)) { busy = 0; ui_clear_box(); }
            else if (pA) { int it = bag_list[bsel]; const u8 *I = witem(it); if (I[2] == 2 && w_hp < w_maxhp) { w_hp += I[3] ? I[3] : 1; if (w_hp > w_maxhp) w_hp = w_maxhp; w_inv[it]--; ui_dirty = 1; } }
            if (busy) draw_bag(); }
        step_scripts(); return;
    }
    if (step_scripts()) return;
    if (pn_on) { if (kd & KEY_R) { pn_tab = (pn_tab + 1) & 3; pn_sel = -1; pn_msg[0] = 0; pn_dirty = 1; } if (kd & KEY_L) { pn_tab = (pn_tab + 3) & 3; pn_sel = -1; pn_msg[0] = 0; pn_dirty = 1; } if (kd & KEY_TOUCH) { touchPosition tp; touchRead(&tp); pn_touch(tp.px, tp.py); } }
    if (pX) { busy = B_BAG; bsel = 0; draw_bag(); return; }
    if (winv) winv--;
    int phh = mview ? ph - 2 : WHH;
    if (mview) {
        s32 maxv = (kh & KEY_Y) && META->run_fast ? META->run_fast : META->run, acc = META->accel;
        if (kh & KEY_LEFT) { wvx -= acc; if (wvx < -maxv) wvx = -maxv; wface = 1; } else if (kh & KEY_RIGHT) { wvx += acc; if (wvx > maxv) wvx = maxv; wface = 3; }
        else { if (wvx > 0) { wvx -= acc; if (wvx < 0) wvx = 0; } else if (wvx < 0) { wvx += acc; if (wvx > 0) wvx = 0; } }
        int nx = (wx + wvx) >> 8; if (!w_blocked(nx, wy >> 8, WHW, phh, 0)) wx += wvx; else wvx = 0;
        /* talk first, jump otherwise */
        if (pA) for (int i = 0; i < ne; i++) { Ent *e = &E[i]; if (e->dead) continue; if (e->t != T_NPC && e->t != T_SIGN && e->t != T_CHEST && e->t != T_SHOP && e->t != T_SAVE) continue;
            int dx = ((e->x >> 8) + 8) - ((wx >> 8) + 6), dy = ((e->y >> 8) + 8) - ((wy >> 8) + phh - 8); if (dx < 22 && dx > -22 && dy < 24 && dy > -24) { interact(e); return; } }
        if (pA) wjbuf = 6; else if (wjbuf) wjbuf--;
        wcoy = wground ? 6 : (wcoy ? wcoy - 1 : 0);
        if (wjbuf && wcoy) { wvy = -META->jump; wjbuf = wcoy = 0; wground = 0; sfx(SFX_JUMP); }
        s32 g = META->gravity; if (wvy < 0 && !(kh & KEY_A)) g *= 2; wvy += g; s32 mf = (META->max_fall ? META->max_fall : 5) * FX; if (wvy > mf) wvy = mf;
        int ny = (wy + wvy) >> 8; wground = 0;
        if (wvy > 0) {
            int foot = ny + phh, top = (foot >> 4) << 4, c1 = w_col((wx >> 8) + 1, foot), c2 = w_col((wx >> 8) + WHW - 2, foot);
            if (c1 == COL_SOLID || c2 == COL_SOLID || ((c1 == COL_PLATFORM || c2 == COL_PLATFORM) && (wy >> 8) + phh <= top)) { wy = (top - phh) * FX; wvy = 0; wground = 1; } else wy += wvy;
        } else if (wvy < 0) { if (w_blocked(wx >> 8, ny, WHW, 4, 0)) wvy = 0; else wy += wvy; }
        if (w_col((wx >> 8) + 6, (wy >> 8) + phh - 1) == COL_HAZARD) w_damage(1);
        if ((wy >> 8) > mh * 16) { w_hp = 0; w_over = 1; w_win = 0; }
    } else {
        int dx = 0, dy = 0;
        if (kh & KEY_LEFT) { dx = -1; wface = 1; } if (kh & KEY_RIGHT) { dx = 1; wface = 3; } if (kh & KEY_UP) { dy = -1; wface = 0; } if (kh & KEY_DOWN) { dy = 1; wface = 2; }
        s32 s = w_speed * ((kh & KEY_B) ? 3 : 2) / 2; if (dx && dy) s = s * 181 / 256;
        if (dx && !w_blocked((wx + dx * s) >> 8, wy >> 8, WHW, WHH, 0)) wx += dx * s;
        if (dy && !w_blocked(wx >> 8, (wy + dy * s) >> 8, WHW, WHH, 0)) wy += dy * s;
        if (w_col((wx >> 8) + 6, (wy >> 8) + 6) == COL_HAZARD) w_damage(1);
        if (pA) {
            static const int FXO[4] = {0, -14, 0, 14}, FYO[4] = {-14, 0, 14, 0};
            int fx = (wx >> 8) + 6 + FXO[wface], fy = (wy >> 8) + 6 + FYO[wface]; Ent *t = 0;
            for (int i = 0; i < ne; i++) { Ent *e = &E[i]; if (e->dead || e->t == T_ENEMY || e->t == T_BULLET || e->t == T_TRIGGER || e->t == T_SPAWNER) continue; int ex = (e->x >> 8) + 8, ey = (e->y >> 8) + 8; if (ex - fx < 12 && fx - ex < 12 && ey - fy < 12 && fy - ey < 12) { t = e; break; } }
            if (t) { interact(t); return; } watk = 12; sfx(SFX_STOMP);
        }
    }
    if (watk) watk--;
    int px_ = wx >> 8, py_ = wy >> 8;
    for (int i = 0; i < ne; i++) {
        Ent *e = &E[i]; if (e->dead) continue; e->timer++;
        int ex = e->x >> 8, ey = e->y >> 8;
        #define HIT(bx, by, bw, bh) (px_ < (bx) + (bw) && (bx) < px_ + WHW && py_ < (by) + (bh) && (by) < py_ + phh)
        if (e->t == T_ENEMY) {
            int ai = e->rec ? e->rec[4] : 3; s32 spd = (e->rec ? e->rec[7] : 19) * FX / 32; int dxp = px_ - ex, dyp = py_ - ey, ad = (dxp < 0 ? -dxp : dxp) + (dyp < 0 ? -dyp : dyp);
            s32 mx = 0, my = 0;
            if (ai == 3 && ad < 200 && ad > 0) { mx = dxp * spd / ad; my = mview ? 0 : dyp * spd / ad; }
            else if (ai == 1) { if (e->timer % 90 == 1) { int r = (e->timer * 1103515245 + i * 12345) >> 8; e->vx = ((r & 3) - 1) * spd; e->vy = mview ? 0 : (((r >> 2) & 3) - 1) * spd; } mx = e->vx; my = e->vy; }
            else if (ai == 2) { if (!e->vx) e->vx = spd; mx = e->vx; }
            else if (ai == 5) { mx = (dxp > 0 ? spd : -spd) * 4 / 5; my = ((e->timer >> 4) & 2) ? FX / 2 : -FX / 2; }
            else if (ai == 4) { if (ad < 60 && ad > 0) { mx = -dxp * spd / ad; my = mview ? 0 : -dyp * spd / ad; } if (e->timer % 90 == 0 && ad < 180 && ad > 0 && ne < MAXE) { Ent *b = &E[ne++]; memset(b, 0, sizeof *b); b->t = T_BULLET; b->x = e->x + 4 * FX; b->y = e->y + 4 * FX; b->vx = dxp * 2 * FX / ad; b->vy = dyp * 2 * FX / ad; b->sheet = 0xFF; } }
            if (mview && ai != 5) { e->vy += META->gravity; if (w_blocked(ex, (e->y + e->vy) >> 8, 14, 14, e)) e->vy = 0; e->y += e->vy; if (ai != 1) {} }
            if (!w_blocked((e->x + mx) >> 8, ey, 14, 14, e)) e->x += mx; else if (ai == 2) e->vx = -e->vx;
            if (!mview && !w_blocked(e->x >> 8, (e->y + my) >> 8, 14, 14, e)) e->y += my;
            ex = e->x >> 8; ey = e->y >> 8;
            static const int FXO[4] = {0, -14, 0, 14}, FYO[4] = {-14, 0, 14, 0};
            int ax = px_ + 6 + FXO[wface], ay = py_ + 6 + FYO[wface];
            if (watk == 11 && ex + 8 - ax < 14 && ax - ex - 8 < 14 && ey + 8 - ay < 14 && ay - ey - 8 < 14) { e->hp -= w_attack; e->x += (ex > px_ ? 10 : -10) * FX; if (!mview) e->y += (ey > py_ ? 10 : -10) * FX; if (e->hp <= 0) defeat(e); continue; }
            if (HIT(ex + 1, ey + 1, 14, 14)) { if (mview && wvy > 0 && py_ + 20 < ey + 10) { wvy = -META->jump * 3 / 5; defeat(e); } else w_damage(e->rec ? e->rec[6] : 1); }
        } else if (e->t == T_BULLET) { e->x += e->vx; e->y += e->vy; if (e->timer > 200 || w_col((e->x >> 8) + 3, (e->y >> 8) + 3) == COL_SOLID) e->dead = 1; else if (HIT(e->x >> 8, e->y >> 8, 6, 6)) { e->dead = 1; w_damage(1); } }
        else if (e->t == T_ITEM) { if (HIT(ex + 2, ey + 2, 12, 12)) { e->dead = 1; take_k(KEY_ENT(e)); add_item(e->rec[16], e->rec[17], 1); sfx(SFX_COIN); run_rules(e, TR_TOUCH, 0); } }
        else if (e->t == T_DOOR) {
            if (HIT(ex + 3, ey + 3, 10, 10)) {
                int need = e->rec[21];
                if (need != 0xFF && w_inv[need] <= 0) { if (!e->msg) { e->msg = 1; static u8 lk[4]; lk[0] = OP_SAY; int s = rd16(witem(need)); (void)s; ui_box("It is locked.", 0, 0, 0); busy = B_SAY; } }
                else { run_rules(e, TR_TOUCH, 0); if (e->rec[18] != 0xFF) { w_load(e->rec[18], e->rec[19], e->rec[20]); return; } }
            } else e->msg = 0;
        }
        else if (e->t == T_TRIGGER) { int inside = HIT(ex, ey, e->rec[12] * 16, e->rec[13] * 16); if (inside && !e->inside && !(e->rec[11] && e->fired)) { e->fired = 1; run_rules(e, TR_ENTER, 0); } e->inside = inside; }
        else if (e->t == T_SPAWNER) { int every = (e->rec[14] ? e->rec[14] : 4) * 60; if (every < 30) every = 30;
            if (e->timer % every == 0) { int alive = 0; for (int k = 0; k < ne; k++) if (E[k].t == T_ENEMY && E[k].from == i && !E[k].dead) alive++; if (alive < e->rec[15]) { spawn_enemy(e->sheet, e->rec[5], e->x, e->y, i); } } }
        else if (e->t == T_NPC || e->t == T_PROP) {
            if (e->t == T_NPC && e->rec[8] && e->timer % 120 == 1) { int r = (e->timer * 1103515245 + i * 7) >> 8; e->vx = ((r & 3) - 1) * FX / 2; e->vy = mview ? 0 : (((r >> 2) & 3) - 1) * FX / 2; }
            if ((e->vx || e->vy) && !w_blocked((e->x + e->vx) >> 8, (e->y + e->vy) >> 8, 14, 14, e) && !HIT((e->x + e->vx) >> 8, (e->y + e->vy) >> 8, 16, 16)) { e->x += e->vx; e->y += e->vy; }
            if (HIT(ex, ey, 16, 16)) { if (!e->touched) run_rules(e, TR_TOUCH, 0); e->touched = 1; } else e->touched = 0;
        }
    }
    /* camera */
    int sw = 256, sh = 192;
    wcamx = (wx >> 8) + 6 - sw / 2; wcamy = (wy >> 8) + 6 - sh / 2;
    if (wcamx > mw * 16 - sw) wcamx = mw * 16 - sw; if (wcamx < 0) wcamx = 0;
    if (wcamy > mh * 16 - sh) wcamy = mh * 16 - sh; if (wcamy < 0) wcamy = 0;
}
static void w_draw(void) {
    w_draw_tiles();
    int phh = mview ? ph - 2 : WHH;
    for (int i = 0; i < ne; i++) {
        Ent *e = &E[i]; if (e->dead) continue;
        int sx = (e->x >> 8) - wcamx, sy = (e->y >> 8) - wcamy;
        if (sx < -40 || sx > 260 || sy < -70 || sy > 200) continue;
        int sh_ = e->sheet;
        if (e->t == T_BULLET) { text(sx, sy, "*"); continue; }
        if (e->t == T_TRIGGER || e->t == T_SPAWNER || (e->t == T_DOOR && e->rec && e->rec[10])) continue;
        if (e->t == T_DOOR) { text(sx + 4, sy + 4, "#"); continue; }
        if (e->t == T_SIGN) { text(sx + 4, sy + 4, "?"); continue; }
        if (e->t == T_CHEST) { spr(SH_SPRING, taken(KEY_ENT(e)) ? 1 : 0, sx, sy, 0); continue; }
        if (e->t == T_SAVE) { spr(SH_HEART, (frame >> 4) & 1, sx, sy, 0); continue; }
        if (e->t == T_ITEM) { if (sh_ != 0xFF && sheet_frames[sh_]) spr(sh_, (frame >> 3) & 3, sx, sy, 0); else spr(SH_COIN, (frame >> 3) & 3, sx, sy, 0); continue; }
        if (sh_ == 0xFF || sh_ >= 32 || !sheet_frames[sh_]) sh_ = e->t == T_ENEMY ? SH_WALKER : SH_HERO;
        if (!mview && e->rec && e->rec[26] != 0xFF && e->rec[26] < MAXSH && sheet_frames[e->rec[26]]) {
            int tdh = e->rec[26], ddx = (wx >> 8) - (e->x >> 8), ddy = (wy >> 8) - (e->y >> 8), dir = (ddx < 0 ? -ddx : ddx) > (ddy < 0 ? -ddy : ddy) ? (ddx < 0 ? 1 : 3) : (ddy < 0 ? 0 : 2);
            static const u8 TDF[4] = {2, 4, 0, 4};
            spr(tdh, TDF[dir], sx + 8 - sheet_w[tdh] / 2, sy + 16 - sheet_h[tdh], dir == 1); continue;
        }
        spr(sh_, e->t == T_ENEMY ? (frame >> 4) & 1 : 0, sx + 8 - sheet_w[sh_] / 2, sy + 16 - sheet_h[sh_], e->t == T_ENEMY ? (wx >> 8) > (e->x >> 8) : (wx >> 8) < (e->x >> 8));
    }
    if (!(winv & 4)) {
        int moving = kh & (KEY_LEFT | KEY_RIGHT | KEY_UP | KEY_DOWN);
        int f = mview && !wground ? 3 : moving ? 1 + ((frame >> 3) & 1) : 0;
        int tdh = WR[10];
        if (!mview && tdh != 0xFF && tdh < MAXSH && sheet_frames[tdh]) { static const u8 TDF[4] = {2, 4, 0, 4}; spr(tdh, TDF[wface] + (moving ? (frame >> 3) & 1 : 0), (wx >> 8) - (pw - WHW) / 2 - wcamx, (wy >> 8) + phh - ph - wcamy, wface == 1); }
        else spr(SH_HERO, f, (wx >> 8) - (pw - WHW) / 2 - wcamx, (wy >> 8) + phh - ph - wcamy + (mview ? 2 : 0), wface == 1);
        if (watk) text((wx >> 8) + 2 + (wface == 1 ? -14 : wface == 3 ? 14 : 0) - wcamx, (wy >> 8) + 2 + (wface == 0 ? -14 : wface == 2 ? 14 : 0) - wcamy, "+");
    }
}
static void world_main(void) {
    u32 sz;
    WR = sec("WRLD", &sz); WT = sec("WTXT", &sz);
    w_nmaps = WR[0]; w_nitems = WR[1]; pn_on = WR[2] & 1;
    /* over layer on BG2 (above the sprites), same tiles as BG0 */
    int b2 = bgInit(2, BgType_Text8bpp, BgSize_T_512x256, 28, 0); bgSetPriority(b2, 0); map2 = bgGetMapPtr(b2);
    bgSetPriority(bg0, 2);
    if (has_tpad) { videoSetModeSub(MODE_0_2D); vramSetBankC(VRAM_C_SUB_BG); consoleInit(NULL, 0, BgType_Text4bpp, BgSize_T_256x256, 31, 0, false, true); has_tpad = 0; }
    while (1) {
        /* title */
        printf("\x1b[2J"); play_song(META->title_song);
        w_load(WR[3], WR[4], WR[5]);
        for (int t = 0; ; t++) { input(); frame_begin(); wcamx = 0; wcamy = 0; w_draw_tiles(); ctext(60, META->title); if ((t >> 4) & 1) ctext(130, "PRESS START"); frame_end(); if (t > 20 && (kd & (KEY_START | KEY_A))) break;
#ifdef NR_AUTOTEST
            if (t > 60) break;
#endif
        }
        /* new game */
        memset(w_inv, 0, sizeof w_inv); memset(w_flags, 0, sizeof w_flags); n_taken = 0; nrq = 0; busy = 0; w_over = 0;
        w_maxhp = w_hp = WR[6]; w_attack = WR[7]; w_speed = rd16(WR + 8); w_money = 0;
        printf("\x1b[2J"); pn_seen = 0; pn_tab = 0; pn_sel = -1; pn_msg[0] = 0; pn_dirty = 1;
        w_load(WR[3], WR[4], WR[5]);
        while (1) {
            input();
            frame_begin();
            w_update();
            w_draw();
            if (w_over && !busy) { ctext(88, w_win ? (btext && *btext ? btext : "YOU WIN!") : "GAME OVER"); }
            frame_end();
            if (ui_dirty) { ui_hud(); ui_dirty = 0; if (pn_tab == 2) pn_dirty |= 1; }
            if (pn_on && !busy && !w_over && (pn_dirty || (pn_tab == 0 && (frame & 7) == 0))) { ui_panel(); pn_dirty = 0; }
            if (w_over && (kd & KEY_START)) break;
#ifdef NR_AUTOTEST
            if (frame > 6000) break;
#endif
        }
    }
}
