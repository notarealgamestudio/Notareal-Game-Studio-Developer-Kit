/* IEEE-754 single-precision soft-float for the PlayStation (R3000 has no FPU, and the cross-compiler's libgcc float helpers use FPU instructions).
 * Integer-only, no 64-bit maths. Round to nearest even; denormals flush to zero; NaN/Inf handled loosely (the engine never produces them). */
typedef unsigned int u32; typedef int i32;
union NF { float f; u32 u; };
static u32 fu(float x) { union NF v; v.f = x; return v.u; }
static float uf(u32 u) { union NF v; v.u = u; return v.f; }
#define SGN 0x80000000u
static float pack(u32 s, i32 e, u32 m, u32 rnd, u32 sticky)   /* m = 24-bit mantissa with leading 1, rnd = round bit, sticky = lower bits non-zero */
{
    if (rnd && (sticky || (m & 1))) { m++; if (m & 0x1000000u) { m >>= 1; e++; } }
    if (e >= 255) return uf(s | 0x7f800000u); if (e <= 0) return uf(s);
    return uf(s | ((u32)e << 23) | (m & 0x7fffffu));
}
float __addsf3(float x, float y)
{
    u32 a = fu(x), b = fu(y), ea = (a >> 23) & 255, eb = (b >> 23) & 255;
    if (ea == 255) return x; if (eb == 255) return y; if (ea == 0) return eb == 0 ? uf(0) : y; if (eb == 0) return x;
    u32 ma = (a & 0x7fffffu) | 0x800000u, mb = (b & 0x7fffffu) | 0x800000u;
    if (ea < eb || (ea == eb && ma < mb)) { u32 t = a; a = b; b = t; t = ea; ea = eb; eb = t; t = ma; ma = mb; mb = t; }
    u32 sa = a >> 31, sb = b >> 31; i32 d = (i32)(ea - eb), e = (i32)ea; ma <<= 3; mb <<= 3;
    if (d > 0) { if (d > 27) mb = 1; else { u32 st = (mb & ((1u << d) - 1)) != 0; mb = (mb >> d) | st; } }
    u32 m = sa == sb ? ma + mb : ma - mb;
    if (m == 0) return uf(0);
    if (sa == sb) { if (m & (1u << 27)) { m = (m >> 1) | (m & 1); e++; } }
    else while (!(m & (1u << 26))) { m <<= 1; e--; }
    u32 r = m & 7, mm = m >> 3;
    if (r > 4 || (r == 4 && (mm & 1))) { mm++; if (mm & 0x1000000u) { mm >>= 1; e++; } }
    if (e >= 255) return uf((sa << 31) | 0x7f800000u); if (e <= 0) return uf(0);
    return uf((sa << 31) | ((u32)e << 23) | (mm & 0x7fffffu));
}
float __subsf3(float x, float y) { return __addsf3(x, uf(fu(y) ^ SGN)); }
float __mulsf3(float x, float y)
{
    u32 a = fu(x), b = fu(y), s = (a ^ b) & SGN, ea = (a >> 23) & 255, eb = (b >> 23) & 255;
    if (ea == 0 || eb == 0) return uf(s); if (ea == 255 || eb == 255) return uf(s | 0x7f800000u);
    u32 ma = (a & 0x7fffffu) | 0x800000u, mb = (b & 0x7fffffu) | 0x800000u;
    u32 al = ma & 0xfff, ah = ma >> 12, bl = mb & 0xfff, bh = mb >> 12, ll = al * bl, mid = al * bh + ah * bl, hh = ah * bh;
    u32 s1 = ll + (mid << 12), c1 = s1 < ll, lo = s1 + (hh << 24), c2 = lo < s1, hi = (mid >> 20) + (hh >> 8) + c1 + c2;
    u32 q = (hi << 9) | (lo >> 23), rem = lo & 0x7fffffu; i32 e = (i32)ea + (i32)eb - 127;
    if (q & (1u << 24)) { u32 rnd = q & 1, sticky = rem != 0; return pack(s, e + 1, q >> 1, rnd, sticky); }
    return pack(s, e, q, (rem >> 22) & 1, (rem & 0x3fffffu) != 0);
}
float __divsf3(float x, float y)
{
    u32 a = fu(x), b = fu(y), s = (a ^ b) & SGN, ea = (a >> 23) & 255, eb = (b >> 23) & 255;
    if (eb == 0) return uf(s | 0x7f800000u); if (ea == 0) return uf(s); if (ea == 255) return uf(s | 0x7f800000u); if (eb == 255) return uf(s);
    u32 ma = (a & 0x7fffffu) | 0x800000u, mb = (b & 0x7fffffu) | 0x800000u; i32 e = (i32)ea - (i32)eb + 127;
    if (ma < mb) { ma <<= 1; e--; }
    u32 q = 0, rem = ma; for (int i = 0; i < 25; i++) { q <<= 1; if (rem >= mb) { rem -= mb; q |= 1; } rem <<= 1; }
    return pack(s, e, q >> 1, q & 1, rem != 0);
}
static int fcmp(float x, float y)
{
    i32 a = (i32)fu(x), b = (i32)fu(y); if (((a | b) & 0x7fffffff) == 0) return 0;
    i32 oa = a < 0 ? -(a & 0x7fffffff) : a, ob = b < 0 ? -(b & 0x7fffffff) : b; return (oa > ob) - (oa < ob);
}
int __eqsf2(float x, float y) { return fcmp(x, y); }
int __nesf2(float x, float y) { return fcmp(x, y); }
int __ltsf2(float x, float y) { return fcmp(x, y); }
int __lesf2(float x, float y) { return fcmp(x, y); }
int __gtsf2(float x, float y) { return fcmp(x, y); }
int __gesf2(float x, float y) { return fcmp(x, y); }
int __unordsf2(float x, float y) { (void)x; (void)y; return 0; }
int __fixsfsi(float x)
{
    u32 a = fu(x); i32 e = (i32)((a >> 23) & 255) - 127; if (e < 0) return 0; if (e >= 31) return (a & SGN) ? (i32)0x80000000 : 0x7fffffff;
    u32 m = (a & 0x7fffffu) | 0x800000u, r = e >= 23 ? m << (e - 23) : m >> (23 - e); return (a & SGN) ? -(i32)r : (i32)r;
}
unsigned int __fixunssfsi(float x) { return (unsigned)__fixsfsi(x); }
float __floatunsisf(unsigned int v)
{
    if (!v) return uf(0); int e = 31; while (!(v & 0x80000000u)) { v <<= 1; e--; }
    u32 m = v >> 8, r = (v >> 7) & 1, st = (v & 0x7f) != 0; return pack(0, e + 127, m, r, st);
}
float __floatsisf(int v) { if (v < 0) return uf(fu(__floatunsisf((unsigned)(-v))) | SGN); return __floatunsisf((unsigned)v); }
