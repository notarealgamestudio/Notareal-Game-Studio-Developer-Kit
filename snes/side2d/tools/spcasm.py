#!/usr/bin/env python3
"""Small two-pass assembler for 65816 (SNES LoROM) and SPC700.

Syntax notes (65816):
  lda #$12        immediate (size from tracked M flag)
  lda var         absolute (16-bit address)
  lda.b var       direct page
  lda.l var       long (24-bit)
  lda.b (ptr),y / lda.b [ptr],y / lda var,x / lda.l tbl,x
  Labels: name:   local: @name: (scoped to last global label)
  Directives: .bank .org .db .dw .dl .fill .incbin .include .a8 .a16 .i8 .i16
              .macro/.endm .enum/.ende .assert .align
SPC700 (cpu spc): standard-ish syntax: mov a,#$12  mov $f2,a  mov a,!$1234+x ...
"""
import sys, re, os

class AsmError(Exception):
    pass

# ---------------------------------------------------------------- 65816 table
MODES_ALU = ['imm', 'dp', 'dpx', 'abs', 'absx', 'absy', 'long', 'longx', 'ind', 'indx', 'indy', 'indl', 'indly', 'sr', 'sry']
OP816 = {}
def _alu(name, ops):
    OP816[name] = {m: o for m, o in zip(MODES_ALU, ops) if o is not None}
_alu('adc', [0x69,0x65,0x75,0x6D,0x7D,0x79,0x6F,0x7F,0x72,0x61,0x71,0x67,0x77,0x63,0x73])
_alu('and', [0x29,0x25,0x35,0x2D,0x3D,0x39,0x2F,0x3F,0x32,0x21,0x31,0x27,0x37,0x23,0x33])
_alu('cmp', [0xC9,0xC5,0xD5,0xCD,0xDD,0xD9,0xCF,0xDF,0xD2,0xC1,0xD1,0xC7,0xD7,0xC3,0xD3])
_alu('eor', [0x49,0x45,0x55,0x4D,0x5D,0x59,0x4F,0x5F,0x52,0x41,0x51,0x47,0x57,0x43,0x53])
_alu('lda', [0xA9,0xA5,0xB5,0xAD,0xBD,0xB9,0xAF,0xBF,0xB2,0xA1,0xB1,0xA7,0xB7,0xA3,0xB3])
_alu('ora', [0x09,0x05,0x15,0x0D,0x1D,0x19,0x0F,0x1F,0x12,0x01,0x11,0x07,0x17,0x03,0x13])
_alu('sbc', [0xE9,0xE5,0xF5,0xED,0xFD,0xF9,0xEF,0xFF,0xF2,0xE1,0xF1,0xE7,0xF7,0xE3,0xF3])
_alu('sta', [None,0x85,0x95,0x8D,0x9D,0x99,0x8F,0x9F,0x92,0x81,0x91,0x87,0x97,0x83,0x93])
for n, ops in {'asl':(0x0A,0x06,0x16,0x0E,0x1E),'lsr':(0x4A,0x46,0x56,0x4E,0x5E),
               'rol':(0x2A,0x26,0x36,0x2E,0x3E),'ror':(0x6A,0x66,0x76,0x6E,0x7E),
               'dec':(0x3A,0xC6,0xD6,0xCE,0xDE),'inc':(0x1A,0xE6,0xF6,0xEE,0xFE)}.items():
    OP816[n] = dict(zip(['acc','dp','dpx','abs','absx'], ops))
OP816['bit'] = {'imm':0x89,'dp':0x24,'dpx':0x34,'abs':0x2C,'absx':0x3C}
OP816['cpx'] = {'immx':0xE0,'dp':0xE4,'abs':0xEC}
OP816['cpy'] = {'immx':0xC0,'dp':0xC4,'abs':0xCC}
OP816['ldx'] = {'immx':0xA2,'dp':0xA6,'dpy':0xB6,'abs':0xAE,'absy':0xBE}
OP816['ldy'] = {'immx':0xA0,'dp':0xA4,'dpx':0xB4,'abs':0xAC,'absx':0xBC}
OP816['stx'] = {'dp':0x86,'dpy':0x96,'abs':0x8E}
OP816['sty'] = {'dp':0x84,'dpx':0x94,'abs':0x8C}
OP816['stz'] = {'dp':0x64,'dpx':0x74,'abs':0x9C,'absx':0x9E}
OP816['trb'] = {'dp':0x14,'abs':0x1C}
OP816['tsb'] = {'dp':0x04,'abs':0x0C}
OP816['jmp'] = {'abs':0x4C,'ind':0x6C,'absindx':0x7C,'long':0x5C,'indl':0xDC}
OP816['jml'] = {'long':0x5C,'abs':0x5C,'indl':0xDC}
OP816['jsr'] = {'abs':0x20,'absindx':0xFC}
OP816['jsl'] = {'long':0x22,'abs':0x22}
OP816['pea'] = {'abs':0xF4}
OP816['pei'] = {'ind':0xD4,'dp':0xD4}
OP816['per'] = {'rel16':0x62}
OP816['brl'] = {'rel16':0x82}
for n, o in {'bpl':0x10,'bmi':0x30,'bvc':0x50,'bvs':0x70,'bcc':0x90,'bcs':0xB0,'bne':0xD0,'beq':0xF0,'bra':0x80}.items():
    OP816[n] = {'rel':o}
