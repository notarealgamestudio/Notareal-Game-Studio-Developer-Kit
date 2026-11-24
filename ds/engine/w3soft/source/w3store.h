// STORE MODE for the N64 / PlayStation software engine: the Convenience Store job sim in reduced form (same street, shop, shelves and people as the PC / Xbox game).
// Everything is data from the W3DW section: shelf / pile / register / queue / door / Gus / Mack positions are entities (types 9-17), the shop and street are boxes.
// Included by w3core.c before render3d(); the HUD half is w3storehud.h.
#define NPROD 6
typedef struct { const char *n; short price; u16 col; } Prod;
static const Prod PR[NPROD] = { { "SODA", 179, RGB15(26, 6, 6) }, { "CHIPS", 249, RGB15(30, 24, 6) }, { "CANDY", 129, RGB15(27, 11, 21) }, { "BREAD", 319, RGB15(25, 20, 12) }, { "ENERGY", 299, RGB15(7, 25, 11) }, { "MILK", 389, RGB15(29, 30, 31) } };
enum { CS_WALK, CS_PICK, CS_QWAIT, CS_SERVED, CS_STUN, CS_ROB };
enum { G_SHELF, G_QUEUE, G_LEAVE, G_FLEE, G_ROB };
typedef struct { float x, z, yaw, anim, wx[5], wz[5], sp; int st, t, wp, nwp, role, goal, want[3], nwant, got, tk, pay, total, wait; u16 col, skin; u8 alive; } Cu;
static Cu cu[8];
static float sh_x[NPROD], sh_z[NPROD], sh_cx[NPROD], sh_cz[NPROD], sh_w[NPROD], pi_x[NPROD], pi_z[NPROD], q_x[6], q_z[6], reg_x, reg_z, hob_x, hob_z, dea_x, dea_z, door_x, door_z, out_x, out_z, zn[4];
static int sstock[NPROD], pile[NPROD], carry_p, carry_q, nq;
static int s_state, s_min, s_start, s_end, s_cash, s_sales, s_goal, s_rep, s_wallet, s_loss, s_done, s_caught, s_stolen, s_mopped, s_stocked, s_started, s_msgt, s_tk, s_next, s_robt, s_robdone, s_thief, s_gusw, s_dealer, s_hobo, s_rob, s_spillt, s_slip, s_shiftf, s_pay, s_mop, s_night = 32;
static int s_sf, owned[4], ammo[4], wcur, wcd, gus_given, mk_sel, shopm, regm, reg_c, reg_total, reg_paid, reg_give, reg_rep, hobo_chat, tillstart;
static float sp_x[3], sp_z[3]; static int sp_on[3], sp_slipped[3];
static char s_msg[40]; static const char *prompt;
static void ssay(const char *s) { strncpy(s_msg, s, 39); s_msg[39] = 0; s_msgt = 200; }
static const char *WN[4] = { "FISTS", "BAT", "PEPPER", "TASER" }; static const int WR10[4] = { 24, 23, 32, 50 }, WCD[4] = { 40, 42, 54, 130 }, WPRICE[4] = { 0, 2500, 4000, 6000 }, WAMMO[4] = { 0, 0, 4, 3 };
static const u16 BODY[8] = { RGB15(24, 8, 8), RGB15(8, 14, 26), RGB15(10, 22, 10), RGB15(26, 20, 6), RGB15(18, 10, 24), RGB15(22, 22, 24), RGB15(8, 20, 22), RGB15(26, 12, 4) };
static const u16 SKIN[4] = { RGB15(26, 20, 16), RGB15(20, 14, 10), RGB15(14, 9, 6), RGB15(28, 23, 19) };
static float fd2(float ax, float az, float bx, float bz) { return (ax - bx) * (ax - bx) + (az - bz) * (az - bz); }
static void money(char *o, int c) { char t[12]; if (c < 0) { *o++ = '-'; c = -c; } *o++ = '$'; itoa_(t, c / 100); strcpy(o, t); o += strlen(t); *o++ = '.'; *o++ = '0' + (c / 10) % 10; *o++ = '0' + c % 10; *o = 0; }
static void clock_s(char *o, int mn) { int h = mn / 60, m = mn % 60, ap = h >= 12; int hh = h % 12; if (!hh) hh = 12; char t[8]; itoa_(t, hh); strcpy(o, t); o += strlen(t); *o++ = ':'; *o++ = '0' + m / 10; *o++ = '0' + m % 10; strcpy(o, ap ? " PM" : " AM"); }

