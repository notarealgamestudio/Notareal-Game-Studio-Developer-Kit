ifeq ($(strip $(PVSNESLIB_HOME)),)
export PVSNESLIB_HOME := /home/claude/tc/snes/pvsneslib
endif
export ROMNAME := nr_side2d
export ROMTITLE := NOTAREAL SIDE2D
export ROMSIZE := 0B
export ROMBANKS := 64
export FASTROM := 1
include ${PVSNESLIB_HOME}/devkitsnes/snes_rules
.PHONY: all
all: buildWithSummary
buildActual: $(OBJS) $(ROMNAME).sfc
clean: cleanBuildRes cleanRom cleanGfx
