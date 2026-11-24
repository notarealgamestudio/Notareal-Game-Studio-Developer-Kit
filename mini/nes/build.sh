set -e; cd "$(dirname "$0")"
cl65 -t nes -C nr_nes.cfg -Osir -DHAL_SCR_W=256 -DHAL_SCR_H=240 -DHAL_NCOL=33 -DHAL_RING=64 -Wl -m,nr_mini_nes.map $NRDBGFLAG --asm-include-dir /usr/share/cc65/asminc -DNRMODE=${NRMODE:-0} -DRS=2 $([ "${NRMODE:-0}" != 0 ] && echo -DNRD_SIZE=14000) -o ${OUT:-nr_mini_nes.nes} ../src/game.c hal_nes.c 2>&1 | grep -v "^$" || true
ls -la ${OUT:-nr_mini_nes.nes}