static void store_load(void)
{
    for (int i = 0; i < ne0; i++)
    {   const Ent *e = &E0[i]; float x = e->x / 8.0f, z = e->z / 8.0f, f = e->flags;
        switch (e->type)
        {   case 9: if (f < NPROD) { sh_x[(int)f] = x; sh_z[(int)f] = z; } break;
            case 16: if (f < NPROD) { sh_cx[(int)f] = x; sh_cz[(int)f] = z; sh_w[(int)f] = e->y / 8.0f; } break;
            case 10: if (f < NPROD) { pi_x[(int)f] = x; pi_z[(int)f] = z; } break;
            case 11: reg_x = x; reg_z = z; break; case 12: if (f < 6) { q_x[(int)f] = x; q_z[(int)f] = z; } break;
            case 13: hob_x = x; hob_z = z; break; case 14: dea_x = x; dea_z = z; break;
            case 15: if (f == 0) { door_x = x; door_z = z; } else { out_x = x; out_z = z; } break;
            case 17: if (f == 0) { zn[0] = x; zn[1] = z; } else { zn[2] = x; zn[3] = z; } break;
        }
    }
    s_start = (H->pad2[1] & 255) * 60; s_end = (H->pad2[1] >> 8) * 60; if (s_end <= s_start) s_end = s_start + 480; s_goal = H->goal * 100; tillstart = H->pad2[0] * 100; s_wallet = H->sh * 100;
    s_thief = H->pad2[2] & 255; s_hobo = (H->pad2[2] >> 8) & 1; s_dealer = (H->pad2[2] >> 8) & 2; s_rob = (H->pad2[2] >> 8) & 4; s_shiftf = (H->time ? H->time : 300) * 60;
    owned[0] = 1; owned[1] = owned[2] = owned[3] = 0; ammo[2] = ammo[3] = 0; wcur = 0; gus_given = 0; s_rep = 55;
}
static void store_shift(void)    // start / restart a shift: street spawn, stocked shelves, clock before the doors open
{
    px = H->sx / 8.0f; pz = H->sz / 8.0f; yaw = 3.14159f; pit = -0.1f; py = 0; vy = 0; onground = 1; tp = 1; s_state = 0; s_sf = 0; s_min = s_start - 40; s_cash = tillstart; s_sales = s_loss = s_done = s_caught = s_stolen = s_mopped = s_stocked = 0; s_started = 0; s_tk = s_next = 0; s_robdone = 0; s_gusw = 0;
    for (int i = 0; i < NPROD; i++) { sstock[i] = 6; pile[i] = 14; } carry_p = -1; carry_q = 0; memset(cu, 0, sizeof cu); memset(sp_on, 0, sizeof sp_on); s_spillt = 600; s_next = 400; regm = 0; shopm = 0; wcd = 0; s_mop = 0;
    s_robt = s_shiftf * 4 / 10 + rnd() % (s_shiftf / 4);
    ssay("WALK INTO THE STORE TO CLOCK IN");
}
static void store_new(void) { static int loaded; if (!loaded) { store_load(); loaded = 1; } store_shift(); }

