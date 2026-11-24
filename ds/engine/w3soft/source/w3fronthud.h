// HUD for FRONTIER mode (included by w3core.c after the text / rect helpers)
static void f_wrap(int x, int y, const char *s, int cols, u16 c)
{
    char line[48]; int n = 0, len = (int)strlen(s), i = 0;
    while (i < len) { int j = i + cols; if (j >= len) j = len; else { while (j > i && s[j] != ' ') j--; if (j == i) j = i + cols; } n = j - i; memcpy(line, s + i, n); line[n] = 0; text(x, y, line, c); y += 11; i = j; while (i < len && s[i] == ' ') i++; }
}
static void front_hud(void)
{
    u16 gold = RGB15(26, 22, 8), wh = RGB15(28, 28, 28), gr = RGB15(14, 14, 16), red = RGB15(28, 6, 6); char b[48];
    // crosshair: tight dot while aiming, open cross otherwise
    u16 cc = hitm ? red : RGB15(28, 31, 28); int aim = (w3_kh & KEY_L) != 0;
    if (!fdlg_open()) { if (aim) { rect(159, 95, 3, 1, cc); rect(160, 94, 1, 3, cc); rect(150, 95, 6, 1, cc); rect(165, 95, 6, 1, cc); } else { rect(156, 95, 5, 1, cc); rect(163, 95, 5, 1, cc); rect(161, 90, 1, 4, cc); rect(161, 98, 1, 4, cc); } }
    rect(0, 192, 320, 48, RGB15(3, 2, 2)); rect(0, 192, 320, 1, RGB15(14, 10, 5));
    if (fqa >= 0) { const u8 *q = F_QST(fqa); if (fqprog >= q[2]) { strcpy(b, "RETURN: "); strcat(b, (const char *)(q + 7)); } else { strcpy(b, (const char *)(q + 7)); char t[14]; strcat(b, " "); itoa_(t, fqprog); strcat(b, t); strcat(b, "/"); itoa_(t, q[2]); strcat(b, t); } text(4, 195, b, gold); }
    else text(4, 195, "NO JOB. TALK TO PEOPLE.", gr);
    text(4, 206, "HP", gr); bar(24, 208, 70, hp, maxhp, RGB15(24, 5, 5));
    if (nw) { char wn[13]; memcpy(wn, W[wsel].name, 12); wn[10] = 0; text(100, 206, wn, wh); cat_int(b, "", mag[wsel], "/", res[wsel]); text(190, 206, b, reload ? gold : wh); }
    cat_int(b, "$", fmoney, 0, 0); text(4, 217, b, RGB15(14, 28, 12)); if (fbounty) { cat_int(b, "BOUNTY $", fbounty, 0, 0); text(70, 217, b, red); }
    for (int i = 0; i < 3; i++) { strcpy(b, FSH[i]); char t[8]; itoa_(t, frep[i]); strcat(b, frep[i] >= 0 ? "+" : ""); strcat(b, t); text(4 + i * 84, 228, b, frep[i] >= 25 ? RGB15(12, 28, 12) : frep[i] <= -25 ? red : gr); }
    // minimap
    int mx = 270, my = 194, ms = 44; float half = H->half / 8.0f; if (half < 8) half = 60; float k = ms / (half * 2); rect(mx, my, ms, ms, RGB15(3, 3, 6));
    for (int i = 0; i < nb; i++) { const Cb *c = &cb[i]; if (c->y1 < 1) continue; rect(mx + (int)((c->x0 + half) * k), my + (int)((c->z0 + half) * k), (int)((c->x1 - c->x0) * k) + 1, (int)((c->z1 - c->z0) * k) + 1, RGB15(9, 8, 8)); }
    for (int i = 0; i < ne0; i++) { int ni = f_npc_of(i); if (ni >= 0 && F_NPC(ni)[4] != 4) rect(mx + (int)((E0[i].x / 8.0f + half) * k), my + (int)((E0[i].z / 8.0f + half) * k), 2, 2, RGB15(10, 18, 28)); }
    for (int i = 0; i < nen; i++) if (en[i].alive) rect(mx + (int)((en[i].x + half) * k), my + (int)((en[i].z + half) * k), 2, 2, red);
    int ppx = mx + (int)((px + half) * k), ppz = my + (int)((pz + half) * k); rect(ppx - 1, ppz - 1, 3, 3, wh);
    // dead eye meter
    rect(4, 178, 62, 8, RGB15(2, 2, 3)); rect(5, 179, (int)(fdeadm * 60 / 100), 6, fdeadon ? RGB15(31, 22, 6) : RGB15(20, 14, 5)); text(70, 178, "DEAD EYE", fdeadon ? gold : gr);
    if (fmsgt) { rect(0, 0, 320, 12, RGB15(2, 2, 3)); text(4, 2, fmsg, gold); }
    if (fnear >= 0 && fdlg < 0 && !fduel) { int ni = f_npc_of(fnear); const u8 *n = F_NPC(ni); if (!f_down[ni]) { strcpy(b, fmount >= 0 ? "A  DISMOUNT" : n[4] == 4 ? "A  MOUNT HORSE" : "A  TALK  "); if (n[4] != 4 && fmount < 0) strcat(b, (const char *)(n + 5)); text(160 - (int)strlen(b) * 4, 150, b, wh); } }
    else if (fmount >= 0 && fdlg < 0) text(116, 150, "A  DISMOUNT", wh);
    if (fdlg >= 0)
    {   rect(6, 92, 308, 96, RGB15(2, 2, 3)); rect(6, 92, 308, 1, gold); rect(6, 187, 308, 1, gold); const u8 *n = F_NPC(fnpc); text(12, 96, (const char *)(n + 5), gold); text(12 + 8 * 11, 96, rep_title(frep[n[0] % 3]), gr);
        f_wrap(12, 110, f_dlg_text(fdlg), 36, wh); int y = 140; for (int k2 = 0, v = 0; k2 < 3; k2++) { if (!f_opt_ok(fdlg, k2)) continue; text(12, y, v == fsel ? ">" : " ", gold); text(24, y, f_opt_label(fdlg, k2), v == fsel ? gold : wh); y += 12; v++; } }
    if (fduel) { const char *t = fduel == 1 ? "STEADY..." : fduel == 2 ? "DRAW!" : fmsg; if (fduel == 2) text(128, 70, t, red); else text(160 - (int)strlen(t) * 4, 70, t, gold); rect(0, 84, 320, 2, RGB15(10, 6, 4)); }
    if (state == 1) text(80, 70, "YOU ARE A LEGEND  A=AGAIN", gold); else if (state == 2) text(96, 70, "YOU DIED  A=AGAIN", red);
}
