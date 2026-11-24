BLOCKSDS	?= /opt/blocksds/core
NAME		:= nr_godsim
GAME_TITLE	:= Cosmos Keeper
GAME_SUBTITLE	:= Notareal Game Studios
GAME_AUTHOR	:= Notareal Dev Kit
BINDIRS		:= data
include $(BLOCKSDS)/sys/default_makefiles/rom_arm9/Makefile
# DS-only header: every launcher boots it in plain DS mode (same as ICW)
NDSTOOL_ARGS	+= -uc 0
# Kit ARM7 (from ICW): sound + input over a polled shared-memory mailbox, no FIFO interrupts (DraStic drops them)
ARM7ELF		:= ../../arm7/arm7_minimal.elf