// ---------------------------------------------------------------- customers
static void setp(Cu *c, int goal, int n, const float *p) { c->goal = goal; c->nwp = n; c->wp = 0; for (int i = 0; i < n; i++) { c->wx[i] = p[i * 2]; c->wz[i] = p[i * 2 + 1]; } c->st = CS_WALK; }
static int pick_prod(int start) { for (int k = 0; k < NPROD; k++) { int p = (start + k) % NPROD; if (sstock[p] > 0) return p; } return -1; }
static void plan_shelf(Cu *c, int fromdoor)
{
    int p = c->want[c->got]; float pts[10]; int n = 0;
    if (fromdoor) { pts[n * 2] = out_x; pts[n * 2 + 1] = door_z - 1.2f; n++; pts[n * 2] = 0; pts[n * 2 + 1] = door_z + 1.0f; n++; } else { pts[n * 2] = 0; pts[n * 2 + 1] = c->z; n++; }
    pts[n * 2] = 0; pts[n * 2 + 1] = sh_z[p]; n++; pts[n * 2] = sh_x[p]; pts[n * 2 + 1] = sh_z[p]; n++; setp(c, G_SHELF, n, pts);
}
static void plan_queue(Cu *c)
{
    int rk = 0; for (int i = 0; i < 8; i++) if (cu[i].alive && &cu[i] != c && (cu[i].goal == G_QUEUE) && cu[i].role != 2) rk++;
    if (rk > 5) { float p[6] = { 0, c->z, 0, door_z - 3.0f, out_x, out_z }; setp(c, G_LEAVE, 3, p); return; }
    c->tk = s_tk++; float p[6] = { 0, c->z, 0, q_z[0], q_x[rk], q_z[0] }; setp(c, G_QUEUE, 3, p);
}
static void plan_leave(Cu *c, float sp) { float p[6] = { 0, c->z < door_z ? c->z : door_z + 1.0f, 0, door_z - 3.0f, out_x, out_z }; if (c->x > 1.5f) { p[0] = 0; p[1] = q_z[0]; } setp(c, G_LEAVE, 3, p); c->sp = sp; }
static void spawn_cust(int role)
{
    int k = -1; for (int i = 0; i < 8; i++) if (!cu[i].alive) { k = i; break; } if (k < 0) return; Cu *c = &cu[k]; memset(c, 0, sizeof *c);
    c->alive = 1; c->x = out_x; c->z = out_z; c->role = role; c->col = BODY[rnd() & 7] | BIT(15); c->skin = SKIN[rnd() & 3] | BIT(15); c->sp = 1.7f; c->yaw = 0;
    if (role == 2) { c->col = RGB15(5, 5, 6) | BIT(15); float p[6] = { out_x, door_z - 1.5f, 0, door_z + 0.8f, q_x[0] + 0.2f, q_z[0] }; setp(c, G_ROB, 3, p); c->sp = 2.2f; ssay("SOMEONE SKETCHY ENTERS..."); return; }
    c->nwant = role == 1 ? 1 : 1 + rnd() % 3; for (int i = 0; i < c->nwant; i++) { int p = pick_prod(rnd() % NPROD); if (p < 0) { c->nwant = i; break; } c->want[i] = p; }
    if (c->nwant == 0) { s_rep -= 1; plan_leave(c, 1.7f); ssay("SHELVES ARE EMPTY - STOCK UP"); return; }
    plan_shelf(c, 1); if (role == 1) c->sp = 1.5f;
}
static int cust_total(const Cu *c) { int t = 0; for (int i = 0; i < c->got; i++) t += PR[c->want[i]].price; t += t * 7 / 100; return (t + 2) / 5 * 5; }
static void remove_cust(Cu *c) { c->alive = 0; }
static void stun_cust(Cu *c, int caught)
{
    if (caught && c->role == 1 && c->got) { for (int i = 0; i < c->got; i++) sstock[c->want[i]]++; c->got = 0; } if (caught && c->role == 2) { s_wallet += 2000; s_rep += 8; ssay("ROBBER DOWN! +$20 REWARD"); } else if (caught) { s_rep += 3; ssay("CAUGHT THE THIEF!"); }
    if (caught) s_caught++; c->st = CS_STUN; c->t = 150; c->role = 0; h_shot(1);
}
static void cust_step(Cu *c)
{
    if (!c->alive) return; c->anim += 0.2f;
    if (c->st == CS_STUN) { if (--c->t <= 0) { plan_leave(c, 1.4f); } return; }
    if (c->st == CS_PICK) { if (--c->t <= 0) { int p = c->want[c->got]; if (sstock[p] > 0) { sstock[p]--; c->got++; } else s_rep -= 1;
            if (c->got < c->nwant) { c->want[c->got] = pick_prod(c->want[c->got] + 1) < 0 ? c->want[c->got] : pick_prod(c->want[c->got] + 1); plan_shelf(c, 0); }
            else if (c->role == 1) { float p2[8] = { 0, c->z, 0, door_z, 0, door_z - 3.0f, out_x + 2, out_z }; setp(c, G_FLEE, 4, p2); c->sp = 3.6f; }
            else if (c->got == 0) plan_leave(c, 1.7f); else plan_queue(c); } return; }
    if (c->st == CS_QWAIT || c->st == CS_SERVED)
    {   int rk = 0; for (int i = 0; i < 8; i++) if (cu[i].alive && &cu[i] != c && cu[i].goal == G_QUEUE && cu[i].role != 2 && cu[i].tk < c->tk) rk++;
        if (c->st == CS_QWAIT) { float tx = q_x[rk]; if (fabsf(c->x - tx) > 0.15f) { c->x += (tx > c->x ? 1 : -1) * 1.5f / 60.0f; c->yaw = tx > c->x ? 1.57f : -1.57f; } else c->yaw = 3.14f;
            if (++c->wait > 60 * 28 && rk > 0 ? 0 : c->wait > 60 * 40) { s_rep -= 2; ssay("CUSTOMER GAVE UP WAITING"); for (int i = 0; i < c->got; i++) sstock[c->want[i]]++; plan_leave(c, 1.8f); } }
        return; }
    if (c->st == CS_ROB) { c->yaw = 3.14f; if (--c->t <= 0) { int take = s_cash; s_cash = 0; s_loss += take; s_rep -= 8; ssay("HE TOOK THE WHOLE TILL!"); h_shot(0); float p2[8] = { 0, q_z[0], 0, door_z - 3.0f, out_x + 2, out_z }; setp(c, G_FLEE, 3, p2); c->sp = 3.8f; } else if ((c->t % 90) == 0) ssay("ROBBERY! STOP HIM!"); return; }
    if (c->nwp == 0 || c->wp >= c->nwp) return;
    { float dx = c->wx[c->wp] - c->x, dz = c->wz[c->wp] - c->z, d = sqrtf(dx * dx + dz * dz);
      if (d < 0.14f) { if (++c->wp >= c->nwp)
        {   if (c->goal == G_SHELF) { c->st = CS_PICK; c->t = 45; c->yaw = sh_x[c->want[c->got]] < 0 ? -1.57f : sh_x[c->want[c->got]] > 8 ? -1.57f : 0; }
            else if (c->goal == G_QUEUE) c->st = CS_QWAIT; else if (c->goal == G_ROB) { c->st = CS_ROB; c->t = 480; ssay("ROBBERY! STOP HIM!"); h_blip(300, 1); }
            else if (c->goal == G_FLEE) { if (c->role == 1) { int v = 0; for (int i = 0; i < c->got; i++) v += PR[c->want[i]].price; s_loss += v; s_stolen++; s_rep -= 1; ssay("A THIEF GOT AWAY"); } remove_cust(c); }
            else remove_cust(c); } }
      else { c->yaw = atan2f(dx, -dz); float s = c->sp / 60.0f; c->x += dx / d * s; c->z += dz / d * s; } }
}
static Cu *nearest_target(float range)
{
    Cu *best = 0; float bd = range * range; for (int i = 0; i < 8; i++) { Cu *c = &cu[i]; if (!c->alive || c->st == CS_STUN) continue; if (c->role == 0 && c->st != CS_ROB) continue; float d = fd2(c->x, c->z, px, pz); if (d < bd) { bd = d; best = c; } } return best;
}

