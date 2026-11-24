// The ICW story/world/save parts are not in this engine: the symbols the shared match code still reads are defined here.
#include "icw.h"
int story_prog[8], story_align[8], money, spirit_bonus, has_handheld, toys;
int save_write(const void *d, int n) { (void)d; (void)n; return 0; }
int save_read(void *d, int n) { (void)d; (void)n; return 0; }
