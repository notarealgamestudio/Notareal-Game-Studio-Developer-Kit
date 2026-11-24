BLOCKSDS	?= /opt/blocksds/core
NAME		:= nr_wrestling
GAME_TITLE	:= Notareal Wrestling
GAME_SUBTITLE	:= Made with Notareal Game Studio
GAME_AUTHOR	:= Notareal Dev Kit
BINDIRS		:= data
include $(BLOCKSDS)/sys/default_makefiles/rom_arm9/Makefile

# DS-only header: every launcher boots it in plain DS mode (the mode tested in DeSmuME and melonDS)
NDSTOOL_ARGS	+= -uc 0

# Our own ARM7 (../arm7): sound + input over a polled shared-memory mailbox instead of libnds FIFO messages
ARM7ELF		:= ../../arm7/arm7_minimal.elf
