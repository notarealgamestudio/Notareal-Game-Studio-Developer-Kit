ifeq ($(strip $(PVSNESLIB_HOME)),)
export PVSNESLIB_HOME := /home/claude/tc/snes/pvsneslib
endif
export ROMNAME := nr_kart
export ROMTITLE := NOTAREAL KART
export ROMSIZE := 09
export ROMBANKS := 16
export FASTROM := 1
include ${PVSNESLIB_HOME}/devkitsnes/snes_rules
.PHONY: all
all: buildWithSummary
buildActual: $(OBJS) $(ROMNAME).sfc
clean: cleanBuildRes cleanRom cleanGfx
