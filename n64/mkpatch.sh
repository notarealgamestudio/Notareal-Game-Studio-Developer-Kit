cd /home/claude/n64/libdragon
{
diff -u /tmp/emux.h.orig include/emux.h; diff -u /tmp/n64sys.h.orig include/n64sys.h; diff -u /tmp/cop0.h.orig include/cop0.h; diff -u /tmp/rsp.h.orig include/rsp.h; diff -u /tmp/rsp_queue.inc.orig include/rsp_queue.inc
for f in rand.c entropy.c rand_internal.h debug.c dma.c inthandler.S interrupt.c; do diff -u /tmp/$f.orig src/$f; done
diff -u /tmp/n64sys.c.orig src/n64sys.c; diff -u /tmp/display.c.orig src/display.c; diff -u /tmp/rsp.c.orig src/rsp.c; diff -u /tmp/rspq.c.orig2 src/rspq/rspq.c; diff -u /tmp/rdpq.c.orig src/rdpq/rdpq.c
diff -u /tmp/n64.mk.orig n64.mk; diff -u /tmp/audio.c.orig src/audio.c
} > /home/claude/notareal-kit/n64/libdragon_compat.patch
wc -l /home/claude/notareal-kit/n64/libdragon_compat.patch
