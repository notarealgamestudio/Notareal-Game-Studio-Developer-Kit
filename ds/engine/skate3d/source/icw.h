#ifndef ICW_H
#define ICW_H
#include <nds.h>
// Sound goes through our own shared-memory mailbox (snd.c) instead of libnds's FIFO messages.
void snd_enable(void);
int snd_play_sample(const void *data, int fmt, u32 bytes, int hz, int vol, int pan, int loop, int lp);
int snd_play_psg(int duty, int hz, int vol, int pan);
int snd_play_noise(int hz, int vol, int pan);
void snd_kill(int ch);
void snd_sample_ch(int ch, const void *data, u32 bytes, int fmt, int hz, int vol, int pan, int loop);
void snd_psg_ch(int ch, int duty, int hz, int vol, int pan);
void snd_noise_ch(int ch, int hz, int vol, int pan);
void snd_vol(int ch, int vol);
void snd_pitch(int ch, int hz);
void snd_stop(int ch);
void snd_master(int vol);
void snd_input(void);
#define soundEnable() snd_enable()
#define soundPlaySample(d, f, n, hz, v, p, l, lp) snd_play_sample((d), (f), (n), (hz), (v), (p), (l), (lp))
#define soundPlayPSG(duty, hz, v, p) snd_play_psg((duty), (hz), (v), (p))
#define soundPlayNoise(hz, v, p) snd_play_noise((hz), (v), (p))
#define soundKill(ch) snd_kill(ch)
#include <math.h>

// World units are metres; DS vertices top out near +/-8, so geometry is scaled by 1/4.
#define SC 0.25f
#define MAT_Y 1.2f
#define HALF 3.0f
// Display-list recorder: while g_rec is set, the draw helpers append packed GPU commands instead of
// sending them, so static geometry is converted from floats once and replayed with glCallList().
extern u32 *g_rec;
extern u32 g_reclen;
static inline void REC(u32 cmd, u32 p) { g_rec[g_reclen++] = cmd; g_rec[g_reclen++] = p; }
static inline void V(float x, float y, float z)
{
    v16 X = floattov16(x * SC), Y = floattov16(y * SC), Z = floattov16(z * SC);
    if (g_rec) { g_rec[g_reclen++] = 0x23; g_rec[g_reclen++] = (u16)X | ((u32)(u16)Y << 16); g_rec[g_reclen++] = (u16)Z; }
    else glVertex3v16(X, Y, Z);
}
static inline void T(int u, int v)
{
    if (g_rec) REC(0x22, (u16)inttot16(u) | ((u32)(u16)inttot16(v) << 16));
    else glTexCoord2t16(inttot16(u), inttot16(v));
}
static inline void C(int r, int g, int b)
{
    r = r > 255 ? 255 : r; g = g > 255 ? 255 : g; b = b > 255 ? 255 : b;
    if (g_rec) REC(0x20, RGB15(r >> 3, g >> 3, b >> 3));
    else glColor3b(r, g, b);
}
static inline void NRM(u32 n) { if (g_rec) REC(0x21, n); else glNormal(n); }
static inline void BEGIN(int type) { if (g_rec) REC(0x40, type); else glBegin(type); }
static inline void END(void) { if (g_rec) g_rec[g_reclen++] = 0x41; else glEnd(); }
static inline void BIND(int id)
{
    glBindTexture(0, id);
    if (g_rec) {
        REC(0x2A, glGetTexParameter());
        int pal = 0;                                  // palette base too: paletted textures (faces, storefronts) need their own
        if (id && glGetColorTableParameterEXT(0, GL_COLOR_TABLE_FORMAT_EXT, &pal) && pal >= 0) REC(0x2B, pal);
    }
}
static inline void PFMT(u32 v) { if (g_rec) REC(0x29, v); else glPolyFmt(v); }
static inline void DIFAMB(u16 dif, u16 amb) { if (g_rec) REC(0x30, dif | ((u32)amb << 16)); else { glMaterialf(GL_DIFFUSE, dif); glMaterialf(GL_AMBIENT, amb); } }
void rec_begin(void);
void rec_pool(u32 *buf);   // NULL = back to the shared pool
const u32 *rec_end(void);

extern int tMat, tApron, tCrowd, tFloor, tTron;
extern u32 frame;
int load_tex(const void *data, int w, int h, int repeat);
int load_tex_pal(const u16 *px, int w, int h, int repeat);
extern int tex_fail;
void poly(int alpha, int id);
void box(float x0, float y0, float z0, float x1, float y1, float z1, int r, int g, int b);
void draw_scene(void);
void build_arena(void);

