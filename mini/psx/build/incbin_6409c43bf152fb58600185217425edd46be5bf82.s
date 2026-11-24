.section .data.nr_splash, "aw"
.balign 4

.global nr_splash
.type nr_splash, @object
.size nr_splash, (nr_splash_end - nr_splash)
nr_splash:
	.incbin "/home/claude/notareal-kit/mini/psx/assets/splash.raw"

.local nr_splash_end
nr_splash_end:

.balign 4

.section .data.nr_splash_size, "aw"
.balign 4

.global nr_splash_size
.type nr_splash_size, @object
.size nr_splash_size, 4
nr_splash_size:
	.int (nr_splash_end - nr_splash)
