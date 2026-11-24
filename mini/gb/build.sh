set -e; cd "$(dirname "$0")"; G=${GBDK:-/tmp/gbdk}
$G/bin/lcc -Wa-l -Wl-m -Wl-j -DHAL_SCR_W=160 -DHAL_SCR_H=144 -DHAL_NRD_AT=0x4000 -DHAL_NCOL=21 -DHAL_RING=32 -Wf--opt-code-speed -Wf--max-allocs-per-node50000 -Wm-yc $NRDBGFLAG -Wm-yt0 -Wm-yn"NOTAREAL" -DNRMODE=${NRMODE:-0} -DRS=2 -o ${OUT:-nr_mini_gb.gb} ../src/game.c hal_gb.c
ls -la ${OUT:-nr_mini_gb.gb}
