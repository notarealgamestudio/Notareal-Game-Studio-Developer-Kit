import struct,numpy as np
def sx(v,bits): 
    v&=(1<<bits)-1
    return v-(1<<bits) if v>>(bits-1) else v
def fix(x,i,f,tot=None):
    bits=1+i+f; return sx(x,bits)/(1<<f)
def pivot(sel,neg,a,b):
    o=1.0 if not (neg&1) else -1.0; c=b if not (neg&2) else -b; d=a if not (neg&4) else -a
    cols={0:[(o,0,0),(0,a,b),(0,c,d)],1:[(0,o,0),(a,0,b),(c,0,d)],2:[(0,0,o),(a,b,0),(c,d,0)],
     3:[(0,a,b),(o,0,0),(0,c,d)],4:[(a,0,b),(0,o,0),(c,0,d)],5:[(a,b,0),(0,0,o),(c,d,0)],
     6:[(0,a,b),(0,c,d),(o,0,0)],7:[(a,0,b),(c,0,d),(0,o,0)],8:[(a,b,0),(c,d,0),(0,0,o)]}
    if sel>=9:return np.eye(3)
    return np.array(cols[sel]).T
def basis(d):
    i0,i1,i2,i3,i4=d;inp=[i4,i0,i1,i2,i3];out=[0]*6
    for i in range(5):
        out[i]=(inp[i]>>3)&0x1fff; out[5]=((out[5]<<3)|(inp[i]&7))
    f=lambda x:sx(x,13)/4096
    a=np.array([f(out[1]),f(out[2]),f(out[3])]);b=np.array([f(out[4]),f(out[0]),f(out[5])]);c=np.cross(a,b)
    return np.array([a,b,c]).T
def read(path):
    d=open(path,'rb').read() if isinstance(path,str) else path
    assert d[:4]==b'BCA0'
    nsec=struct.unpack_from('<H',d,14)[0];jo=struct.unpack_from('<I',d,16)[0]
    assert d[jo:jo+4]==b'JNT0'
    ib=jo+8
    _,count,hs,_,_,_=struct.unpack_from('<BBHHHI',d,ib)
    p=ib+12+4*count
    sod,dss=struct.unpack_from('<HH',d,p);p+=4
    offs=struct.unpack_from('<%dI'%count,d,p);p+=4*count
    names=[d[p+16*i:p+16*i+16].split(b'\0')[0].decode('latin1') for i in range(count)]
    return [anim(d,jo+o,n) for o,n in zip(offs,names)]
def anim(d,b,name):
    st,nf,no,unk,pvo,bso=struct.unpack_from('<4sHHIII',d,b)
    assert st==b'J\0AC',st
    oo=struct.unpack_from('<%dH'%no,d,b+20)
    def fetch(x):
        mode=x>>15;idx=x&0x7fff
        if mode==1:
            sn,a,bb=struct.unpack_from('<HHH',d,b+pvo+6*idx)
            return pivot(sn&15,(sn>>4)&15,fix(a,3,12)if False else sx(a,16)/4096,sx(bb,16)/4096)
        return basis(struct.unpack_from('<5H',d,b+bso+10*idx))
    nodes=[]
    for off in oo:
        c=b+off
        flags,_,idx=struct.unpack_from('<HBB',d,c);c+=4
        bits=lambda lo,hi:(flags>>lo)&((1<<(hi-lo))-1)
        rot=None;trans=[None]*3
        if bits(0,1)==0:
            if bits(1,3)==0:
                for i in range(3):
                    if bits(3+i,4+i):
                        trans[i]=('c',struct.unpack_from('<i',d,c)[0]/4096);c+=4
                    else:
                        info,off2=struct.unpack_from('<II',d,c);c+=8
                        s=info&0xffff;e=(info>>16)&0xfff;dw=(info>>28)&3;rate=(info>>30)&3;n=(e-s)>>rate
                        vals=struct.unpack_from('<%d%s'%(n,'i' if dw==0 else 'h'),d,b+off2)
                        trans[i]=('s',s,e,[v/4096 for v in vals])
            if bits(6,8)==0:
                if bits(8,9):
                    v,_=struct.unpack_from('<HH',d,c);c+=4;rot=('c',fetch(v))
                else:
                    info,off2=struct.unpack_from('<II',d,c);c+=8
                    s=info&0xffff;e=(info>>16)&0xfff;rate=(info>>30)&3;n=(e-s)>>rate
                    vals=struct.unpack_from('<%dH'%n,d,b+off2)
                    rot=('s',s,e,[fetch(v) for v in vals])
        nodes.append((rot,trans))
    return dict(name=name,frames=nf,nodes=nodes)
def rot_at(node,f):
    r=node[0]
    if r is None:return np.eye(3)
    if r[0]=='c':return r[1]
    _,s,e,vals=r
    if f<=s:return vals[0]
    if f>=e-1:return vals[-1]
    lam=(f-s)/(e-1-s);idx=lam*(len(vals)-1);lo=int(idx);hi=min(lo+1,len(vals)-1);g=idx-lo
    return vals[lo]*(1-g)+vals[hi]*g
def euler_xyz(M):
    # rotation about X (pitch), Y, Z from matrix (ZYX convention): return degrees
    import math
    sy=-M[2,0];y=math.asin(max(-1,min(1,sy)))
    if abs(sy)<0.9999:x=math.atan2(M[2,1],M[2,2]);z=math.atan2(M[1,0],M[0,0])
    else:x=math.atan2(-M[1,2],M[1,1]);z=0
    return [math.degrees(v) for v in (x,y,z)]