OP816['blt'] = OP816['bcc']; OP816['bge'] = OP816['bcs']
for n, o in {'rep':0xC2,'sep':0xE2,'brk':0x00,'cop':0x02,'wdm':0x42}.items():
    OP816[n] = {'imm8':o}
OP816['mvn'] = {'move':0x54}; OP816['mvp'] = {'move':0x44}
for n, o in dict(clc=0x18,sec=0x38,cli=0x58,sei=0x78,clv=0xB8,cld=0xD8,sed=0xF8,nop=0xEA,xba=0xEB,xce=0xFB,
                 tax=0xAA,tay=0xA8,txa=0x8A,tya=0x98,tsx=0xBA,txs=0x9A,txy=0x9B,tyx=0xBB,tcd=0x5B,tdc=0x7B,
                 tcs=0x1B,tsc=0x3B,pha=0x48,pla=0x68,phx=0xDA,plx=0xFA,phy=0x5A,ply=0x7A,php=0x08,plp=0x28,
                 phb=0x8B,plb=0xAB,phd=0x0B,pld=0x2B,phk=0x4B,dex=0xCA,dey=0x88,inx=0xE8,iny=0xC8,stp=0xDB,
                 wai=0xCB,rts=0x60,rtl=0x6B,rti=0x40).items():
    OP816[n] = {'imp':o}

M_DEP = {'adc','and','cmp','eor','lda','ora','sbc','bit'}

# ---------------------------------------------------------------- SPC700 table
# pattern tokens: A X Y SP YA C PSW #i d d+x d+y !a !a+x !a+y (x) (x)+ (y) [d+x] [d]+y r d.b
SPC = {}
def S(m, pat, op, enc):
    SPC.setdefault(m, []).append((pat, op, enc))
for m, base in (('or',0x00),('and',0x20),('eor',0x40),('cmp',0x60),('adc',0x80),('sbc',0xA0)):
    S(m,'A,#i',base+0x08,'i'); S(m,'A,(X)',base+0x06,''); S(m,'A,d',base+0x04,'d'); S(m,'A,d+x',base+0x14,'d')
    S(m,'A,!a',base+0x05,'a'); S(m,'A,!a+x',base+0x15,'a'); S(m,'A,!a+y',base+0x16,'a')
    S(m,'A,[d+x]',base+0x07,'d'); S(m,'A,[d]+y',base+0x17,'d'); S(m,'(X),(Y)',base+0x19,'')
    S(m,'d,d',base+0x09,'dd'); S(m,'d,#i',base+0x18,'di')
S('cmp','X,#i',0xC8,'i'); S('cmp','X,d',0x3E,'d'); S('cmp','X,!a',0x1E,'a')
S('cmp','Y,#i',0xAD,'i'); S('cmp','Y,d',0x7E,'d'); S('cmp','Y,!a',0x5E,'a')
for pat, op, enc in [('A,#i',0xE8,'i'),('A,(X)',0xE6,''),('A,(X)+',0xBF,''),('A,d',0xE4,'d'),('A,d+x',0xF4,'d'),
    ('A,!a',0xE5,'a'),('A,!a+x',0xF5,'a'),('A,!a+y',0xF6,'a'),('A,[d+x]',0xE7,'d'),('A,[d]+y',0xF7,'d'),
    ('X,#i',0xCD,'i'),('X,d',0xF8,'d'),('X,d+y',0xF9,'d'),('X,!a',0xE9,'a'),
    ('Y,#i',0x8D,'i'),('Y,d',0xEB,'d'),('Y,d+x',0xFB,'d'),('Y,!a',0xEC,'a'),
    ('(X),A',0xC6,''),('(X)+,A',0xAF,''),('d,A',0xC4,'d'),('d+x,A',0xD4,'d'),('!a,A',0xC5,'a'),('!a+x,A',0xD5,'a'),
    ('!a+y,A',0xD6,'a'),('[d+x],A',0xC7,'d'),('[d]+y,A',0xD7,'d'),
    ('d,X',0xD8,'d'),('d+y,X',0xD9,'d'),('!a,X',0xC9,'a'),('d,Y',0xCB,'d'),('d+x,Y',0xDB,'d'),('!a,Y',0xCC,'a'),
    ('A,X',0x7D,''),('A,Y',0xDD,''),('X,A',0x5D,''),('Y,A',0xFD,''),('X,SP',0x9D,''),('SP,X',0xBD,''),
    ('d,d',0xFA,'dd'),('d,#i',0x8F,'di')]:
    S('mov', pat, op, enc)