// ---------------------------------------------------------------- player actions
static int near_p(float x, float z, float r) { return fd2(px, pz, x, z) < r * r; }
static void do_attack(void)
{
    if (wcd > 0) return; int w = wcur; if (w >= 2 && ammo[w] <= 0) { ssay("OUT OF CHARGES - SEE MACK"); return; } wcd = WCD[w]; if (w >= 2) ammo[w]--;
    float range = WR10[w] / 10.0f; Cu *t = nearest_target(range); h_shot(w >= 2 ? 1 : 0); if (!t) { ssay("YOU SWING AT NOTHING"); return; }
    if (w == 0 && (rnd() % 100) > 72) { ssay("HE SLIPPED YOUR GRAB!"); return; } stun_cust(t, 1);
}
static void register_open(Cu *c)
{
    reg_c = (int)(c - cu); reg_total = cust_total(c); int bills[4] = { 500, 1000, 2000, 5000 }, b = 0; while (b < 3 && bills[b] < reg_total) b++; if (b < 3 && reg_total < 300 && (rnd() % 3) == 0) b++; if (bills[b] < reg_total) b = 3;
    reg_paid = bills[b]; reg_give = 0; regm = 1; c->st = CS_SERVED; h_blip(1400, 0);
}
static void register_done(void)
{
    Cu *c = &cu[reg_c]; int owe = reg_paid - reg_total, diff = reg_give - owe; char b[16];
    s_cash += reg_paid - reg_give; s_sales += reg_total; s_done++;
    if (diff == 0) { s_rep += 2; ssay("PERFECT CHANGE!"); h_blip(2093, 0); }
    else if (diff > 0) { s_loss += diff; money(b, diff); strcpy(s_msg, "OVER BY "); strcat(s_msg, b); s_msgt = 200; h_blip(700, 0); }
    else { s_rep -= 2; money(b, -diff); strcpy(s_msg, "SHORT BY "); strcat(s_msg, b); s_msgt = 200; h_blip(220, 0); }
    if (s_rep > 100) s_rep = 100; if (s_rep < 0) s_rep = 0; c->role = 0; plan_leave(c, 1.8f); regm = 0;
}
static void store_use(void)    // A button: the nearest thing you can do something with
{
    u32 kd = w3_kd;
    // register: serve the first customer in line while standing behind the counter
    if (px > zn[0] && px < zn[2] && pz > zn[1] && pz < zn[3]) { for (int i = 0; i < 8; i++) if (cu[i].alive && cu[i].st == CS_QWAIT && cu[i].goal == G_QUEUE && fabsf(cu[i].x - q_x[0]) < 0.4f) { if (kd & KEY_A) register_open(&cu[i]); prompt = "A: RING UP CUSTOMER"; return; } }
    for (int i = 0; i < 3; i++) if (sp_on[i] && near_p(sp_x[i], sp_z[i], 1.5f)) { prompt = "HOLD A: MOP THE SPILL"; if (w3_kh & KEY_A) { if (++s_mop > 50) { sp_on[i] = 0; s_mop = 0; s_mopped++; s_rep += 1; ssay("SPILL MOPPED"); h_blip(900, 1); } } else s_mop = 0; return; }
    for (int p = 0; p < NPROD; p++) if (near_p(pi_x[p], pi_z[p], 1.9f)) { if (carry_q) { prompt = "BOX IN HANDS - STOCK A SHELF"; return; } if (pile[p] < 4) { prompt = "PILE EMPTY"; return; } prompt = "A: GRAB A BOX"; if (kd & KEY_A) { carry_p = p; carry_q = 4; pile[p] -= 4; h_blip(800, 0); } return; }
    for (int p = 0; p < NPROD; p++) if (near_p(sh_x[p], sh_z[p], 1.8f)) { if (!carry_q) { prompt = "SHELF - BRING A BOX FROM THE BACK"; return; } if (carry_p != p) { prompt = "WRONG SHELF FOR THIS BOX"; return; } prompt = "A: STOCK THE SHELF"; if (kd & KEY_A) { int n = 12 - sstock[p]; if (n > carry_q) n = carry_q; if (n <= 0) { ssay("SHELF IS FULL"); return; } sstock[p] += n; carry_q -= n; s_stocked += n; if (!carry_q) carry_p = -1; h_blip(1100, 1); } return; }
    if (s_hobo && near_p(hob_x, hob_z, 2.6f)) { prompt = "A: CHAT   X: GIVE GUS $1"; if (kd & KEY_A) { static const char *L[6] = { "SPARE CHANGE? FOR MY PIGEON'S LAWYER.", "I USED TO TEST MATTRESSES. GOT FIRED.", "I DONT BEG. I CROWDFUND. IN PERSON.", "THREE WEEKS AGO I FOUND A HAT.", "BETWEEN HOMES. A TOURIST IN MY LIFE.", "YOUR STORE HAS BAD DECISIONS, AISLE 3." }; ssay(L[hobo_chat++ % 6]); }
        if (kd & KEY_X) { if (s_wallet >= 100) { s_wallet -= 100; gus_given++; ssay(gus_given % 3 == 0 ? "GUS WILL WATCH YOUR DOOR TONIGHT!" : "BLESS YOU! NAMING A PIGEON AFTER YOU."); if (gus_given % 3 == 0) s_gusw = 1; h_blip(1500, 0); } else ssay("YOU HAVE NO DOLLAR TO GIVE"); } return; }
    if (s_dealer && near_p(dea_x, dea_z, 2.6f)) { prompt = "A: TALK TO MACK"; if (kd & KEY_A) { shopm = 1; mk_sel = 1; } return; }
}
static void shop_step(void)
{
    u32 kd = w3_kd; if (kd & KEY_UP) { if (--mk_sel < 1) mk_sel = 4; } if (kd & KEY_DOWN) { if (++mk_sel > 4) mk_sel = 1; } if (kd & (KEY_B | KEY_START)) { shopm = 0; return; }
    if (kd & KEY_A)
    {   if (mk_sel == 4) { int c = 1000; if (s_wallet < c) { ssay("MACK: COME BACK WITH CASH."); return; } if (!owned[2] && !owned[3]) { ssay("MACK: REFILL WHAT, EXACTLY?"); return; } s_wallet -= c; if (owned[2]) ammo[2] = WAMMO[2]; if (owned[3]) ammo[3] = WAMMO[3]; ssay("MACK: FULL CHARGES."); h_blip(1200, 0); return; }
        int w = mk_sel; if (owned[w]) { ssay("YOU ALREADY OWN THAT."); return; } if (s_wallet < WPRICE[w]) { ssay("MACK: COME BACK WITH CASH."); return; } s_wallet -= WPRICE[w]; owned[w] = 1; ammo[w] = WAMMO[w]; wcur = w; ssay("MACK: NEVER SEEN ME. WE'RE GOOD."); h_blip(1568, 0);
    }
}
static void reg_step(void)
{
    u32 kd = w3_kd, kh = w3_kh; static int rep; int big = (kh & KEY_R) ? 5 : 1; int ev = 0;
    if (kh & (KEY_UP | KEY_DOWN | KEY_LEFT | KEY_RIGHT)) { rep++; if (rep > 20 && (rep & 3) == 0) ev = 1; } else rep = 0;
    int up = (kd & KEY_UP) || (ev && (kh & KEY_UP)), dn = (kd & KEY_DOWN) || (ev && (kh & KEY_DOWN)), rt = (kd & KEY_RIGHT) || (ev && (kh & KEY_RIGHT)), lf = (kd & KEY_LEFT) || (ev && (kh & KEY_LEFT));
    if (up) reg_give += 100; if (dn) reg_give -= 100; if (rt) reg_give += 5 * big; if (lf) reg_give -= 5 * big; if (reg_give < 0) reg_give = 0; if (reg_give > reg_paid) reg_give = reg_paid; if (up | dn | rt | lf) h_blip(1000 + reg_give / 10, 1);
    if (kd & KEY_A) register_done(); if (kd & KEY_B) { regm = 0; cu[reg_c].st = CS_QWAIT; }
}
static void store_step(void)
{
    u32 kh = w3_kh, kd = w3_kd; prompt = 0; if (s_msgt > 0) s_msgt--; if (s_state == 1) { if (kd & KEY_A) { s_wallet += s_pay; store_shift(); } return; }
    if (regm) { reg_step(); goto world; } if (shopm) { shop_step(); goto world; }
    if (kh & KEY_LEFT) yaw -= 0.048f; if (kh & KEY_RIGHT) yaw += 0.048f; if (yaw > 6.2832f) yaw -= 6.2832f; if (yaw < -6.2832f) yaw += 6.2832f;
    { float f = 0; if (kh & KEY_UP) f += 1; if (kh & KEY_DOWN) f -= 0.6f; float sp = H->run / 10.0f; if (kh & KEY_R) sp *= 1.7f; float mx = sinf(yaw) * f * sp / 60.0f, mz = -cosf(yaw) * f * sp / 60.0f;
      if (!blocked(px + mx, pz, 0, 1.7f, 0.36f)) px += mx; if (!blocked(px, pz + mz, 0, 1.7f, 0.36f)) pz += mz; if (px > 29.3f) px = 29.3f; if (px < -29.3f) px = -29.3f; if (pz < -42.5f) pz = -42.5f; if (pz > 17.5f) pz = 17.5f; py = floor_at(px, pz, py + 0.2f, 0.3f); if (f) bob += 0.22f * (kh & KEY_R ? 1.4f : 1); }
    if (kd & KEY_Y) tp ^= 1; if (kd & KEY_SELECT) { for (int k = 1; k <= 4; k++) { int w = (wcur + k) % 4; if (owned[w]) { wcur = w; break; } } }
    store_use(); if (kd & KEY_B) do_attack(); if (wcd > 0) wcd--;
    if (!s_started && pz > door_z + 0.8f) { s_started = 1; s_min = s_start; ssay("CLOCKED IN. KEEP THE SHELVES STOCKED."); h_blip(1200, 0); }
world:
    if (s_started)
    {   s_sf++; s_min = s_start + (int)((float)(s_end - s_start) * s_sf / s_shiftf); if (s_min > s_end) s_min = s_end;
        { int f = 32; if (s_min > 17 * 60) f = 32 - (s_min - 17 * 60) * 20 / 300; if (f < 12) f = 12; s_night = f; }
        if (--s_next <= 0) { int act = 0; for (int i = 0; i < 8; i++) act += cu[i].alive; if (act < 6) spawn_cust((int)(rnd() % 100) < (s_gusw ? s_thief / 2 : s_thief) ? 1 : 0); s_next = 560 - s_rep * 2 + (int)(rnd() % 300); }
        if (s_rob && !s_robdone && s_sf > s_robt) { s_robdone = 1; spawn_cust(2); }
        if (--s_spillt <= 0) { s_spillt = 1500 + (int)(rnd() % 1500); for (int i = 0; i < 3; i++) if (!sp_on[i]) { sp_on[i] = 1; sp_slipped[i] = 0; sp_x[i] = -2.0f + frand() * 4.0f; sp_z[i] = -5.5f + frand() * 11.0f; ssay("SPILL IN THE AISLE - MOP IT"); break; } }
        for (int i = 0; i < 8; i++) { Cu *c = &cu[i]; cust_step(c); if (c->alive && c->st == CS_WALK && c->role == 0) for (int k = 0; k < 3; k++) if (sp_on[k] && !sp_slipped[k] && fd2(c->x, c->z, sp_x[k], sp_z[k]) < 0.5f) { sp_slipped[k] = 1; c->st = CS_STUN; c->t = 100; s_rep -= 2; ssay("A CUSTOMER SLIPPED ON THE SPILL!"); h_shot(0); } }
        if (s_sf >= s_shiftf) { s_state = 1; s_pay = (s_end - s_start) / 60 * 900 + s_sales / 20 + (s_sales >= s_goal ? 1500 : 0); regm = shopm = 0; }
    }
    else s_min = s_start - 40;
}
// ---------------------------------------------------------------- 3D drawing (called from render3d)
static void store_items(void)
{
    float fx = sinf(yaw), fz = -cosf(yaw);
    for (int i = 0; i < 8; i++) if (cu[i].alive) { float dx = cu[i].x - px, dz = cu[i].z - pz; if (dx * dx + dz * dz < 55 * 55 && dx * fx + dz * fz > -3) add_item(6, i, (int)(dx * 8), (int)(dz * 8)); }
    for (int p = 0; p < NPROD; p++) if (sstock[p] > 0) add_item(7, p, (int)((sh_cx[p] - px) * 8), (int)((sh_cz[p] - pz) * 8));
    for (int i = 0; i < 3; i++) if (sp_on[i]) add_item(8, i, (int)((sp_x[i] - px) * 8), (int)((sp_z[i] - pz) * 8));
    if (s_hobo) add_item(9, 0, (int)((hob_x - px) * 8), (int)((hob_z - pz) * 8)); if (s_dealer) add_item(9, 1, (int)((dea_x - px) * 8), (int)((dea_z - pz) * 8));
    if (carry_q) add_item(10, 0, (int)(-fx * 4), (int)(-fz * 4));
}
static void store_draw(int kind, int k)
{
    if (kind == 6) { const Cu *c = &cu[k]; person(c->x, 0, c->z, c->yaw, 1, c->col, c->skin, c->anim, c->st == CS_ROB ? 1.4f : c->st == CS_STUN ? 0.2f : 0); }
    else if (kind == 7)
    {   int n = sstock[k]; float top = k == 5 ? 2.0f : 1.75f, w = sh_w[k] < 0 ? -sh_w[k] : sh_w[k]; int ax = sh_w[k] > 0; u16 col = PR[k].col | BIT(15);
        for (int i = 0; i < n && i < 12; i++) { float o = -w / 2 + (i + 0.5f) * w / 12; qbox(sh_cx[k] + (ax ? o : 0), top, sh_cz[k] + (ax ? 0 : o), 0.17f, 0.34f, 0.17f, 0, col); }
    }
    else if (kind == 8) qbox(sp_x[k], 0, sp_z[k], 0.5f, 0.03f, 0.4f, 0.6f, RGB15(10, 18, 28) | BIT(15));
    else if (kind == 9) { if (k == 0) person(hob_x, 0, hob_z, 1.57f, 1, RGB15(14, 11, 7) | BIT(15), RGB15(22, 16, 12) | BIT(15), 0, 0); else person(dea_x, 0, dea_z, -1.57f, 1.05f, RGB15(3, 3, 4) | BIT(15), RGB15(18, 13, 10) | BIT(15), 0, 0); }
    else if (kind == 10) qbox(px + sinf(yaw) * 0.55f, 0.9f, pz - cosf(yaw) * 0.55f, 0.3f, 0.35f, 0.3f, yaw, PR[carry_p].col | BIT(15));
}
