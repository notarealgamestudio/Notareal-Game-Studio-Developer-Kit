// FRONTIER MODE (mode 4) for the N64 / PlayStation software engine: a third-person western shooter.
// Red Dead Redemption (horse, duels, bounty, Dead Eye) x Fallout New Vegas (factions, reputation titles, dialogue choices, quests) x Gun (a dusty, hard frontier).
// World = W3DW boxes / entities (people are entities of type 8 with flags = index into the FRNT people table); FRNT = factions, people, dialogues, quests (kit/nr3d_frontier.js).
// Included by w3core.c before render3d(); the HUD half is w3fronthud.h.
#define MAXNPC 16
static u8 frbuf[4096]; static const u8 *FR; static int fnn, fnd, fnq;
#define F_FAC(i) ((const char *)(FR + 8 + (i) * 10))
#define F_NPC(i) (FR + 38 + (i) * 16)
#define F_DLG(i) (FR + 38 + fnn * 16 + (i) * 122)
#define F_QST(i) (FR + 38 + fnn * 16 + fnd * 122 + (i) * 24)
static const u8 EF[4] = { 1, 1, 0, 1 };                    // enemy type -> faction (bandit, gunman: outlaws; deputy: law; bounty hunter: outlaws)
static const char *FSH[3] = { "LAW", "OUT", "SET" };
static s16 f_ox[MAXE], f_oz[MAXE]; static u8 f_down[MAXNPC], f_hit[MAXE], f_prev[MAXE];
static int frep[3], fmoney, fbounty, fmount, fqa, fqprog, fqdone, fqcomp, fdeadon, fdlg, fsel, fnpc, fduel, fdt, fskill, fdraw, fpress, fnear, fnearc;
static float fdeadm; static int fdlgs;      // dead eye meter 0..100; fdlgs = selectable option count in the open dialogue
static char fmsg[40]; static int fmsgt;
static void fsay(const char *s) { strncpy(fmsg, s, 39); fmsg[39] = 0; fmsgt = 150; }
static int fclamp(int v) { return v < -100 ? -100 : v > 100 ? 100 : v; }
static const char *rep_title(int r) { return r <= -60 ? "HATED" : r <= -25 ? "DISLIKED" : r < 25 ? "NEUTRAL" : r < 60 ? "LIKED" : "IDOLIZED"; }
static void front_load(void)
{
    const u8 *g = nr_gamedata; FR = 0; unsigned used = rd32(g + 12), count = rd32(g + 16);
    if (used) for (unsigned i = 0; i < count; i++) { const u8 *s = g + 20 + i * 12; if (memcmp(s, "FRNT", 4) || rd32(s + 8) > sizeof frbuf) continue; memcpy(frbuf, g + rd32(s + 4), rd32(s + 8)); FR = frbuf; fnn = FR[1]; fnd = FR[2]; fnq = FR[3]; if (fnn > MAXNPC) fnn = MAXNPC; }
    for (int i = 0; i < ne0 && i < MAXE; i++) { f_ox[i] = E0[i].x; f_oz[i] = E0[i].z; }
}
static int f_passive(const En *n) { int f = EF[n->type & 3]; if (f == 0) return !(fbounty > 0 || frep[0] <= -20); if (f == 1) return frep[1] >= 25; return 1; }
static int f_npc_of(int ent) { return E0[ent].type == 8 && E0[ent].flags < fnn ? E0[ent].flags : -1; }
static void front_new(void)
{
    tp = 1; fmount = -1; fqa = -1; fqprog = fqdone = fqcomp = 0; fdeadon = 0; fdeadm = 30; fdlg = -1; fduel = 0; fmoney = H->pad2[0]; fbounty = 0; fmsgt = 0; mount_h = 0; aim_cone = 0.992f; cam_dist = 4.2f; cam_side = 0;
    for (int i = 0; i < 3; i++) frep[i] = 0; memset(f_down, 0, sizeof f_down); memset(f_hit, 0, sizeof f_hit);
    for (int i = 0; i < ne0 && i < MAXE; i++) { Ent *e = (Ent *)&E0[i]; e->x = f_ox[i]; e->z = f_oz[i]; }
    for (int i = 0; i < MAXE; i++) f_prev[i] = i < nen ? en[i].alive : 0;
    goal = H->goal ? H->goal : 3; killsNeeded = 0; fsay("WELCOME TO THE FRONTIER");
}
// ---- dialogue
static int f_dlg_for(int ni)
{
    const u8 *n = F_NPC(ni); int q = n[3];
    if (q != 255 && q < fnq) { if (fqdone & (1 << q)) return 253; if (fqa == q) return fqprog >= F_QST(q)[2] ? (n[2] != 255 ? n[2] : 252) : 252; }
    return n[1] == 255 ? 252 : n[1];
}
static const char *f_dlg_text(int d) { return d == 253 ? "GOOD WORKING WITH YOU." : d == 252 ? "NOTHING MORE TO SAY." : (const char *)F_DLG(d); }
static int f_opt_ok(int d, int k) { if (d >= 250) return k == 0; const u8 *o = F_DLG(d) + 44 + k * 26; if (!o[0]) return 0; if (o[24] != 255 && frep[o[24] % 3] < (signed char)o[25]) return 0; return 1; }
static const char *f_opt_label(int d, int k) { return d >= 250 ? "LEAVE" : (const char *)(F_DLG(d) + 44 + k * 26); }
static void f_start_duel(int ni, int skill);
static void f_effect(int d, int k)
{
    if (d >= 250) { fdlg = -1; return; }
    const u8 *o = F_DLG(d) + 44 + k * 26; int eff = o[20], a1 = o[21], a2 = (signed char)o[22], next = o[23]; char b[40];
    switch (eff)
    {   case 1: frep[a1 % 3] = fclamp(frep[a1 % 3] + a2); strcpy(b, FSH[a1 % 3]); strcat(b, a2 >= 0 ? " STANDING UP" : " STANDING DOWN"); fsay(b); break;
        case 2: fmoney += a1 * 5; fsay("PAID"); break;
        case 3: if (fmoney >= a1 * 5) fmoney -= a1 * 5; else fsay("NOT ENOUGH MONEY"); break;
        case 4: if (fqa >= 0) fsay("FINISH YOUR OTHER JOB"); else { fqa = a1; fqprog = 0; fsay("NEW JOB"); sfx_blip(1300, 0); } break;
        case 5: if (fqa >= 0 && fqprog >= F_QST(fqa)[2]) { const u8 *q = F_QST(fqa); fmoney += q[4] * 5; frep[q[5] % 3] = fclamp(frep[q[5] % 3] + (signed char)q[6]); fqdone |= 1 << fqa; fqcomp++; fqa = -1; fsay("JOB DONE  PAID"); sfx_blip(1800, 0); sfx_blip(2200, 1); } else fsay("NOT DONE YET"); break;
        case 6: if (fmoney >= a1 * 5) { fmoney -= a1 * 5; for (int w = 0; w < nw && w < 4; w++) res[w] += a2; fsay("AMMO"); } else fsay("NOT ENOUGH MONEY"); break;
        case 7: if (fmoney >= a1 * 5) { fmoney -= a1 * 5; hp += a2; if (hp > maxhp) hp = maxhp; fsay("PATCHED UP"); } else fsay("NOT ENOUGH MONEY"); break;
        case 8: f_start_duel(fnpc, a1); return;
        case 9: if (!fbounty) fsay("NO BOUNTY ON YOU"); else if (fmoney >= fbounty) { fmoney -= fbounty; fbounty = 0; frep[0] = fclamp(frep[0] + 5); fsay("BOUNTY PAID"); } else fsay("NOT ENOUGH MONEY"); break;
    }
    if (next != 255 && next < fnd) { fdlg = next; fsel = 0; } else fdlg = -1;
}
static void f_dialogue_step(void)
{
    u32 kd = w3_kd; int n = 0, vis[3]; for (int k = 0; k < 3; k++) if (f_opt_ok(fdlg, k)) vis[n++] = k; fdlgs = n; if (fsel >= n) fsel = n - 1; if (fsel < 0) fsel = 0;
    if (kd & KEY_UP && fsel > 0) { fsel--; sfx_blip(800, 1); } if (kd & KEY_DOWN && fsel < n - 1) { fsel++; sfx_blip(800, 1); }
    if (kd & KEY_B) { fdlg = -1; return; }
    if (kd & KEY_A && n) { sfx_blip(1200, 0); f_effect(fdlg, vis[fsel]); }
}
// ---- duel at high noon
static void f_start_duel(int ni, int skill)
{
    int e = -1; for (int i = 0; i < ne0; i++) if (f_npc_of(i) == ni) e = i; if (e < 0) { fdlg = -1; return; }
    float nx = E0[e].x / 8.0f, nz = E0[e].z / 8.0f; px = nx; pz = nz + (nz < 0 ? 8.0f : -8.0f); yaw = nz < 0 ? 0 : 3.1416f; py = floor_at(px, pz, 50, RAD); pit = 0;
    if (fmount >= 0) { fmount = -1; mount_h = 0; } fdlg = -1; fduel = 1; fdt = 90 + rnd() % 150; fskill = skill < 1 ? 1 : skill; fdraw = 0; fpress = 0; fsay("STEADY...");
    if (fqa < 0 && F_NPC(ni)[3] != 255 && !(fqdone & (1 << F_NPC(ni)[3]))) { fqa = F_NPC(ni)[3]; fqprog = 0; }
}
static void f_duel_step(void)
{
    u32 kd = w3_kd; int pressed = (kd & (KEY_B | KEY_R)) != 0;
    if (fduel == 1)
    {   if (pressed) { fduel = 4; fsay("TOO EARLY. YOU FLINCHED"); fdt = 120; hp -= 45; hurtf = 12; if (hp <= 0) { hp = 0; state = 2; } return; }
        if (--fdt <= 0) { fduel = 2; fdraw = 0; sfx_blip(2400, 0); fsay("DRAW!"); } return; }
    if (fduel == 2)
    {   fdraw++; int react = 40 - fskill * 7; if (react < 10) react = 10;
        if (pressed) { sfx_shot(0); if (fdraw <= react) { fduel = 3; fdt = 140; fsay("YOU WIN THE DRAW"); sfx_blip(1800, 0); fdeadm += 40; if (fdeadm > 100) fdeadm = 100;
                for (int i = 0; i < ne0; i++) if (f_npc_of(i) == fnpc) f_down[fnpc] = 1; if (fqa >= 0 && F_QST(fqa)[0] == 3) fqprog = F_QST(fqa)[2]; fmoney += 10; frep[1] = fclamp(frep[1] + 3); }
            else { fduel = 4; fdt = 120; fsay("TOO SLOW. YOU ARE SHOT"); hp -= 55; hurtf = 12; if (hp <= 0) { hp = 0; state = 2; } } return; }
        if (fdraw > react) { fduel = 4; fdt = 120; fsay("TOO SLOW. YOU ARE SHOT"); sfx_shot(1); hp -= 55; hurtf = 12; if (hp <= 0) { hp = 0; state = 2; } }
        return; }
    if (--fdt <= 0) fduel = 0;
}
// ---- main step
static void f_kill(int i)
{
    int f = EF[en[i].type & 3]; fmoney += ET[en[i].type].score / 20; fdeadm += 22; if (fdeadm > 100) fdeadm = 100;
    if (f == 0) { fbounty += 50; frep[0] = fclamp(frep[0] - 15); frep[1] = fclamp(frep[1] + 5); fsay("LAWMAN DOWN. BOUNTY UP"); }
    else if (f == 1) { frep[1] = fclamp(frep[1] - 8); frep[0] = fclamp(frep[0] + 4); frep[2] = fclamp(frep[2] + 2); }
    if (fqa >= 0) { const u8 *q = F_QST(fqa); if (q[0] == 0 && q[3] == f && fqprog < q[2]) fqprog++; }
}
static void front_step(void)
{
    u32 kh = w3_kh, kd = w3_kd; if (state) { if (kd & KEY_A) new_game(); return; }
    if (fmsgt > 0) fmsgt--; if (hurtf > 0) hurtf--; if (hitm > 0) hitm--;
    if (fduel) { f_duel_step(); if (cdw > 0) cdw--; return; }
    if (fdlg >= 0) { f_dialogue_step(); return; }
    int aim = (kh & KEY_L) != 0, mounted = fmount >= 0;
    cam_dist = aim ? 2.4f : mounted ? 6.0f : 4.2f; cam_side = aim ? 0.85f : 0.0f; aim_cone = fdeadon ? 0.90f : aim ? 0.975f : 0.992f;
    float turn = aim ? 0.016f : 0.045f; if (kh & KEY_LEFT) yaw -= turn; if (kh & KEY_RIGHT) yaw += turn; if (yaw > 6.2832f) yaw -= 6.2832f; if (yaw < -6.2832f) yaw += 6.2832f;
    // dead eye: slows the world, widens the aim lock; meter drains while on
    if ((kd & KEY_Y)) { if (fdeadon) fdeadon = 0; else if (fdeadm >= 15) fdeadon = 1; }
    if (fdeadon) { fdeadm -= 0.45f; if (fdeadm <= 0) { fdeadm = 0; fdeadon = 0; } } else if (fdeadm < 100) fdeadm += 0.02f;
    float f = 0; if (kh & KEY_UP) f += 1; if (kh & KEY_DOWN) f -= 0.6f; if ((kh & KEY_UP) && (kh & KEY_DOWN)) f = 0;
    float spd = RUN * (mounted ? 2.1f : aim ? 0.45f : 0.85f), rad = mounted ? 0.75f : RAD, dt = 1.0f / 60.0f, mx = sinf(yaw) * f * spd * dt, mz = -cosf(yaw) * f * spd * dt;
    if (!blocked(px + mx, pz, py, 1.7f, rad)) px += mx; if (!blocked(px, pz + mz, py, 1.7f, rad)) pz += mz;
    float half = H->half / 8.0f; if (half > 8) { if (px > half - 1) px = half - 1; if (px < -half + 1) px = -half + 1; if (pz > half - 1) pz = half - 1; if (pz < -half + 1) pz = -half + 1; }
    py = floor_at(px, pz, py, rad); if (f) bob += mounted ? 0.35f : 0.2f; mount_h = mounted ? 0.9f : 0;
    if (mounted) { Ent *h = (Ent *)&E0[fmount]; h->x = (s16)(px * 8); h->z = (s16)(pz * 8); }
    // nearest person
    fnear = -1; fnearc = 0; { float bd = 3.2f * 3.2f; for (int i = 0; i < ne0; i++) { int ni = f_npc_of(i); if (ni < 0 || i == fmount) continue; float dx = E0[i].x / 8.0f - px, dz = E0[i].z / 8.0f - pz, d = dx * dx + dz * dz; if (d < bd) { bd = d; fnear = i; } } }
    if (kd & KEY_A)
    {   if (mounted) { fmount = -1; mount_h = 0; fsay("DISMOUNTED"); }
        else if (fnear >= 0) { int ni = f_npc_of(fnear); const u8 *n = F_NPC(ni);
            if (n[4] == 4) { fmount = fnear; fsay("ON THE HORSE. A TO GET OFF"); sfx_blip(700, 1); }
            else if (!f_down[ni]) { fnpc = ni; int d = f_dlg_for(ni); if (d == 252 && n[4] == 3 && !(fqdone & 8)) d = n[1]; fdlg = d; fsel = 0; sfx_blip(900, 0); } } }
    // weapons
    if (kh & KEY_X) { if (reload == 0 && mag[wsel] < W[wsel].mag && res[wsel] > 0) reload = W[wsel].reload; }
    if (kd & KEY_SELECT && nw > 1) { wsel = (wsel + 1) % (nw > 4 ? 4 : nw); cdw = 10; reload = 0; }
    if (cdw > 0) cdw--; if (reload > 0 && --reload == 0) { int n = W[wsel].mag - mag[wsel]; if (n > res[wsel]) n = res[wsel]; mag[wsel] += n; res[wsel] -= n; sfx_blip(500, 0); }
    if (nw && ((kd & (KEY_B | KEY_R)) || (W[wsel].autof && (kh & (KEY_B | KEY_R))))) fire();
    // pickups: 5 tonic, 6 ammo, 7 loot crate (cash; counts for a fetch job)
    for (int i = 0; i < npk; i++) { Pk *k = &pk[i]; if (k->taken) continue; float dx = k->x - px, dz = k->z - pz; if (dx * dx + dz * dz > 2.0f * 2.0f) continue; k->taken = 1; sfx_blip(1200, 1);
        if (k->type == 5) { hp += 30; if (hp > maxhp) hp = maxhp; fsay("TONIC"); } else if (k->type == 6) { for (int q = 0; q < nw && q < 4; q++) res[q] += W[q].mag; fsay("AMMO"); }
        else { fmoney += 5 + rnd() % 11; fsay("LOOT"); if (fqa >= 0 && F_QST(fqa)[0] == 1 && fqprog < F_QST(fqa)[2]) { fqprog++; fsay("CRATE RECOVERED"); } } }
    // the law and the outlaws only mind you when you give them reason
    if ((frames & 31) == 0) for (int i = 0; i < nen; i++) if (en[i].alive && en[i].st == 1 && f_passive(&en[i])) en[i].st = 0;
    for (int i = 0; i < nen; i++) if (en[i].alive && EF[en[i].type & 3] == 0 && en[i].st == 2 && !f_hit[i]) { f_hit[i] = 1; fbounty += 25; fsay("YOU ARE WANTED"); }
    if (!fdeadon || frames % 3 == 0) step_enemies();
    for (int i = 0; i < nen && i < MAXE; i++) { if (f_prev[i] && !en[i].alive) f_kill(i); f_prev[i] = en[i].alive; }
    if (fqa >= 0 && fqprog >= F_QST(fqa)[2] && !(fmsgt && fmsg[0] == 'R')) { static int told = -1; if (told != fqa) { told = fqa; fsay("RETURN TO THE JOB GIVER"); } }
    if (fqcomp >= goal) { state = 1; fsay("YOU ARE A LEGEND"); sfx_blip(2000, 0); }
}
// ---- drawing (people, horses)
static int fdlg_open(void) { return fdlg >= 0; }
static int f_moving(void) { return (w3_kh & (KEY_UP | KEY_DOWN)) != 0; }
static void f_horse(float x, float z, float yaw_, int gait)
{
    float y = floor_at(x, z, 20, 0.4f), sw = sinf(frames * 0.3f) * 0.18f * gait; u16 br = RGB15(15, 9, 5) | BIT(15), dk = RGB15(8, 5, 3) | BIT(15);
    qbox(x, y + 0.5f, z, 0.32f, 0.62f, 0.95f, yaw_, br);                       // body
    float s = sinf(yaw_), c = cosf(yaw_);
    qbox(x - s * 1.15f, y + 0.95f, z + c * 1.15f, 0.18f, 0.55f, 0.3f, yaw_, br);   // neck + head (forward = -z in local space)
    qbox(x + s * 1.0f, y + 0.9f, z - c * 1.0f, 0.06f, 0.5f, 0.06f, yaw_ + sw, dk);  // tail
    for (int i = 0; i < 4; i++) { float lx = (i & 1 ? 0.2f : -0.2f), lz = (i & 2 ? 0.7f : -0.7f); qbox(x + lx * c + lz * s, y, z - lx * s + lz * c, 0.07f, 0.55f, 0.07f, yaw_, dk); (void)sw; }
}
static void front_npc(int ent)
{
    int ni = f_npc_of(ent); if (ni < 0) return; const u8 *n = F_NPC(ni); float x = E0[ent].x / 8.0f, z = E0[ent].z / 8.0f, y = floor_at(x, z, 20, .4f);
    float face = atan2f(px - x, -(pz - z)); if (fmount == ent) return;
    if (n[4] == 4) { f_horse(x, z, 0.4f + ent, 0); return; }
    u16 body = n[4] == 1 ? RGB15(8, 12, 26) : n[4] == 2 ? RGB15(20, 6, 6) : n[4] == 3 ? RGB15(5, 5, 6) : (u16)(RGB15(18, 14, 8) + ((ni * 5) & 7) * 33);
    if (f_down[ni]) { qbox(x, y, z, 0.7f, 0.3f, 0.3f, 0.5f, body | BIT(15)); return; }
    person(x, y, z, face, 1, body | BIT(15), RGB15(24, 18, 14) | BIT(15), 0, n[4] == 3 && fduel ? 1.4f : 0);
    if (n[4] == 1) qbox(x, y + 1.15f, z, 0.12f, 0.12f, 0.15f, face, RGB15(30, 26, 8) | BIT(15));   // badge
    if (n[4] == 3) qbox(x, y + 1.67f, z, 0.2f, 0.07f, 0.2f, face, RGB15(3, 3, 3) | BIT(15));        // hat
}
static void front_items(void) { if (fmount >= 0) add_item(12, 0, camx - (int)(px * 8) + 1, camz - (int)(pz * 8) + 1); }
static void front_draw(int kind) { if (kind == 12) f_horse(px, pz, yaw, f_moving()); }
static void front_post(void)
{
    if (!fdeadon) return;
    for (int i = 0; i < RW * RH; i++) { u16 c = fb3[i]; int l = ((c & 31) + ((c >> 5) & 31) + ((c >> 10) & 31)) / 3, r = l * 9 / 8, g = l * 7 / 8, b = l * 5 / 8; if (r > 31) r = 31; fb3[i] = RGB15(r, g, b) | BIT(15); }
}