for m, ops in {'inc':(0xBC,0xAB,0xBB,0xAC,0x3D,0xFC),'dec':(0x9C,0x8B,0x9B,0x8C,0x1D,0xDC)}.items():
    for pat, op, enc in zip(['A','d','d+x','!a','X','Y'], ops, ['','d','d','a','','']):
        S(m, pat, op, enc)
for m, ops in {'asl':(0x1C,0x0B,0x1B,0x0C),'lsr':(0x5C,0x4B,0x5B,0x4C),'rol':(0x3C,0x2B,0x3B,0x2C),'ror':(0x7C,0x6B,0x7B,0x6C)}.items():
    for pat, op, enc in zip(['A','d','d+x','!a'], ops, ['','d','d','a']):
        S(m, pat, op, enc)
S('xcn','A',0x9F,'')
S('movw','YA,d',0xBA,'d'); S('movw','d,YA',0xDA,'d'); S('incw','d',0x3A,'d'); S('decw','d',0x1A,'d')
S('addw','YA,d',0x7A,'d'); S('subw','YA,d',0x9A,'d'); S('cmpw','YA,d',0x5A,'d')
S('mul','YA',0xCF,''); S('div','YA,X',0x9E,'')
for m, op in dict(bra=0x2F,beq=0xF0,bne=0xD0,bcs=0xB0,bcc=0x90,bvs=0x70,bvc=0x50,bmi=0x30,bpl=0x10).items():
    S(m,'r',op,'r')
S('cbne','d,r',0x2E,'dr'); S('cbne','d+x,r',0xDE,'dr'); S('dbnz','d,r',0x6E,'dr'); S('dbnz','Y,r',0xFE,'r')
S('jmp','!a',0x5F,'a'); S('jmp','[!a+x]',0x1F,'a'); S('call','!a',0x3F,'a')
for m, op in dict(ret=0x6F,reti=0x7F,clrc=0x60,setc=0x80,notc=0xED,clrv=0xE0,clrp=0x20,setp=0x40,ei=0xA0,di=0xC0,nop=0x00,sleep=0xEF,stop=0xFF).items():
    S(m,'',op,'')
S('push','A',0x2D,''); S('push','X',0x4D,''); S('push','Y',0x6D,''); S('push','PSW',0x0D,'')
S('pop','A',0xAE,''); S('pop','X',0xCE,''); S('pop','Y',0xEE,''); S('pop','PSW',0x8E,'')
S('set1','d.b',0x02,'db'); S('clr1','d.b',0x12,'db'); S('bbs','d.b,r',0x03,'dbr'); S('bbc','d.b,r',0x13,'dbr')

