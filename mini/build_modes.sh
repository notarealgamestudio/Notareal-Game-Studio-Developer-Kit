#!/bin/bash
# Builds every engine ROM: mode 0 platformer (original names), 1 racing, 2 RPG, 3 fighting, for GB, NES, GBA, N64, PSX.
# usage: build_modes.sh [modes...]   default: 0 1
set -e; cd "$(dirname "$0")"; export N64_INST=${N64_INST:-/opt/libdragon}; export PATH=$N64_INST/bin:$PATH
MODES=${@:-0 1}; NAMES=(plat race rpg fight fps)
for m in $MODES; do
  n=${NAMES[$m]}; sfx=$([ "$m" = 0 ] && echo "" || echo "_$n")
  echo "== mode $m ($n)"
  NRMODE=$m OUT=nr_mini${sfx}_gb.gb bash gb/build.sh | tail -1; cp gb/nr_mini${sfx}_gb.gb dist/
  NRMODE=$m OUT=nr_mini${sfx}_nes.nes bash nes/build.sh | tail -1; cp nes/nr_mini${sfx}_nes.nes dist/
  rm -f gba/game.o; NRMODE=$m bash gba/build.sh | tail -1; cp gba/nr_mini_gba.gba dist/nr_mini${sfx}_gba.gba
  rm -f n64/build/game.o; (cd n64 && rm -f nr_mini_n64.z64 && NRMODE=$m make 2>&1 | tail -1); cp n64/nr_mini_n64.z64 dist/nr_mini${sfx}_n64.z64
  (cd psx && NRMODE=$m cmake --build build 2>&1 | tail -1); f=$(ls psx/build/*.exe 2>/dev/null | head -1); [ -n "$f" ] && cp "$f" dist/nr_mini${sfx}_psx.exe
done
ls -la dist
