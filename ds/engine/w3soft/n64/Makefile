BUILD_DIR=build
LIBDRAGON_PREVIEW = 2
include $(N64_INST)/include/n64.mk
N64_TOOLFLAGS += --size 2M
N64_ROM_ELFCOMPRESS := 0
N64_CFLAGS += -Wno-misleading-indentation -Wno-unused-variable -Wno-unused-function -Wno-error -std=gnu99 -O2
NOTAREAL_KIT := /home/claude/notareal-kit/n64
all: nr_w3soft_n64.z64
include $(NOTAREAL_KIT)/notareal.mk
src = hal_n64.c ../source/nrg_data.c
$(BUILD_DIR)/nr_w3soft_n64.dfs: filesystem/nr_logo.sprite
$(BUILD_DIR)/nr_w3soft_n64.elf: $(BUILD_DIR)/hal_n64.o $(BUILD_DIR)/nrg_data.o $(NOTAREAL_OBJS)
$(BUILD_DIR)/nrg_data.o: ../source/nrg_data.c
	@mkdir -p $(dir $@)
	$(N64_CC) -c $(N64_CFLAGS) -o $@ $<
nr_w3soft_n64.z64: N64_ROM_TITLE="NOTAREAL 3D WORLD"
nr_w3soft_n64.z64: N64_ROM_HEADER=$(NOTAREAL_KIT)/ipl3_notareal.z64
nr_w3soft_n64.z64: $(BUILD_DIR)/nr_w3soft_n64.dfs
clean:
	rm -rf $(BUILD_DIR) filesystem nr_w3soft_n64.z64