// ---- wrestlers
typedef struct {
    float px, py, pz;          // pelvis offset from the standing position (m)
    float body, torso, head;   // body pitch (lying), torso lean, head nod (deg; + = forward)
    float sh[2], roll[2], el[2];   // shoulder forward raise, arm out, elbow bend  [0]=left [1]=right
    float hip[2], hroll[2], kn[2]; // hip forward raise, leg out, knee bend
    float twist, hipy, bank;       // torso twist over the hips, whole-body turn about the pelvis, sideways roll (deg)
} Pose;

typedef struct {
    u16 skin, hair, hair2, top, pants, boots, accent;
    float build;        // width scale: 1 normal, <1 skinny, >1 heavy
    float height;       // overall scale
    u8 hairstyle;       // 0 short, 1 mohawk+long back, 2 long, 3 ponytail
    u8 goatee, overalls, stripes, fem, face2x, vest, sleeveless;   // face2x: 128x128 photo face map
    int faceTex;        // cylindrical head texture (0 = none)
    const u32 *dl[16];   // baked body-part display lists (built by build_look)
} Look;

enum { HAIR_SHORT, HAIR_MOHAWK, HAIR_LONG, HAIR_PONY, HAIR_BUN, HAIR_BALD, HAIR_MULLET, HAIR_CURLY };

void draw_wrestler(const Look *lk, float x, float z, float yaw, const Pose *p, int polyid);
void pose_lerp(Pose *out, const Pose *a, const Pose *b, float t);
void lights_on(void);
int match_run(u16 *subfb, int player, int opp);
enum { MT_SINGLES, MT_NODQ, MT_FALLS, MT_CAGE, MT_LMS, MT_COUNT };
extern int match_type;
extern const char *const MATCH_TYPE_NAME[MT_COUNT];
void build_look(Look *lk);

// ---- UI text + create-a-wrestler
extern u16 ui_back[256 * 192];
void ui_flip(u16 *dst);
void input_scan(void);
u32 keys_down(void);
void touch_get(touchPosition *t);
int text_width(const u8 *font, const char *s);
void draw_text(u16 *fb, const u8 *font, int x, int y, const char *s, u16 col);
void draw_text_c(u16 *fb, const u8 *font, int cx, int y, const char *s, u16 col);
void fill_rect(u16 *fb, int x0, int y0, int x1, int y1, u16 col);
typedef struct { u8 on[4][16]; u8 note[2][16]; u8 tempo, key, used, pad; } Theme;
extern Theme caw_theme;
enum { SFX_HIT, SFX_SLAM, SFX_BELL, SFX_COUNT, SFX_CROWD, SFX_UI, SFX_OK, SFX_COIN, SFX_STEP };
void sfx(int kind);
void sfx_tick(void);
void bgm_start(int which);
void bgm_stop(void);
extern u16 caw_portrait[46 * 46];
void face_to_portrait(const u16 *tex64, u16 *out);
void seq_start(const Theme *t);
void seq_stop(void);
int seq_tick(void);
int seq_step(void);
int theme_used(const Theme *t);
void theme_run(u16 *sub, void (*top)(void));
const Theme *cast_theme(int id);
int keyboard(u16 *fb, char *name, int maxlen, void (*top)(void));
int save_write(const void *data, int size);
int save_read(void *data, int size);
extern Look caw_look;
extern int caw_fin;
extern char caw_name[20];
void caw_init(void);
void game_save(void);
extern int story_prog[8], story_align[8];
int pick_cast(u16 *sub, const char *title, const int *ids, int n, void (*top)(void));
void npc_look(Look *lk, int sex, int skin, int hair, int hairc, int eyes, int beard, int top, int pants, int boots, float height, float build);
void world_run(u16 *sub, int player);
void interior_run(u16 *sub, int player);
void story_run(u16 *sub, int player);
void house_run(u16 *sub, int player);
void intro_run(u16 *sub);
extern int money;
typedef struct {
    const char *title, *tag, *help;
    void (*init)(void); void (*cont)(void);
    int (*tick)(u32 kd, u32 kh); void (*draw)(int attract);
    int (*score)(void); void (*hud)(void);
} Arcade;
extern const Arcade ARC[8];
void arcade_free(u16 *sub, int cab, int free);
extern int spirit_bonus, has_handheld, toys;
void room_run(u16 *sub, int player, int id);
void arcade_play(int cab);
void camera_reset(void);
const Look *cast_look(int id);
enum { C_STEVE, C_AUSTIN, C_CAW, C_PYTHON, C_JOE, C_MICHELLE, C_DANNY, C_REBECCA, C_CLIFF, C_REF, C_SQUID, C_VANE, C_THIEF, C_MONTE, C_HEATHER, C_DEX, C_COUNT };
const char *cast_name(int id);
const void *cast_portrait(int id);
int cast_fin(int id);
int cast_heel(int id);
extern const char *FIN_NAME[4];
int load_face(const void *bin);
void build_look2(Look *lk, int lodonly);
extern int wr_lod;
void caw_run(u16 *sub);

#endif
