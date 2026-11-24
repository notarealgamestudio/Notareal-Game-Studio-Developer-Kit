ENTRY(_start)
MEMORY { rom (rx) : ORIGIN = 0x08000000, LENGTH = 32M
         iwram (rwx) : ORIGIN = 0x03000000, LENGTH = 30K }
SECTIONS {
  .text : { *(.text.start) *(.text*) *(.rodata*) . = ALIGN(4); } > rom
  __data_lma = .;
  .data : AT(__data_lma) { __data_start = .; *(.data*) . = ALIGN(4); __data_end = .; } > iwram
  .bss (NOLOAD) : { __bss_start = .; *(.bss*) *(COMMON) . = ALIGN(4); __bss_end = .; } > iwram
  /DISCARD/ : { *(.ARM.exidx*) *(.comment) *(.note*) }
}
