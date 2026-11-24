/* nr3d.js (v1.13) - offline software 3D for the dev kit: a z-buffered, perspective-correct-depth triangle rasterizer with smooth (Gouraud)
 * lighting, distance fog, alpha shadows and sky, plus low-poly builders (box, prism, sphere, tapered limb) and a character-vs-box collision
 * helper. Draws straight into a 2D canvas (putImageData) so it runs in the desktop window, the browser and the PC/Xbox export with no GPU.
 * Conventions: x right, y up, z forward at yaw 0; heading vector = (sin yaw, cos yaw). Colours are [r,g,b] 0..255.
 *   const R = N3.create(320, 240);  R.begin({x,y,z,yaw,pitch,fov}, {top,bottom,fogNear,fogFar,fog:[r,g,b]});  R.box(...); R.end(ctx);
 *   N3.collide(boxes, body, stepUp)  body = {x,y,z,r,h,vx,vy,vz}  ->  body.ground (bool), body.wall ({nx,nz}|null), body.hitHead */
(function (root) {
    'use strict';
    const N3 = {};
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    N3.hex = h => { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    N3.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    N3.shade = (c, k) => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];

    N3.create = (w, h) => {
        const buf = new Uint8ClampedArray(w * h * 4), zb = new Float32Array(w * h), cam = { x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0, fov: 1.15 };
        const R = { w, h, buf, zb, cam, light: [-0.35, 0.8, -0.5], ambient: 0.4, fogNear: 25, fogFar: 90, fog: [150, 190, 230], tris: 0, drawn: 0 };
        let cy = 1, sy = 0, cp = 1, sp = 0, F = 1, alphaQ = [], img = null;
        const NEAR = 0.12;
        const ll = Math.hypot(R.light[0], R.light[1], R.light[2]); R.light = R.light.map(v => v / ll);
        R.begin = (c, sky) => {
            Object.assign(cam, c || {}); sky = sky || {};
            cy = Math.cos(cam.yaw); sy = Math.sin(cam.yaw); cp = Math.cos(cam.pitch); sp = Math.sin(cam.pitch); F = (h / 2) / Math.tan(cam.fov / 2);
            if (sky.fog) R.fog = sky.fog; if (sky.fogNear != null) R.fogNear = sky.fogNear; if (sky.fogFar != null) R.fogFar = sky.fogFar; if (sky.ambient != null) R.ambient = sky.ambient;
            const top = sky.top || [90, 140, 230], bot = sky.bottom || R.fog, hz = h / 2 - Math.tan(cam.pitch) * F; // horizon row
            for (let y = 0; y < h; y++) { const t = clamp((y - (hz - h * 0.55)) / (h * 0.55), 0, 1), r = top[0] + (bot[0] - top[0]) * t, g = top[1] + (bot[1] - top[1]) * t, b = top[2] + (bot[2] - top[2]) * t; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; } }
            if (N3.assets && (N3.assets.sky || N3.assets.land)) paintAssets(hz);   // shared asset library: skyline + land type
            zb.fill(1e9); R.tris = 0; R.drawn = 0; alphaQ = [];
        };
        const paintAssets = hz => {
            const A = N3.assets, S = A.sky, L = A.land, fr = R.fog, TAU = 6.283185307; const col = new Float32Array(w);
            if (S) for (let x = 0; x < w; x++) col[x] = (cam.yaw + Math.atan((x + .5 - w / 2) / F)) / TAU;
            const horY = Math.max(0, Math.min(h, Math.round(hz))); const skyH = h * .28;
            for (let y = 0; y < h; y++) {
                const yc = (h / 2 - (y + .5)) / F, dyw = sp + yc * cp, ground = dyw < -1e-4;
                if (!ground) { if (!S) continue; const v = Math.max(0, Math.min(S.h - 1, Math.floor(S.h - 1 - (horY - 1 - y) * S.h / skyH))), vr = v * S.w;
                    for (let x = 0; x < w; x++) { const u = (((col[x] * 4 * S.w) % S.w) + S.w) % S.w | 0, si = (vr + u) * 4, i = (y * w + x) * 4; buf[i] = S.data[si]; buf[i + 1] = S.data[si + 1]; buf[i + 2] = S.data[si + 2]; } continue; }
                if (true) continue; const t = -cam.y / dyw; if (t > 140) continue; const f = t <= R.fogNear ? 0 : Math.min(1, (t - R.fogNear) / Math.max(1, R.fogFar - R.fogNear));
                const wy = cam.y; void wy; const ux = -sy * sp, uz = -cy * sp;   // up vector (world x, z); forward = (sy*cp, sp, cy*cp); right = (cy, 0, -sy)
                const bx = cam.x + t * (sy * cp + yc * ux), bz = cam.z + t * (cy * cp + yc * uz), stx = t * cy / F, stz = -t * sy / F;
                for (let x = 0; x < w; x++) { const a = x + .5 - w / 2, wx = bx + a * stx, wz = bz + a * stz, u = ((Math.floor(wx * 8) % L.w) + L.w) % L.w, v = ((Math.floor(wz * 8) % L.h) + L.h) % L.h, si = (v * L.w + u) * 4, i = (y * w + x) * 4;
                    buf[i] = L.data[si] + (fr[0] - L.data[si]) * f; buf[i + 1] = L.data[si + 1] + (fr[1] - L.data[si + 1]) * f; buf[i + 2] = L.data[si + 2] + (fr[2] - L.data[si + 2]) * f; }
            }
        };
        const toCam = (x, y, z) => { const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z, x1 = dx * cy - dz * sy, z1 = dx * sy + dz * cy; return [x1, dy * cp - z1 * sp, dy * sp + z1 * cp]; };
        R.project = (x, y, z) => { const c = toCam(x, y, z); if (c[2] < NEAR) return null; return [w / 2 + c[0] / c[2] * F, h / 2 - c[1] / c[2] * F, c[2]]; };
        const lightAt = (n, vx, vy, vz) => { // two-sided diffuse
            let d = n[0] * R.light[0] + n[1] * R.light[1] + n[2] * R.light[2]; const toC = n[0] * (cam.x - vx) + n[1] * (cam.y - vy) + n[2] * (cam.z - vz); if (toC < 0) d = -d; const hl = 0.5 + 0.5 * d; return R.ambient + (1 - R.ambient) * hl * hl;
        };
        // submit one world-space triangle. n0..n2 optional vertex normals (smooth), alpha<1 = blended, no depth write
        R.tri = (a, b, c, col, n0, n1, n2, alpha) => {
            R.tris++;
            let nn0 = n0, nn1 = n1, nn2 = n2;
            if (!n0) { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nn0 = nn1 = nn2 = [nx / l, ny / l, nz / l]; }
            const L0 = lightAt(nn0, a[0], a[1], a[2]), L1 = lightAt(nn1, b[0], b[1], b[2]), L2 = lightAt(nn2, c[0], c[1], c[2]);
            const p = [toCam(a[0], a[1], a[2]), toCam(b[0], b[1], b[2]), toCam(c[0], c[1], c[2])], Ls = [L0, L1, L2];
            // clip against the near plane
            const out = [], outL = [];
            for (let i = 0; i < 3; i++) { const P = p[i], Q = p[(i + 1) % 3], li = Ls[i], lj = Ls[(i + 1) % 3], pin = P[2] >= NEAR, qin = Q[2] >= NEAR; if (pin) { out.push(P); outL.push(li); } if (pin !== qin) { const t = (NEAR - P[2]) / (Q[2] - P[2]); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, NEAR]); outL.push(li + (lj - li) * t); } }
            if (out.length < 3) return;
            if (alpha != null && alpha < 1) { alphaQ.push([out, outL, col, alpha]); return; }
            for (let i = 1; i < out.length - 1; i++) raster(out[0], out[i], out[i + 1], outL[0], outL[i], outL[i + 1], col, 1);
        };
        const raster = (A, B, C, la, lb, lc, col, alpha) => {
            const ax = w / 2 + A[0] / A[2] * F, ay = h / 2 - A[1] / A[2] * F, bx = w / 2 + B[0] / B[2] * F, by = h / 2 - B[1] / B[2] * F, cx = w / 2 + C[0] / C[2] * F, cyy = h / 2 - C[1] / C[2] * F;
            const area = (bx - ax) * (cyy - ay) - (cx - ax) * (by - ay); if (area === 0 || !isFinite(area)) return;
            let x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx))), y0 = Math.max(0, Math.floor(Math.min(ay, by, cyy))), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cyy)));
            if (x0 > x1 || y0 > y1) return; R.drawn++;
            const iz0 = 1 / A[2], iz1 = 1 / B[2], iz2 = 1 / C[2], inv = 1 / area, fn = R.fogNear, ff = R.fogFar, fr = R.fog[0], fg = R.fog[1], fb = R.fog[2], wr = col[0], wg = col[1], wb = col[2], writeZ = alpha >= 1;
            for (let y = y0; y <= y1; y++) {
                const py = y + 0.5; let row = y * w;
                for (let x = x0; x <= x1; x++) {
                    const px = x + 0.5, w0 = ((bx - px) * (cyy - py) - (cx - px) * (by - py)) * inv, w1 = ((cx - px) * (ay - py) - (ax - px) * (cyy - py)) * inv, w2 = 1 - w0 - w1;
                    if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
                    const iz = w0 * iz0 + w1 * iz1 + w2 * iz2, z = 1 / iz, zi = row + x; if (z >= zb[zi]) continue;
                    const l = w0 * la + w1 * lb + w2 * lc, f = z <= fn ? 0 : z >= ff ? 1 : (z - fn) / (ff - fn), i = zi * 4;
                    let r = wr * l, g = wg * l, b = wb * l; r += (fr - r) * f; g += (fg - g) * f; b += (fb - b) * f;
                    if (writeZ) { zb[zi] = z; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; } else { buf[i] += (r - buf[i]) * alpha; buf[i + 1] += (g - buf[i + 1]) * alpha; buf[i + 2] += (b - buf[i + 2]) * alpha; }
                }
            }
        };
        R.flushAlpha = () => { for (const q of alphaQ) for (let i = 1; i < q[0].length - 1; i++) raster(q[0][0], q[0][i], q[0][i + 1], q[1][0], q[1][i], q[1][i + 1], q[2], q[3]); alphaQ = []; };
        R.quad = (a, b, c, d, col, alpha) => { R.tri(a, b, c, col, null, null, null, alpha); R.tri(a, c, d, col, null, null, null, alpha); };
        // axis box (centre x,z; y = bottom), optional yaw about its own centre
        R.box = (x, y, z, sx, sy, sz, col, yaw, cols) => {
            const hx = sx / 2, hz = sz / 2, c = Math.cos(yaw || 0), s = Math.sin(yaw || 0), P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
            const v = [P(-hx, 0, -hz), P(hx, 0, -hz), P(hx, 0, hz), P(-hx, 0, hz), P(-hx, sy, -hz), P(hx, sy, -hz), P(hx, sy, hz), P(-hx, sy, hz)];
            const q = [[3, 2, 6, 7], [1, 0, 4, 5], [2, 1, 5, 6], [0, 3, 7, 4], [4, 7, 6, 5], [0, 1, 2, 3]];
            for (let i = 0; i < 6; i++) { const cc = cols ? cols[i] || col : col; R.quad(v[q[i][0]], v[q[i][1]], v[q[i][2]], v[q[i][3]], cc); }
        };
        // upright prism / cone (base centre x,y,z)
        R.prism = (x, y, z, r0, hgt, sides, col, r1) => {
            sides = sides || 8; r1 = r1 == null ? r0 : r1; const bot = [], top = [];
            for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2; bot.push([x + Math.cos(a) * r0, y, z + Math.sin(a) * r0]); top.push([x + Math.cos(a) * r1, y + hgt, z + Math.sin(a) * r1]); }
            for (let i = 0; i < sides; i++) { const j = (i + 1) % sides, a = (i + .5) / sides * Math.PI * 2, nrm = [Math.cos(a), 0.15, Math.sin(a)]; const n = [nrm, nrm, nrm]; R.tri(bot[i], bot[j], top[j], col, n[0], n[1], n[2]); R.tri(bot[i], top[j], top[i], col, n[0], n[1], n[2]); }
            if (r1 > 0.01) for (let i = 1; i < sides - 1; i++) R.tri(top[0], top[i], top[i + 1], col);
        };
        // smooth lit sphere (optionally squashed: sx,sy,sz radii)
        R.sphere = (x, y, z, rx, col, lat, lon, ry, rz) => {
            lat = lat || 5; lon = lon || 8; ry = ry || rx; rz = rz || rx; const g = [];
            for (let i = 0; i <= lat; i++) { const th = i / lat * Math.PI, row = []; for (let j = 0; j < lon; j++) { const ph = j / lon * Math.PI * 2, nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph); row.push({ p: [x + nx * rx, y + ny * ry, z + nz * rz], n: [nx, ny, nz] }); } g.push(row); }
            for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) { const j2 = (j + 1) % lon, a = g[i][j], b = g[i][j2], c = g[i + 1][j2], d = g[i + 1][j]; if (i > 0) R.tri(a.p, c.p, b.p, col, a.n, c.n, b.n); if (i < lat - 1) R.tri(a.p, d.p, c.p, col, a.n, d.n, c.n); }
        };
        // tapered round limb between two world points (smooth normals) - arms, legs, torso, necks, bottles
        R.limb = (p, q, r0, r1, col, sides, cap) => {
            sides = sides || 6; const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], L = Math.hypot(dx, dy, dz) || 1, d = [dx / L, dy / L, dz / L];
            let u = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; let ax = d[1] * u[2] - d[2] * u[1], ay = d[2] * u[0] - d[0] * u[2], az = d[0] * u[1] - d[1] * u[0]; const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
            const bx = d[1] * az - d[2] * ay, by = d[2] * ax - d[0] * az, bz = d[0] * ay - d[1] * ax, A = [], B = [], N = [];
            for (let i = 0; i < sides; i++) { const t = i / sides * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), ox = ax * c + bx * s, oy = ay * c + by * s, oz = az * c + bz * s; A.push([p[0] + ox * r0, p[1] + oy * r0, p[2] + oz * r0]); B.push([q[0] + ox * r1, q[1] + oy * r1, q[2] + oz * r1]); N.push([ox, oy, oz]); }
            for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; R.tri(A[i], A[j], B[j], col, N[i], N[j], N[j]); R.tri(A[i], B[j], B[i], col, N[i], N[j], N[i]); }
            if (cap !== false) for (let i = 1; i < sides - 1; i++) { R.tri(B[0], B[i], B[i + 1], col); R.tri(A[0], A[i + 1], A[i], col); }
        };
        // checkered ground / floor
        const texFloor = (x0, z0, x1, z1, y, L) => {
            const fr = R.fog; const ux = -sy * sp, uz = -cy * sp;
            for (let py = 0; py < h; py++) {
                const yc = (h / 2 - (py + .5)) / F, dyw = sp + yc * cp; if (dyw > -1e-4) continue; const t = (y - cam.y) / dyw; if (t <= 0 || t > 160) continue;
                const f = t <= R.fogNear ? 0 : Math.min(1, (t - R.fogNear) / Math.max(1, R.fogFar - R.fogNear)), bx = cam.x + t * (sy * cp + yc * ux), bz = cam.z + t * (cy * cp + yc * uz), stx = t * cy / F, stz = -t * sy / F;
                for (let px = 0; px < w; px++) { const a = px + .5 - w / 2, wx = bx + a * stx, wz = bz + a * stz; if (wx < x0 || wx > x1 || wz < z0 || wz > z1) continue; const zi = py * w + px; if (t >= zb[zi]) continue;
                    const u = ((Math.floor(wx * 8) % L.w) + L.w) % L.w, v = ((Math.floor(wz * 8) % L.h) + L.h) % L.h, si = (v * L.w + u) * 4, i = zi * 4; zb[zi] = t;
                    buf[i] = L.data[si] + (fr[0] - L.data[si]) * f; buf[i + 1] = L.data[si + 1] + (fr[1] - L.data[si + 1]) * f; buf[i + 2] = L.data[si + 2] + (fr[2] - L.data[si + 2]) * f; buf[i + 3] = 255; }
            }
        };
        R.floor = (x0, z0, x1, z1, y, c1, c2, tile) => {
            if (N3.assets && N3.assets.land && y > -0.01 && y < 0.01) return texFloor(x0, z0, x1, z1, y, N3.assets.land);   // the shared land texture, depth-tested like real geometry
            tile = tile || 4; const nx = Math.max(1, Math.round((x1 - x0) / tile)), nz = Math.max(1, Math.round((z1 - z0) / tile)), sx = (x1 - x0) / nx, sz = (z1 - z0) / nz;
            for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const xa = x0 + i * sx, za = z0 + j * sz; if (xa + sx < cam.x - R.fogFar - tile || xa > cam.x + R.fogFar + tile || za + sz < cam.z - R.fogFar - tile || za > cam.z + R.fogFar + tile) continue; R.quad([xa, y, za], [xa, y, za + sz], [xa + sx, y, za + sz], [xa + sx, y, za], (i + j) & 1 ? c2 : c1); }
        };
        // soft blob shadow on the ground under something
        R.shadow = (x, y, z, r, a) => { const pts = []; for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; pts.push([x + Math.cos(t) * r, y + 0.02, z + Math.sin(t) * r]); } for (let i = 1; i < 7; i++) R.tri(pts[0], pts[i + 1], pts[i], [0, 0, 0], null, null, null, a == null ? 0.35 : a); };
        R.end = ctx => {
            R.flushAlpha(); if (!ctx) return buf;
            if (ctx.createImageData && ctx.putImageData) { try { if (!img || img.width !== w) img = ctx.createImageData(w, h); if (img && img.data && img.data.set) { img.data.set(buf); ctx.putImageData(img, 0, 0); } } catch (e) { /* headless stub */ } }
            return buf;
        };
        return R;
    };

    /* ---- character / world collision against axis boxes {x0,y0,z0,x1,y1,z1} (y = vertical) ---- */
    N3.box = (x, y, z, sx, sy, sz, tag) => ({ x0: x - sx / 2, y0: y, z0: z - sz / 2, x1: x + sx / 2, y1: y + sy, z1: z + sz / 2, tag });
    const footOver = (b, B, k) => { const cx = clamp(B.x, b.x0, b.x1), cz = clamp(B.z, b.z0, b.z1); return Math.hypot(B.x - cx, B.z - cz) < B.r * k; };
    const rampH = (b, x, z) => { const r = b.ramp, t = r.axis === 'x' ? clamp((x - b.x0) / (b.x1 - b.x0), 0, 1) : clamp((z - b.z0) / (b.z1 - b.z0), 0, 1); return r.h0 + (r.h1 - r.h0) * t; };
    N3.rampH = rampH;
    N3.floorAt = (boxes, B, maxY) => { let f = B.groundFn ? B.groundFn(B.x, B.z) : 0; for (const b of boxes) { if (b.noFloor || !footOver(b, B, 0.75)) continue; const y = b.ramp ? rampH(b, B.x, B.z) : b.y1; if (y <= maxY && y > f) f = y; } return f; };
    N3.collide = (boxes, B, step) => {
        step = step == null ? 0.5 : step; B.wall = null; B.hitHead = false;
        const sp = Math.hypot(B.vx, B.vz), n = Math.max(1, Math.ceil(sp / 0.3));
        for (let i = 0; i < n; i++) {
            B.x += B.vx / n; B.z += B.vz / n;
            for (const b of boxes) {
                if (b.y1 <= B.y + step || b.y0 >= B.y + B.h || b.ghost || b.ramp) continue;
                const cx = clamp(B.x, b.x0, b.x1), cz = clamp(B.z, b.z0, b.z1); let dx = B.x - cx, dz = B.z - cz; const d = Math.hypot(dx, dz);
                if (d < B.r) {
                    if (d > 1e-6) { B.x += dx / d * (B.r - d); B.z += dz / d * (B.r - d); B.wall = { nx: dx / d, nz: dz / d, box: b }; }
                    else { const l = B.x - b.x0, r = b.x1 - B.x, t = B.z - b.z0, bt = b.z1 - B.z, m = Math.min(l, r, t, bt); if (m === l) { B.x = b.x0 - B.r; B.wall = { nx: -1, nz: 0, box: b }; } else if (m === r) { B.x = b.x1 + B.r; B.wall = { nx: 1, nz: 0, box: b }; } else if (m === t) { B.z = b.z0 - B.r; B.wall = { nx: 0, nz: -1, box: b }; } else { B.z = b.z1 + B.r; B.wall = { nx: 0, nz: 1, box: b }; } }
                }
            }
        }
        const prevY = B.y; B.y += B.vy; B.ground = false;
        if (B.vy > 0) { for (const b of boxes) if (!b.ghost && !b.ramp && b.y0 >= prevY + B.h - 0.05 && B.y + B.h > b.y0 && footOver(b, B, 0.7)) { B.y = b.y0 - B.h; B.vy = 0; B.hitHead = true; } }
        const fl = N3.floorAt(boxes, B, prevY + step + Math.max(0, -B.vy));
        if (B.y <= fl + 1e-6 && B.vy <= 0) { B.y = fl; B.vy = 0; B.ground = true; B.floor = fl; }
        else if (B.y <= fl && B.vy > 0) { /* rising through a ledge edge */ }
        return B;
    };
    // ray (segment) against boxes, sampled: true when something solid blocks eye->target
    N3.blocked = (boxes, x0, y0, z0, x1, y1, z1, step) => {
        const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.max(1, Math.ceil(L / (step || 0.5)));
        for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t; for (const b of boxes) if (!b.ghost && !b.see && x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && z > b.z0 && z < b.z1) return true; }
        return false;
    };
    N3.draw = (R, boxes, col, colTop) => { for (const b of boxes) { if (b.hide) continue; R.box((b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2, b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0, b.col || col, 0, b.cols || (colTop ? [b.col || col, b.col || col, b.col || col, b.col || col, b.top || colTop, b.col || col] : null)); } };

    // ramps draw as a sloped quad + side skirts
    N3.drawRamp = (R, b, col) => { const r = b.ramp, y = (x, z) => rampH(b, x, z), a = [b.x0, y(b.x0, b.z0), b.z0], c = [b.x1, y(b.x1, b.z0), b.z0], d = [b.x1, y(b.x1, b.z1), b.z1], e = [b.x0, y(b.x0, b.z1), b.z1]; R.quad(a, e, d, c, col); const g = (p, q) => R.quad(p, q, [q[0], 0, q[2]], [p[0], 0, p[2]], N3.shade(col, .75)); g(a, c); g(e, d); g(a, e); g(c, d); };
    /* uniform grid over boxes for fast near-queries and line-of-sight */
    N3.grid = (boxes, cell) => {
        cell = cell || 8; const m = new Map(), key = (i, j) => i * 4096 + j; let stamp = 0;
        const add = b => { const i0 = Math.floor(b.x0 / cell), i1 = Math.floor(b.x1 / cell), j0 = Math.floor(b.z0 / cell), j1 = Math.floor(b.z1 / cell); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i + 2048, j + 2048); (m.get(k) || m.set(k, []).get(k)).push(b); } };
        boxes.forEach(add);
        const G = { boxes, add, near: (x, z, r) => { stamp++; const out = [], i0 = Math.floor((x - r) / cell), i1 = Math.floor((x + r) / cell), j0 = Math.floor((z - r) / cell), j1 = Math.floor((z + r) / cell); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = m.get(key(i + 2048, j + 2048)); if (l) for (const b of l) if (b._s !== stamp) { b._s = stamp; out.push(b); } } return out; } };
        G.blocked = (x0, y0, z0, x1, y1, z1, step) => { const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.max(1, Math.ceil(L / (step || .6))); for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t, l = m.get(key(Math.floor(x / cell) + 2048, Math.floor(z / cell) + 2048)); if (l) for (const b of l) if (!b.ghost && !b.see && !b.ramp && x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && z > b.z0 && z < b.z1) return true; } return false; };
        return G;
    };
    /* A* path finding on a coarse grid built from solids that block walkers (anything taller than stepUp) */
    N3.nav = (boxes, x0, z0, x1, z1, cell, stepUp, pad) => {
        cell = cell || 1.5; stepUp = stepUp == null ? .6 : stepUp; pad = pad == null ? .55 : pad; const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell), bl = new Uint8Array(nx * nz);
        const cx = i => x0 + (i + .5) * cell, cz = j => z0 + (j + .5) * cell;
        for (const b of boxes) { if (b.ghost || b.ramp || b.y1 <= stepUp || b.y0 > 1.2 || b.nonav) continue; const i0 = Math.max(0, Math.floor((b.x0 - pad - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((b.x1 + pad - x0) / cell)), j0 = Math.max(0, Math.floor((b.z0 - pad - z0) / cell)), j1 = Math.min(nz - 1, Math.floor((b.z1 + pad - z0) / cell)); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) bl[j * nx + i] = 1; }
        const NV = { nx, nz, cell, blocked: bl, free: (x, z) => { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); return i >= 0 && j >= 0 && i < nx && j < nz && !bl[j * nx + i]; } };
        NV.cellOf = (x, z) => [clamp(Math.floor((x - x0) / cell), 0, nx - 1), clamp(Math.floor((z - z0) / cell), 0, nz - 1)];
        NV.nearestFree = (i, j) => { if (!bl[j * nx + i]) return [i, j]; for (let r = 1; r < 8; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && !bl[jj * nx + ii]) return [ii, jj]; } return [i, j]; };
        NV.path = (ax, az, bx, bz, maxIt) => {
            let [si, sj] = NV.nearestFree(...NV.cellOf(ax, az)), [ei, ej] = NV.nearestFree(...NV.cellOf(bx, bz)); const S = sj * nx + si, E = ej * nx + ei; if (S === E) return [[bx, bz]];
            const g = new Float32Array(nx * nz).fill(1e9), from = new Int32Array(nx * nz).fill(-1), closed = new Uint8Array(nx * nz), open = [S]; g[S] = 0; const f = new Float32Array(nx * nz); f[S] = Math.hypot(ei - si, ej - sj); let it = 0; maxIt = maxIt || 6000;
            const push = n => { open.push(n); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[open[p]] <= f[open[i]]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } }, pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < open.length && f[open[l]] < f[open[m]]) m = l; if (r < open.length && f[open[r]] < f[open[m]]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
            let found = false; while (open.length && it++ < maxIt) { const cur = pop(); if (closed[cur]) continue; closed[cur] = 1; if (cur === E) { found = true; break; } const ci = cur % nx, cj = (cur / nx) | 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue; const nn = nj * nx + ni; if (bl[nn] || closed[nn]) continue; if (di && dj && (bl[cj * nx + ni] || bl[nj * nx + ci])) continue; const ng = g[cur] + (di && dj ? 1.414 : 1); if (ng < g[nn]) { g[nn] = ng; from[nn] = cur; f[nn] = ng + Math.hypot(ei - ni, ej - nj); push(nn); } } }
            if (!found) return null; const pts = []; let c = E; while (c !== S && c >= 0) { pts.push([cx(c % nx), cz((c / nx) | 0)]); c = from[c]; } pts.reverse(); pts.push([bx, bz]);
            // string-pull: drop waypoints that have a clear straight line
            const out = []; let cur = [ax, az], k = 0; while (k < pts.length) { let far = k; for (let m = pts.length - 1; m > k; m--) { if (NV.line(cur[0], cur[1], pts[m][0], pts[m][1])) { far = m; break; } } out.push(pts[far]); cur = pts[far]; k = far + 1; } return out;
        };
        NV.line = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / (cell * .5))); for (let i = 1; i <= n; i++) if (!NV.free(ax + (bx - ax) * i / n, az + (bz - az) * i / n)) return false; return true; };
        return NV;
    };
    if (typeof module !== 'undefined') module.exports = N3; else root.NR3D = N3;
})(typeof window !== 'undefined' ? window : globalThis);