# ---------------------------------------------------------------- core
class Assembler:
    def __init__(self, cpu='65816', base=0):
        self.cpu = cpu
        self.syms = {}
        self.base = base
        self.out = bytearray()
        self.mxmap = []
        self.listing = []

    # -- expression evaluation
    def ev(self, expr, need=True):
        e = expr.strip()
        if not e:
            raise AsmError('empty expression')
        pre = None
        if e[0] in '<>^' and not e.startswith('<<') and not e.startswith('>>'):
            pre, e = e[0], e[1:]
        def rep_tok(m):
            t = m.group(0)
            if t.startswith('$'): return '0x' + t[1:]
            if t.startswith('%'): return '0b' + t[1:]
            return t
        e2 = re.sub(r"\$[0-9A-Fa-f]+|%[01]+(?![\w])", rep_tok, e)
        # character literal 'A'
        e2 = re.sub(r"'(.)'", lambda m: str(ord(m.group(1))), e2)
        # local labels @foo -> scope
        e2 = re.sub(r"@(\w+)", lambda m: self.mangle('@' + m.group(1)), e2)
        def lookup(m):
            t = m.group(0)
            if t in ('lo', 'hi', 'bank', 'min', 'max', 'abs', 'int', 'len'):
                return t
            if re.match(r'0[xb]', t) or t[0].isdigit():
                return t
            if t in self.syms:
                return str(self.syms[t])
            if need:
                raise AsmError('undefined symbol: ' + t)
            return '0'
        e3 = re.sub(r"[A-Za-z_][\w]*|\d\w*", lookup, e2)
        e3 = re.sub(r'(?<!/)/(?!/)', '//', e3)
        try:
            v = int(eval(e3, {'__builtins__': {}}, {'lo': lambda x: x & 0xFF, 'hi': lambda x: (x >> 8) & 0xFF,
                     'bank': lambda x: (x >> 16) & 0xFF, 'min': min, 'max': max, 'abs': abs, 'int': int}))
        except AsmError:
            raise
        except Exception as ex:
            raise AsmError('bad expression %r (%s)' % (expr, ex))
        if pre == '<': v &= 0xFF
        elif pre == '>': v = (v >> 8) & 0xFF
        elif pre == '^': v = (v >> 16) & 0xFF
        return v

    def mangle(self, name):
        if name.startswith('@'):
            return '_L_' + self.scope + '_' + name[1:]
        return name

    # -- source loading with macro expansion
    def load(self, path, depth=0):
        lines = []
        base = os.path.dirname(path)
        with open(path) as f:
            for no, raw in enumerate(f, 1):
                lines.append((path, no, raw.rstrip('\n')))
        return lines

    def preprocess(self, path):
        src = self.load(path)
        out = []
        macros = {}
        self.uniq = 0
        def expand(lines, depth):
            if depth > 30:
                raise AsmError('macro/include recursion')
            i = 0
            while i < len(lines):
                fn, no, raw = lines[i]
                line = strip_comment(raw)
                s = line.strip()
                low = s.lower()
                if low.startswith('.include'):
                    inc = s.split(None, 1)[1].strip().strip('"')
                    p = os.path.join(os.path.dirname(fn), inc)
                    expand(self.load(p), depth + 1)
                    i += 1; continue
                if low.startswith('.macro'):
                    parts = s.split(None, 2)
                    name = parts[1].lower()
                    params = [p.strip() for p in parts[2].split(',')] if len(parts) > 2 else []
                    body = []
                    i += 1
                    while not strip_comment(lines[i][2]).strip().lower().startswith('.endm'):
                        body.append(lines[i]); i += 1
                    macros[name] = (params, body)
                    i += 1; continue
                tok = s.split(None, 1)
                if tok and tok[0].lower() in macros and not s.endswith(':'):
                    params, body = macros[tok[0].lower()]
                    args = split_args(tok[1]) if len(tok) > 1 else []
                    self.uniq += 1
                    nb = []
                    for (bf, bn, bl) in body:
                        t = bl
                        for p, a in sorted(zip(params, args), key=lambda q: -len(q[0])):
                            t = t.replace('\\' + p, a)
                        t = t.replace('\\@', 'M%d' % self.uniq)
                        nb.append((fn, no, t))
                    expand(nb, depth + 1)
                    i += 1; continue
                out.append((fn, no, line))
                i += 1
        expand(src, 0)
        return out

    # -- main
    def assemble(self, path):
        lines = self.preprocess(path)
        self.longbr = set()
        while True:
            self.newlong = set()
            self._passes(lines)
            if not self.newlong:
                break
            self.longbr |= self.newlong
        return self.out

    def _passes(self, lines):
        self.syms = {}
        for pas in (1, 2):
            self.pas = pas
            self.scope = 'top'
            self.pc = self.base
            self.bank = 0
            self.m8 = True; self.x8 = True
            self.enum = None
            self.chunks = {}  # file offset -> bytes
            self.out = bytearray()
            self.fileoff = 0
            self.mxmap = []
            self.listing = []
            for idx, (fn, no, line) in enumerate(lines):
                self.linekey = idx
                if pas == 2 and line.strip():
                    self.listing.append((self.pc, os.path.basename(fn), no, line.strip()))
                try:
                    self.line(line)
                except AsmError as e:
                    raise AsmError('%s:%d: %s\n    %s' % (fn, no, e, line.strip()))

    def emit(self, data):
        if self.cpu == 'spc':
            off = self.pc - self.base
        else:
            off = self.fileoff
        if off < 0:
            raise AsmError('negative output offset')
        if len(self.out) < off + len(data):
            self.out.extend(b'\xff' * (off + len(data) - len(self.out)) if self.cpu != 'spc' else b'\x00' * (off + len(data) - len(self.out)))
        if self.cpu != 'spc' and (self.pc & 0xFFFF) + len(data) > 0x10000:
            raise AsmError('code/data crossed LoROM bank boundary at %06X' % self.pc)
        self.out[off:off + len(data)] = data
        self.pc += len(data)
        self.fileoff += len(data)

    def define(self, name, val):
        name = self.mangle(name)
        if self.pas == 1 and name in self.syms and self.syms[name] != val and not name.startswith('_REDEF'):
            raise AsmError('symbol redefined: ' + name)
        self.syms[name] = val

    def line(self, line):
        s = line.strip()
        if not s:
            return
        # enum block
        if self.enum is not None:
            if s.lower().startswith('.ende'):
                self.enum = None; return
            parts = s.split()
            self.define(parts[0], self.enum)
            self.enum += self.ev(parts[1]) if len(parts) > 1 else 1
            return
        # labels
        m = re.match(r'^(@?[A-Za-z_]\w*):(.*)$', s)
        if m:
            name = m.group(1)
            if not name.startswith('@'):
                self.scope = name
            self.define(name, self.pc)
            s = m.group(2).strip()
            if not s:
                return
        m = re.match(r'^([A-Za-z_]\w*)\s*=\s*(.+)$', s)
        if m:
            self.define(m.group(1), self.ev(m.group(2), need=(self.pas == 2)))
            return
        if s.startswith('.'):
            return self.directive(s)
        if self.cpu == 'spc':
            return self.spc_ins(s)
        return self.ins816(s)

    def directive(self, s):
        parts = s.split(None, 1)
        d = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ''
        P2 = self.pas == 2
        if d == '.bank':
            self.bank = self.ev(arg)
            self.pc = 0x800000 + self.bank * 0x10000 + 0x8000
            self.fileoff = self.bank * 0x8000
        elif d == '.org':
            v = self.ev(arg)
            if self.cpu == 'spc':
                self.pc = v
            else:
                self.pc = (self.pc & 0xFF0000) | (v & 0xFFFF)
                self.fileoff = self.bank * 0x8000 + ((v & 0xFFFF) - 0x8000)
        elif d == '.enum':
            self.enum = self.ev(arg)
        elif d == '.a8': self.m8 = True
        elif d == '.a16': self.m8 = False
        elif d == '.i8': self.x8 = True
        elif d == '.i16': self.x8 = False
        elif d in ('.db', '.byte'):
            data = bytearray()
            for a in split_args(arg):
                a = a.strip()
                if a.startswith('"'):
                    data += a[1:-1].encode('latin-1').decode('unicode_escape').encode('latin-1')
                else:
                    v = self.ev(a, need=P2)
                    if P2 and not (-128 <= v <= 255):
                        raise AsmError('byte out of range: %d' % v)
                    data.append(v & 0xFF)
            self.emit(data)
        elif d in ('.dw', '.word'):
            data = bytearray()
            for a in split_args(arg):
                v = self.ev(a, need=P2)
                data += bytes([v & 0xFF, (v >> 8) & 0xFF])
            self.emit(data)
        elif d in ('.dl', '.long'):
            data = bytearray()
            for a in split_args(arg):
                v = self.ev(a, need=P2)
                data += bytes([v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF])
            self.emit(data)
        elif d == '.fill':
            a = split_args(arg)
            n = self.ev(a[0])
            v = self.ev(a[1]) if len(a) > 1 else 0
            self.emit(bytes([v & 0xFF]) * n)
        elif d == '.align':
            n = self.ev(arg)
            while self.pc % n:
                self.emit(b'\x00')
        elif d == '.incbin':
            fn = arg.strip().strip('"')
            with open(os.path.join(self.srcdir, fn), 'rb') as f:
                self.emit(f.read())
        elif d == '.assert':
            if P2:
                a = split_args(arg)
                if not self.ev(a[0]):
                    raise AsmError('assert failed: ' + (a[1] if len(a) > 1 else a[0]))
        elif d == '.print':
            if P2:
                print('  ', arg, '=', ', '.join('$%X' % self.ev(x) for x in split_args(arg)))
        else:
            raise AsmError('unknown directive ' + d)

    # -- 65816
    def ins816(self, s):
        parts = s.split(None, 1)
        mn = parts[0].lower()
        opnd = parts[1].strip() if len(parts) > 1 else ''
        suf = ''
        if '.' in mn:
            mn, suf = mn.split('.', 1)
        if mn not in OP816:
            raise AsmError('unknown mnemonic ' + mn)
        tab = OP816[mn]
        P2 = self.pas == 2
        start = self.pc
        mode, ex = self.mode816(mn, opnd, suf, tab)
        op = tab[mode]
        if mode == 'imp' or mode == 'acc':
            self.emit(bytes([op])); return
        if mode in ('imm', 'immx', 'imm8'):
            v = self.ev(ex, need=P2)
            if mode == 'imm8':
                size = 1
            elif mode == 'imm':
                size = 1 if self.m8 else 2
                self.mxmap.append((start, 'm', 1 if self.m8 else 0))
            else:
                size = 1 if self.x8 else 2
                self.mxmap.append((start, 'x', 1 if self.x8 else 0))
            if size == 2 and 0x10000 <= v <= 0xFFFFFF:
                v &= 0xFFFF        # address label: low word
            if P2 and (v < -(1 << (8 * size - 1)) or v >= (1 << (8 * size))):
                raise AsmError('immediate out of range for %d-bit: %X' % (8 * size, v))
            self.emit(bytes([op]) + (v & ((1 << (8 * size)) - 1)).to_bytes(size, 'little'))
            if mn == 'rep':
                if v & 0x20: self.m8 = False
                if v & 0x10: self.x8 = False
            if mn == 'sep':
                if v & 0x20: self.m8 = True
                if v & 0x10: self.x8 = True
            return
        if mode == 'move':
            a = split_args(ex)
            src = self.ev(a[0], need=P2) & 0xFF; dst = self.ev(a[1], need=P2) & 0xFF
            self.emit(bytes([op, dst, src])); return
        v = self.ev(ex, need=P2)
        if mode == 'rel':
            if self.linekey in self.longbr:
                if mn == 'bra':
                    r = v - (self.pc + 3)
                    self.emit(bytes([0x82, r & 0xFF, (r >> 8) & 0xFF])); return
                inv = {0x10: 0x30, 0x30: 0x10, 0x50: 0x70, 0x70: 0x50, 0x90: 0xB0, 0xB0: 0x90, 0xD0: 0xF0, 0xF0: 0xD0}[op]
                r = v - (self.pc + 5)
                self.emit(bytes([inv, 3, 0x82, r & 0xFF, (r >> 8) & 0xFF])); return
            r = v - (self.pc + 2)
            if P2 and not (-128 <= r <= 127):
                self.newlong.add(self.linekey)
                r = 0
            if P2 and (v >> 16) != (self.pc >> 16):
                raise AsmError('branch across bank')
            self.emit(bytes([op, r & 0xFF])); return
        if mode == 'rel16':
            r = v - (self.pc + 3)
            self.emit(bytes([op, r & 0xFF, (r >> 8) & 0xFF])); return
        if mode in ('ind', 'indl') and mn in ('jmp', 'jml'):
            self.emit(bytes([op, v & 0xFF, (v >> 8) & 0xFF])); return
        if mode in ('dp', 'dpx', 'dpy', 'ind', 'indx', 'indy', 'indl', 'indly', 'sr', 'sry'):
            if P2 and (v & 0xFFFF) > 0xFF:
                raise AsmError('direct page operand out of range: $%X' % v)
            self.emit(bytes([op, v & 0xFF])); return
        if mode in ('abs', 'absx', 'absy', 'absindx') and mn in ('jmp', 'jsr') and P2 and (v >> 16) and (v >> 16) != (self.pc >> 16):
            raise AsmError('jmp/jsr to other bank (use jml/jsl): %06X' % v)
        if mode in ('long', 'longx') or mn in ('jml', 'jsl') and mode == 'abs':
            self.emit(bytes([op, v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF])); return
        if mode == 'indl' and mn in ('jmp', 'jml'):
            self.emit(bytes([op, v & 0xFF, (v >> 8) & 0xFF])); return
        self.emit(bytes([op, v & 0xFF, (v >> 8) & 0xFF]))

    def mode816(self, mn, o, suf, tab):
        ol = o.lower().replace(' ', '')
        if 'rel' in tab:
            return 'rel', o
        if 'rel16' in tab:
            return 'rel16', o
        if 'move' in tab:
            return 'move', o
        if o == '' or ol == 'a':
            if 'imp' in tab: return 'imp', None
            if 'acc' in tab: return 'acc', None
            raise AsmError('missing operand')
        if o.startswith('#'):
            for k in ('imm', 'immx', 'imm8'):
                if k in tab: return k, o[1:]
            raise AsmError('no immediate mode for ' + mn)
        if mn in ('jmp', 'jml') and o.startswith('['):
            return 'indl', o[1:-1]
        if mn in ('jmp', 'jsr') and o.startswith('(') and ol.endswith(',x)'):
            return 'absindx', o[1:o.lower().rindex(',')]
        if mn == 'jmp' and o.startswith('(') and o.endswith(')'):
            return 'ind', o[1:-1]
        m = re.match(r'^\[(.*)\],y$', o, re.I)
        if m: return self.chk(tab, 'indly', mn), m.group(1)
        m = re.match(r'^\[(.*)\]$', o)
        if m: return self.chk(tab, 'indl', mn), m.group(1)
        m = re.match(r'^\((.*),s\),y$', o, re.I)
        if m: return self.chk(tab, 'sry', mn), m.group(1)
        m = re.match(r'^\((.*),x\)$', o, re.I)
        if m: return self.chk(tab, 'indx', mn), m.group(1)
        m = re.match(r'^\((.*)\),y$', o, re.I)
        if m: return self.chk(tab, 'indy', mn), m.group(1)
        m = re.match(r'^\((.*)\)$', o)
        if m and mn != 'pei' or (m and mn == 'pei'):
            if m: return self.chk(tab, 'ind', mn), m.group(1)
        m = re.match(r'^(.*),s$', o, re.I)
        if m: return self.chk(tab, 'sr', mn), m.group(1)
        m = re.match(r'^(.*),([xy])$', o, re.I)
        if m:
            r = m.group(2).lower()
            if suf == 'b': return self.chk(tab, 'dp' + r, mn), m.group(1)
            if suf == 'l':
                if r != 'x': raise AsmError('long,y not available')
                return self.chk(tab, 'longx', mn), m.group(1)
            return self.chk(tab, 'abs' + r, mn), m.group(1)
        if suf == 'b': return self.chk(tab, 'dp', mn), o
        if suf == 'l': return self.chk(tab, 'long', mn), o
        if mn in ('jml', 'jsl'): return 'long', o
        return self.chk(tab, 'abs', mn), o

    def chk(self, tab, mode, mn):
        if mode not in tab:
            raise AsmError('addressing mode %s not valid for %s' % (mode, mn))
        return mode

    # -- SPC700
    def spc_ins(self, s):
        parts = s.split(None, 1)
        mn = parts[0].lower()
        opnd = parts[1].strip() if len(parts) > 1 else ''
        if mn == 'tcall':
            self.emit(bytes([(self.ev(opnd) << 4) | 1])); return
        if mn not in SPC:
            raise AsmError('unknown spc mnemonic ' + mn)
        args = split_args(opnd) if opnd else []
        pats, vals = [], []
        for a in args:
            p, v = classify_spc(a)
            pats.append(p); vals.append(v)
        P2 = self.pas == 2
        if mn in ('call', 'jmp') and pats == ['d']:
            pats = ['!a']
        for pat, op, enc in SPC[mn]:
            pp = pat.split(',') if pat else []
            if len(pp) != len(pats):
                continue
            ok = True
            for want, got in zip(pp, pats):
                if want == got: continue
                if want == 'r' and got == 'd': continue
                ok = False; break
            if not ok:
                continue
            ex = [v for v in vals if v is not None]
            b = bytearray([op])
            if enc == 'i': b.append(self.ev(ex[0], need=P2) & 0xFF)
            elif enc == 'd': b.append(self.dpv(ex[0], P2))
            elif enc == 'a':
                v = self.ev(ex[0], need=P2); b += bytes([v & 0xFF, (v >> 8) & 0xFF])
            elif enc == 'dd':  # mov dst,src -> op src dst
                b += bytes([self.dpv(ex[1], P2), self.dpv(ex[0], P2)])
            elif enc == 'di':
                b += bytes([self.ev(ex[1], need=P2) & 0xFF, self.dpv(ex[0], P2)])
            elif enc == 'r':
                b.append(0)
                tgt = self.ev(ex[-1], need=P2)
                r = tgt - (self.pc + len(b))
                if P2 and not -128 <= r <= 127: raise AsmError('spc branch out of range')
                b[-1] = r & 0xFF
            elif enc == 'dr':
                b.append(self.dpv(ex[0], P2)); b.append(0)
                tgt = self.ev(ex[1], need=P2)
                r = tgt - (self.pc + len(b))
                if P2 and not -128 <= r <= 127: raise AsmError('spc branch out of range')
                b[-1] = r & 0xFF
            elif enc in ('db', 'dbr'):
                d, bit = ex[0].rsplit('.', 1)
                b[0] = op | (int(bit) << 5)
                b.append(self.dpv(d, P2))
                if enc == 'dbr':
                    b.append(0)
                    tgt = self.ev(ex[1], need=P2)
                    r = tgt - (self.pc + len(b))
                    if P2 and not -128 <= r <= 127: raise AsmError('spc branch out of range')
                    b[-1] = r & 0xFF
            self.emit(bytes(b)); return
        raise AsmError('no matching spc form for %s %s (%s)' % (mn, opnd, ','.join(pats)))

    def dpv(self, e, P2):
        v = self.ev(e, need=P2)
        if P2 and not 0 <= v <= 0xFF:
            raise AsmError('spc dp out of range %X' % v)
        return v & 0xFF

