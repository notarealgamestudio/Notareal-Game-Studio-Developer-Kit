// STORE MODE HUD + overlays (included by w3core.c after the HUD helpers).
static void ov_box(int x, int y, int w, int h) { rect(x, y, w, h, RGB15(3, 2, 6)); for (int i = x; i < x + w; i++) { px2(i, y, RGB15(24, 20, 6)); px2(i, y + h - 1, RGB15(24, 20, 6)); } for (int j = y; j < y + h; j++) { px2(x, j, RGB15(24, 20, 6)); px2(x + w - 1, j, RGB15(24, 20, 6)); } }
static void store_hud(void)
{
    u16 gold = RGB15(26, 22, 8), wh = RGB15(28, 28, 28), gr = RGB15(14, 14, 16), gn = RGB15(8, 26, 10); char b[48], t[20];
    rect(0, 192, 320, 48, RGB15(2, 2, 5)); text(4, 195, H->title, gold); clock_s(t, s_min); text(200, 195, t, wh);
    strcpy(b, "SALES "); money(t, s_sales); strcat(b, t); strcat(b, "/"); money(t, s_goal); strcat(b, t); text(4, 206, b, s_sales >= s_goal ? gn : wh);
    text(180, 206, "REP", gr); bar(206, 208, 58, s_rep, 100, s_rep > 35 ? RGB15(8, 22, 10) : RGB15(24, 5, 5));
    strcpy(b, "TILL "); money(t, s_cash); strcat(b, t); text(4, 218, b, wh); strcpy(b, "WALLET "); money(t, s_wallet); strcat(b, t); text(104, 218, b, gr);
    { char w[12]; static const char *SN[4] = { "FIST", "BAT", "SPRAY", "TASER" }; strcpy(w, SN[wcur]); if (wcur >= 2) { char n[6]; itoa_(n, ammo[wcur]); strcat(w, " "); strcat(w, n); } text(212, 218, w, gold); }
    if (carry_q) { strcpy(b, "CARRY "); strcat(b, PR[carry_p].n); text(4, 230, b, PR[carry_p].col | BIT(15)); } else if (prompt) text(4, 230, prompt, gold);
    int mx = 270, my = 194, ms = 44; float half = 45, k = ms / (half * 2); rect(mx, my, ms, ms, RGB15(3, 3, 6));
    for (int i = 0; i < nb; i++) { const Cb *c = &cb[i]; if (B[i].kind == 3) continue; int x0 = mx + (int)((c->x0 + half) * k), z0 = my + (int)((c->z0 + half) * k + 6), w = (int)((c->x1 - c->x0) * k) + 1, d = (int)((c->z1 - c->z0) * k) + 1; if (z0 + d > my + ms) continue; rect(x0, z0, w, d, c->y1 > 6 ? RGB15(8, 8, 10) : RGB15(11, 10, 9)); }
    for (int i = 0; i < 8; i++) if (cu[i].alive) rect(mx + (int)((cu[i].x + half) * k), my + 6 + (int)((cu[i].z + half) * k), 2, 2, cu[i].role ? RGB15(28, 4, 4) : RGB15(8, 24, 8));
    rect(mx + (int)((px + half) * k) - 1, my + 6 + (int)((pz + half) * k) - 1, 3, 3, wh);
    if (s_msgt) { int n = (int)strlen(s_msg); rect(160 - n * 4 - 4, 176, n * 8 + 8, 11, RGB15(3, 2, 6)); text(160 - n * 4, 178, s_msg, gold); }
    if (regm)
    {   ov_box(28, 36, 264, 122); text(124, 42, "REGISTER", gold); strcpy(b, "TOTAL  "); money(t, reg_total); strcat(b, t); text(44, 62, b, wh); strcpy(b, "PAID   "); money(t, reg_paid); strcat(b, t); text(44, 76, b, wh);
        strcpy(b, "CHANGE "); money(t, reg_give); strcat(b, t); text(44, 94, b, gold); text(40, 114, "UP/DOWN $1  L/R 5C (R=25C)", gr); text(40, 126, "A: GIVE CHANGE   B: BACK", gr); text(40, 138, "SHORT CHANGE COSTS REP", gr); }
    if (shopm)
    {   ov_box(50, 30, 220, 130); text(104, 36, "MACK'S TRUNK", gold); static const char *NM[5] = { "", "ALUMINUM BAT", "PEPPER SPRAY", "TASER", "REFILL CHARGES" }; static const int PRC[5] = { 0, 2500, 4000, 6000, 1000 };
        for (int i = 1; i <= 4; i++) { strcpy(b, i == mk_sel ? "> " : "  "); strcat(b, NM[i]); text(58, 56 + (i - 1) * 16, b, i == mk_sel ? gold : wh); money(t, PRC[i]); text(210, 56 + (i - 1) * 16, i < 4 && owned[i] ? "OWNED" : t, gr); }
        strcpy(b, "WALLET "); money(t, s_wallet); strcat(b, t); text(58, 128, b, wh); text(58, 142, "UP/DOWN  A BUY  B LEAVE", gr); }
    if (s_state == 1)
    {   ov_box(50, 24, 220, 150); text(104, 30, "SHIFT OVER", gold); strcpy(b, "SALES  "); money(t, s_sales); strcat(b, t); text(60, 50, b, wh); strcpy(b, "GOAL   "); money(t, s_goal); strcat(b, t); text(60, 62, b, s_sales >= s_goal ? gn : RGB15(28, 8, 8));
        strcpy(b, "LOSSES "); money(t, s_loss); strcat(b, t); text(60, 74, b, gr); cat_int(b, "CUSTOMERS ", s_done, "  CAUGHT ", s_caught); text(60, 86, b, wh); cat_int(b, "STOCKED ", s_stocked, "  MOPPED ", s_mopped); text(60, 98, b, wh);
        strcpy(b, "PAY    "); money(t, s_pay); strcat(b, t); text(60, 114, b, gold); text(60, 128, s_sales >= s_goal ? "GOAL MET - BONUS PAID" : "GOAL MISSED - NO BONUS", gr); text(60, 150, "A: NEXT SHIFT", gold); }
}
