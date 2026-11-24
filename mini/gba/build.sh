set -e; cd "$(dirname "$0")"
CC=arm-none-eabi-gcc; F="-mthumb -mcpu=arm7tdmi -mthumb-interwork -O2 -ffreestanding -fno-builtin -fno-strict-aliasing -std=gnu99 -Wall -Wno-unused-function -DHAL_SCR_W=240 -DHAL_SCR_H=160 -DHAL_NCOL=31 -DHAL_RING=64 -DNRMODE=${NRMODE:-0} $NRDBGFLAG"
$CC -mcpu=arm7tdmi -marm -c crt0.s -o crt0.o
$CC $F -c ../src/game.c -o game.o
$CC $F -c hal_gba.c -o hal_gba.o
$CC $F -c nrd.c -o nrd.o
$CC -nostartfiles -nostdlib -T gba.ld crt0.o game.o hal_gba.o nrd.o -lgcc -o nr_mini_gba.elf
arm-none-eabi-objcopy -O binary nr_mini_gba.elf nr_mini_gba.gba
ls -la nr_mini_gba.gba
