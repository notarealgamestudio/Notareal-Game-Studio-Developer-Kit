// host build for development: ./w3host world.bin frames [shot frames...] -- keys "a-b:UP+A;..."   writes /tmp/w3h_<frame>.ppm
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
unsigned char hostbuf[65536];
#define HOST_DATA 1
#define nr_gamedata ((const unsigned char *)hostbuf)
#include "w3core.c"
static int frame, nshots, shots[16], nk, ka[96], kb[96]; static unsigned km[96]; static int total;
static unsigned hook(void)   // test hooks (W3POS=f:x:z:yaw,...  W3CATCH=1  W3MOP=1  W3THIEF=f): teleport / auto-act so logic tests do not depend on long walks
{
    unsigned k = 0; const char *e = getenv("W3POS");
    if (e) { char buf[256]; strncpy(buf, e, 255); buf[255] = 0; char *sv; for (char *t = strtok_r(buf, ",", &sv); t; t = strtok_r(0, ",", &sv)) { int f; float x, z, y; if (sscanf(t, "%d:%f:%f:%f", &f, &x, &z, &y) == 4 && f == frame) { px = x; pz = z; yaw = y; s_started = 1; } } }
    if (mode == M_FRONT) { if (getenv("W3DRAW") && fduel == 2) k |= KEY_B; if (getenv("W3EARLY") && fduel == 1 && fdt < 60) k |= KEY_B; const char *e2 = getenv("W3KILL"); if (e2) { char buf[128]; strncpy(buf, e2, 127); buf[127] = 0; char *sv; for (char *t = strtok_r(buf, ",", &sv); t; t = strtok_r(0, ",", &sv)) { int f, ty; if (sscanf(t, "%d:%d", &f, &ty) == 2 && f == frame) for (int i = 0; i < nen; i++) if (en[i].alive && en[i].type == ty) { en[i].alive = 0; break; } } } if (getenv("W3BOUNTY") && frame == 5) fbounty = 100; if (getenv("W3MONEY") && frame == 5) fmoney = atoi(getenv("W3MONEY")); if (getenv("W3HURTLAW") && frame == atoi(getenv("W3HURTLAW"))) for (int i = 0; i < nen; i++) if (en[i].alive && en[i].type == 2) { en[i].st = 2; break; } }
    if (getenv("W3THIEF") && frame == atoi(getenv("W3THIEF"))) spawn_cust(1);
    if (getenv("W3CATCH")) for (int i = 0; i < 8; i++) if (cu[i].alive && cu[i].role == 1 && cu[i].goal == G_FLEE && cu[i].st == CS_WALK) { px = cu[i].x + 0.6f; pz = cu[i].z; k |= KEY_B; }
    if (getenv("W3MOP")) for (int i = 0; i < 3; i++) if (sp_on[i]) { px = sp_x[i] + 0.5f; pz = sp_z[i]; k |= KEY_A; }
    return k;
}
unsigned h_keys(void) { unsigned k = hook(); for (int i = 0; i < nk; i++) if (frame >= ka[i] && frame <= kb[i]) k |= km[i]; return k; }
void h_blip(int hz, int ch) { (void)hz; (void)ch; }
void h_shot(int big) { (void)big; }
void h_present(const u16 *fb)
{
    for (int i = 0; i < nshots; i++) if (shots[i] == frame) { char n[64]; sprintf(n, "/tmp/w3h_%d.ppm", frame); FILE *f = fopen(n, "wb"); fprintf(f, "P6 320 240 255\n"); for (int p = 0; p < 320 * 240; p++) { u16 c = fb[p]; fputc((c & 31) << 3, f); fputc(((c >> 5) & 31) << 3, f); fputc(((c >> 10) & 31) << 3, f); } fclose(f); }
    if (getenv("W3FDBG") && mode == M_FRONT && frame % 20 == 0) fprintf(stderr, "F f%d near %d dlg %d sel %d money %d bounty %d rep %d %d %d qa %d prog %d done %d comp %d hp %d mount %d duel %d down %d deadon %d meter %.0f px %.1f pz %.1f state %d res0 %d\n", frame, fnear, fdlg, fsel, fmoney, fbounty, frep[0], frep[1], frep[2], fqa, fqprog, fqdone, fqcomp, hp, fmount, fduel, f_down[5], fdeadon, fdeadm, px, pz, state, res[0]);
    if (getenv("W3DBG") && frame % 60 == 0) fprintf(stderr, "f%d px %.1f pz %.1f yaw %.2f started %d min %d ncust %d\n", frame, px, pz, yaw, s_started, s_min, (cu[0].alive)+(cu[1].alive)+(cu[2].alive)+(cu[3].alive)); if (getenv("W3DBG") && frame % 60 == 0) fprintf(stderr, "   C[%d:%d:%d %d:%d:%d %d:%d:%d] regm %d tot %d paid %d give %d  sales %d till %d done %d rep %d c0st %d goal %d x %.1f  X stocked %d sst0 %d carry %d wallet %d mop %d caught %d stolen %d gus %d own1 %d loss %d state %d pay %d robdone %d\n", cu[1].alive, cu[1].st, cu[1].role, cu[2].alive, cu[2].st, cu[2].role, cu[3].alive, cu[3].st, cu[3].role, regm, reg_total, reg_paid, reg_give, s_sales, s_cash, s_done, s_rep, cu[0].st, cu[0].goal, cu[0].x, s_stocked, sstock[0], carry_q, s_wallet, s_mopped, s_caught, s_stolen, s_gusw, owned[1], s_loss, s_state, s_pay, s_robdone);
    if (++frame >= total) exit(0);
}
int main(int argc, char **argv)
{
    FILE *f = fopen(argv[1], "rb"); if (fread(hostbuf, 1, 65536, f) < 100) return 1; fclose(f); total = atoi(argv[2]);
    for (int i = 3; i < argc; i++) { if (!strcmp(argv[i], "--")) { char *sv1; for (char *s = strtok_r(argv[i + 1], ";", &sv1); s; s = strtok_r(0, ";", &sv1)) { int a, b; char names[64]; sscanf(s, "%d-%d:%s", &a, &b, names); unsigned m = 0; char *sv2; for (char *t = strtok_r(names, "+", &sv2); t; t = strtok_r(0, "+", &sv2)) { if (!strcmp(t, "UP")) m |= KEY_UP; if (!strcmp(t, "DOWN")) m |= KEY_DOWN; if (!strcmp(t, "LEFT")) m |= KEY_LEFT; if (!strcmp(t, "RIGHT")) m |= KEY_RIGHT; if (!strcmp(t, "A")) m |= KEY_A; if (!strcmp(t, "B")) m |= KEY_B; if (!strcmp(t, "L")) m |= KEY_L; if (!strcmp(t, "R")) m |= KEY_R; if (!strcmp(t, "Y")) m |= KEY_Y; if (!strcmp(t, "X")) m |= KEY_X; if (!strcmp(t, "SELECT")) m |= KEY_SELECT; } ka[nk] = a; kb[nk] = b; km[nk++] = m; } break; } shots[nshots++] = atoi(argv[i]); }
    w3_run(); return 0;
}
