/* headless GBA runner for tests: gbarun rom "run:120 key:8 run:10 key:0 shot:/tmp/a.ppm ..."  (keys are a bitmask: A1 B2 SEL4 START8 R16 L32 U64 D128) */
#include <mgba/core/core.h>
#include <mgba/core/config.h>
#include <mgba-util/vfs.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main(int argc, char **argv) {
    struct mCore *core = mCoreFind(argv[1]); if (!core) return 2;
    core->init(core); mCoreLoadFile(core, argv[1]); mCoreConfigInit(&core->config, NULL); mCoreConfigSetDefaultValue(&core->config, "idleOptimization", "ignore");
    unsigned w, h; core->desiredVideoDimensions(core, &w, &h); uint32_t *buf = calloc(w * h, 4); core->setVideoBuffer(core, buf, w); core->reset(core);
    char *cmds = strdup(argv[2]), *tok = strtok(cmds, " "); uint32_t keys = 0;
    while (tok) {
        if (!strncmp(tok, "run:", 4)) { int n = atoi(tok + 4); while (n--) { core->setKeys(core, keys); core->runFrame(core); } }
        else if (!strncmp(tok, "key:", 4)) keys = atoi(tok + 4);
        else if (!strncmp(tok, "peek:", 5)) { unsigned a = strtoul(tok + 5, NULL, 16); printf("%08x = %04x %04x\n", a, core->busRead16(core, a), core->busRead16(core, a + 2)); }
        else if (!strncmp(tok, "shot:", 5)) { FILE *f = fopen(tok + 5, "wb"); fprintf(f, "P6\n%u %u\n255\n", w, h); for (unsigned i = 0; i < w * h; i++) { uint32_t p = buf[i]; fputc(p & 255, f); fputc((p >> 8) & 255, f); fputc((p >> 16) & 255, f); } fclose(f); }
        tok = strtok(NULL, " ");
    }
    core->deinit(core); return 0;
}
