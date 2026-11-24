NRMODE ?= 0
BUILD_DIR=build
LIBDRAGON_PREVIEW = 2
include $(N64_INST)/include/n64.mk
N64_TOOLFLAGS += --size 2M
N64_ROM_ELFCOMPRESS := 0
N64_CFLAGS += -Wno-misleading-indentation -Wno-unused-variable -Wno-unused-function -Wno-error -std=gnu99 -DHAL_SCR_W=240 -DHAL_SCR_H=160 -DHAL_NCOL=31 -DHAL_RING=64 -DNRMODE=$(NRMODE) -DNR3D
NOTAREAL_KIT := /home/claude/notareal-kit/n64
all: nr_mini_n64.z64
include $(NOTAREAL_KIT)/notareal.mk
src = hal_n64.c nrd_n64.c ../src/game.c
$(BUILD_DIR)/nr_mini_n64.dfs: filesystem/nr_logo.sprite
$(BUILD_DIR)/nr_mini_n64.elf: $(BUILD_DIR)/hal_n64.o $(BUILD_DIR)/game.o $(BUILD_DIR)/nrd_n64.o $(NOTAREAL_OBJS)
$(BUILD_DIR)/game.o: ../src/game.c
	@mkdir -p $(dir $@)
	$(N64_CC) -c $(N64_CFLAGS) -o $@ $<
nr_mini_n64.z64: N64_ROM_TITLE="NOTAREAL GAME"
nr_mini_n64.z64: N64_ROM_HEADER=$(NOTAREAL_KIT)/ipl3_notareal.z64
nr_mini_n64.z64: $(BUILD_DIR)/nr_mini_n64.dfs
clean:
	rm -rf $(BUILD_DIR) filesystem nr_mini_n64.z64