def classify_spc(a):
    t = a.strip(); tl = t.lower().replace(' ', '')
    if tl in ('a', 'x', 'y', 'sp', 'ya', 'psw', 'c'):
        return tl.upper(), None
    if tl == '(x)': return '(X)', None
    if tl == '(x)+': return '(X)+', None
    if tl == '(y)': return '(Y)', None
    if t.startswith('#'): return '#i', t[1:]
    m = re.match(r'^\[!(.*)\+x\]$', t, re.I)
    if m: return '[!a+x]', m.group(1)
    m = re.match(r'^\[(.*)\+x\]$', t, re.I)
    if m: return '[d+x]', m.group(1)
    m = re.match(r'^\[(.*)\]\+y$', t, re.I)
    if m: return '[d]+y', m.group(1)
    m = re.match(r'^!(.*)\+([xy])$', t, re.I)
    if m: return '!a+' + m.group(2).lower(), m.group(1)
    if t.startswith('!'): return '!a', t[1:]
    m = re.match(r'^(.*)\+([xy])$', t, re.I)
    if m: return 'd+' + m.group(2).lower(), m.group(1)
    if re.match(r'^.*\.[0-7]$', t) and not re.match(r'^\$?[0-9a-f]+\.[0-7]$', t, re.I) or re.match(r'^[\w$]+\.[0-7]$', t):
        return 'd.b', t
    return 'd', t

