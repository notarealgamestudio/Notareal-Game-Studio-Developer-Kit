/* Minimal headless libretro frontend for running ARM64 cores under qemu (NOTAREAL test rig). */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <dlfcn.h>
#include "libretro.h"
static const char *opt_keys[32], *opt_vals[32]; static int nopts;
static const void *last_frame; static unsigned fw, fh; static size_t fpitch; static long frames_with_data;
static unsigned char *fbcopy;
static void logcb(enum retro_log_level l, const char *fmt, ...) { va_list ap; va_start(ap, fmt); fprintf(stderr, "core[%d]: ", l); vfprintf(stderr, fmt, ap); va_end(ap); }
static bool env(unsigned cmd, void *data) {
  switch (cmd) {
  case RETRO_ENVIRONMENT_GET_VARIABLE: { struct retro_variable *v = data;
      for (int i = 0; i < nopts; i++) if (!strcmp(v->key, opt_keys[i])) { v->value = opt_vals[i]; return true; }
      return false; }
  case RETRO_ENVIRONMENT_GET_LOG_INTERFACE: ((struct retro_log_callback*)data)->log = logcb; return true;
  case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT: return true;
  case RETRO_ENVIRONMENT_GET_CAN_DUPE: *(bool*)data = true; return true;
  case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY: case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY: *(const char**)data = "/tmp"; return true;
  case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE: *(bool*)data = false; return true;
  default: return false; }
}
static void video(const void *d, unsigned w, unsigned h, size_t p) {
  if (d && d != RETRO_HW_FRAME_BUFFER_VALID) { frames_with_data++; fw = w; fh = h; fpitch = p;
    fbcopy = realloc(fbcopy, p * h); memcpy(fbcopy, d, p * h); }
}
static long aud_n, aud_nz; static int cur_frame;
static void audio(int16_t l, int16_t r) { aud_n++; if (l) aud_nz++; }
static size_t audio_batch(const int16_t *d, size_t n) { for (size_t i = 0; i < n; i++) { aud_n++; if (d[i*2]) aud_nz++; } return n; }
static void poll(void) {}
/* NRINPUT="from-to:BTN+BTN,..." BTN in B Y SELECT START UP DOWN LEFT RIGHT A X L R */
static int16_t input(unsigned port, unsigned dev, unsigned idx, unsigned id) {
  static const char *names[] = {"B","Y","SELECT","START","UP","DOWN","LEFT","RIGHT","A","X","L","R"};
  const char *sc = getenv("NRINPUT"); if (!sc || port || dev != 1 || id > 11) return 0;
  char buf[2048]; strncpy(buf, sc, 2047); buf[2047] = 0;
  for (char *tok = strtok(buf, ","); tok; tok = strtok(NULL, ",")) {
    int a, b; char btns[256]; if (sscanf(tok, "%d-%d:%255s", &a, &b, btns) != 3) continue;
    if (cur_frame < a || cur_frame > b) continue;
    char *save; for (char *n = strtok_r(btns, "+", &save); n; n = strtok_r(NULL, "+", &save)) if (!strcmp(n, names[id])) return 1;
  }
  return 0;
}
int main(int argc, char **argv) {
  if (argc < 4) { fprintf(stderr, "usage: fe core.so rom frames [key=val...]\n"); return 2; }
  for (int i = 4; i < argc && nopts < 32; i++) { char *e = strchr(argv[i], '='); if (!e) continue; *e = 0; opt_keys[nopts] = argv[i]; opt_vals[nopts++] = e + 1; }
  void *h = dlopen(argv[1], RTLD_NOW); if (!h) { fprintf(stderr, "dlopen: %s\n", dlerror()); return 3; }
#define S(n) typeof(&n) p_##n = dlsym(h, #n)
  S(retro_set_environment); S(retro_set_video_refresh); S(retro_set_audio_sample); S(retro_set_audio_sample_batch);
  S(retro_set_input_poll); S(retro_set_input_state); S(retro_init); S(retro_load_game); S(retro_run); S(retro_get_memory_data); S(retro_get_memory_size);
  p_retro_set_environment(env); p_retro_set_video_refresh(video); p_retro_set_audio_sample(audio);
  p_retro_set_audio_sample_batch(audio_batch); p_retro_set_input_poll(poll); p_retro_set_input_state(input);
  p_retro_init();
  FILE *f = fopen(argv[2], "rb"); fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);
  void *rom = malloc(n); fread(rom, 1, n, f); fclose(f);
  struct retro_game_info gi = { argv[2], rom, (size_t)n, NULL };
  if (!p_retro_load_game(&gi)) { fprintf(stderr, "load failed\n"); return 4; }
  int frames = atoi(argv[3]);
  for (int i = 0; i < frames; i++) { cur_frame = i; p_retro_run();
    if (getenv("SHOTS")) { char key[16]; snprintf(key, 16, ",%d,", i); char sl[1024]; snprintf(sl, 1024, ",%s,", getenv("SHOTS"));
      if (strstr(sl, key) && fbcopy) { char fn[64]; snprintf(fn, 64, "/tmp/shot_%05d.raw", i); FILE *o = fopen(fn, "wb"); fwrite(&fw, 4, 1, o); fwrite(&fh, 4, 1, o); fwrite(&fpitch, 8, 1, o); fwrite(fbcopy, fpitch, fh, o); fclose(o); } } }
  { void *m = p_retro_get_memory_data(RETRO_MEMORY_SYSTEM_RAM); size_t ms = p_retro_get_memory_size(RETRO_MEMORY_SYSTEM_RAM);
    if (m) { FILE *o = fopen(getenv("RAMOUT") ? getenv("RAMOUT") : "/tmp/arm_ram.bin", "wb"); fwrite(m, 1, ms, o); fclose(o); } }
  fprintf(stderr, "FE: ran %d frames, %ld with picture, audio %ld samples (%ld nonzero)\n", frames, frames_with_data, aud_n, aud_nz);
  if (fbcopy) { FILE *o = fopen("/tmp/arm_frame.raw", "wb"); fwrite(&fw, 4, 1, o); fwrite(&fh, 4, 1, o); fwrite(&fpitch, 8, 1, o); fwrite(fbcopy, fpitch, fh, o); fclose(o); }
  return 0;
}
