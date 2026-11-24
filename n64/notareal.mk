# (include after your `all:` target so the default goal stays yours)
# NOTAREAL N64 kit include. Put after `include $(N64_INST)/include/n64.mk`:
#   NOTAREAL_KIT := /path/to/notareal-kit/n64
#   include $(NOTAREAL_KIT)/notareal.mk
# Gives: device-safe IPL3 (boots on stock RetroArch ParaLLEl N64 / Mupen64Plus-Next on
# RG DS Plus stock OS and GammaOS), the logo splash object, and the logo sprite.
N64_ROM_HEADER := $(NOTAREAL_KIT)/ipl3_notareal.z64
# No compressed program: the boot loader would run the game's LZ4 decompressor, whose
# BGEZAL instructions crash the ARM64 recompiler in older ParaLLEl N64 builds.
N64_ROM_ELFCOMPRESS := 0
# mksprite compresses by default (level 1) -> force uncompressed sprites for the same reason.
N64_MKSPRITE := $(N64_MKSPRITE) -c 0
NOTAREAL_OBJS := $(BUILD_DIR)/notareal_splash.o $(BUILD_DIR)/rsp_nrcheck.o $(BUILD_DIR)/nr_memfix.o
CFLAGS += -I$(NOTAREAL_KIT)
N64_CFLAGS += -I$(NOTAREAL_KIT)
$(BUILD_DIR)/notareal_splash.o: $(NOTAREAL_KIT)/notareal_splash.c
	@mkdir -p $(dir $@)
	$(N64_CC) -c $(N64_CFLAGS) -o $@ $<
# memcpy/memset without SWL/SWR/SDL/SDR (ARM64 dynarec traps on them for uncached addresses)
$(BUILD_DIR)/nr_memfix.o: $(NOTAREAL_KIT)/nr_memfix.c
	@mkdir -p $(dir $@)
	$(N64_CC) -c $(N64_CFLAGS) -fno-builtin -fno-tree-loop-distribute-patterns -o $@ $<
filesystem/nr_logo.sprite: $(NOTAREAL_KIT)/nr_logo.png
	@mkdir -p $(dir $@)
	@$(N64_MKSPRITE) -f RGBA16 -o "$(dir $@)" "$<"
# RSP check microcode: n64.mk's RSP rule builds sources from $(SOURCE_DIR), so copy it in.
$(SOURCE_DIR)/rsp_nrcheck.S: $(NOTAREAL_KIT)/rsp_nrcheck.S
	@cp $< $@