def strip_comment(l):
    out = []; q = False
    for ch in l:
        if ch == '"': q = not q
        if ch == ';' and not q: break
        out.append(ch)
    return ''.join(out)

def split_args(s):
    args, cur, depth, q = [], '', 0, False
    for ch in s:
        if ch == '"': q = not q
        if not q:
            if ch in '([': depth += 1
            if ch in ')]': depth -= 1
            if ch == ',' and depth == 0:
                args.append(cur.strip()); cur = ''; continue
        cur += ch
    if cur.strip(): args.append(cur.strip())
    return args

def snes_checksum(rom):
    s = sum(rom) & 0xFFFF
    return s

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--cpu', default='65816'); ap.add_argument('--base', default='0')
    ap.add_argument('--size', default='0'); ap.add_argument('--sym')
    a = ap.parse_args()
    A = Assembler(a.cpu, int(a.base, 0))
    A.srcdir = os.path.dirname(os.path.abspath(a.src))
    try:
        out = A.assemble(a.src)
    except AsmError as e:
        print('ERROR:', e); sys.exit(1)
    size = int(a.size, 0)
    if size:
        if len(out) > size:
            print('ERROR: output %d > size %d' % (len(out), size)); sys.exit(1)
        out = out + b'\xff' * (size - len(out))
        # fix checksum (LoROM header at $7FC0)
        out[0x7FDC:0x7FE0] = b'\xff\xff\x00\x00'
        c = sum(out) & 0xFFFF
        out[0x7FDC:0x7FDE] = ((c ^ 0xFFFF)).to_bytes(2, 'little')
        out[0x7FDE:0x7FE0] = c.to_bytes(2, 'little')
    with open(a.out, 'wb') as f:
        f.write(out)
    if a.sym:
        with open(a.sym, 'w') as f:
            for k, v in sorted(A.syms.items(), key=lambda kv: kv[1]):
                f.write('%06X %s\n' % (v & 0xFFFFFF, k))
        with open(a.sym + '.lst', 'w') as f:
            for pc, fn, no, l in A.listing:
                f.write('%06X %s:%d  %s\n' % (pc & 0xFFFFFF, fn, no, l))
        with open(a.sym + '.mx', 'w') as f:
            for addr, kind, val in A.mxmap:
                f.write('%06X %s %d\n' % (addr, kind, val))
    print('assembled %s: %d bytes' % (a.out, len(out)))

if __name__ == '__main__':
    main()
