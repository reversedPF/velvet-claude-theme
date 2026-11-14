// Velvet glow and its variants. Writes standalone SVGs and a TS module of scene strings.
const fs = require('fs');
const path = require('path');
const [svgDir, tsOut] = process.argv.slice(2);
fs.mkdirSync(svgDir, { recursive: true });

const W = 1600, H = 900;
function rng(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const f1 = n => +n.toFixed(1);
const blur = (id, sd, pad = 80) => `<filter id="${id}" x="-${pad}%" y="-${pad}%" width="${100 + 2 * pad}%" height="${100 + 2 * pad}%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
const lg = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] ?? 1}"/>`).join('')}</linearGradient>`;

const REDUCE = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';
const BASE_STYLE = `.d1{animation:d1 46s ease-in-out infinite alternate}.d2{animation:d2 58s ease-in-out infinite alternate}.d3{animation:d3 70s ease-in-out infinite alternate}.br{animation:br 14s ease-in-out infinite alternate}
@keyframes d1{to{transform:translate(-90px,-40px)}}@keyframes d2{to{transform:translate(70px,-60px) scale(1.08)}}@keyframes d3{to{transform:translate(-40px,50px)}}@keyframes br{from{opacity:.55}to{opacity:.9}}`;
const BASE_DEFS = blur('b1', 130) + blur('b2', 60) + blur('b3', 15) +
  `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="3" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.1 -0.45"/></filter>` +
  `<radialGradient id="vig" cx=".5" cy=".45" r=".78"><stop offset=".55" stop-color="#05030a" stop-opacity="0"/><stop offset="1" stop-color="#05030a" stop-opacity=".6"/></radialGradient>` +
  lg('base', [[0, '#0b0814'], [0.6, '#120b1f'], [1, '#1c0f27']]) +
  lg('rib', [[0, '#3b2a7a', 0], [0.35, '#7a3577'], [0.7, '#c45a86'], [1, '#e89a9a', 0]], 0, 0, 1, 0);

// The light fields every variant shares.
const fields = (dx = 0, dy = 0, boost = 1) => `<g transform="translate(${dx},${dy})">
<g filter="url(#b1)"><g class="d1"><ellipse cx="1340" cy="830" rx="560" ry="380" fill="#6a2368" opacity="${Math.min(1, 0.95 * boost)}"/></g><g class="d3"><ellipse cx="180" cy="-40" rx="640" ry="300" fill="#33246e" opacity="${Math.min(1, 0.7 * boost)}"/></g><g class="d2"><ellipse cx="1080" cy="620" rx="300" ry="220" fill="#7c2a6a" opacity="${Math.min(1, 0.55 * boost)}"/></g></g>
<g filter="url(#b2)" class="br"><ellipse cx="1480" cy="900" rx="300" ry="200" fill="#b14d73" opacity="${Math.min(1, 0.75 * boost)}"/><ellipse cx="1560" cy="960" rx="170" ry="120" fill="#f0a08e" opacity="${Math.min(1, 0.55 * boost)}"/></g></g>`;
const RIB1 = 'M-100,760 C300,600 620,820 980,700 S1460,470 1720,560';
const RIB2 = 'M-100,800 C320,660 640,860 1000,760 S1480,540 1720,640';
const ribbon = (cls = 'd2') => `<g filter="url(#b3)" class="${cls}"><path d="${RIB1}" fill="none" stroke="url(#rib)" stroke-width="34" opacity=".55"/><path d="${RIB2}" fill="none" stroke="url(#rib)" stroke-width="10" opacity=".45"/></g>`;
// The art is drawn in a 1600x900 design space and scaled onto a native 2560x1440 canvas,
// where the grain is laid at the screen's own pixel size so nothing reads as upscaled.
const CW = 2560, CH = 1440, K = CW / W;
const FINISH = `<rect width="${CW}" height="${CH}" filter="url(#grain)" opacity=".13"/><rect width="${CW}" height="${CH}" fill="url(#vig)"/>`;
const svg = (title, style, defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="xMidYMid slice"><title>${title}</title><style>${BASE_STYLE}${style}${REDUCE}</style><defs>${BASE_DEFS}${defs}</defs><g transform="scale(${K})"><rect width="${W}" height="${H}" fill="url(#base)"/>${body}</g>${FINISH}</svg>`;

// 1. Classic: the chosen look, finalized.
function classic() {
  return svg('Soft plum and rose light drifting through dark violet', '', '', fields() + ribbon());
}

// 2. Satin: the ribbon catches a slow sweep of light, like satin turning; a mirrored violet ribbon up top.
function satin() {
  const style = `.sw{animation:sw 13s cubic-bezier(.45,0,.25,1) infinite}@keyframes sw{0%{transform:translateX(-700px)}70%,100%{transform:translateX(2100px)}}
.wv{animation:wv 22s ease-in-out infinite alternate}@keyframes wv{to{transform:translateY(-26px) rotate(-1.2deg)}}
.wv2{animation:wv2 27s ease-in-out infinite alternate}@keyframes wv2{to{transform:translateY(22px) rotate(1deg)}}`;
  const defs = blur('s1', 8) + blur('s2', 40) +
    lg('rib2', [[0, '#a07ae0', 0], [0.4, '#5b3fa8'], [0.75, '#3b2a7a'], [1, '#2a1f5e', 0]], 0, 0, 1, 0) +
    lg('bar', [[0, '#fff', 0], [0.5, '#ffe6f0', 1], [1, '#fff', 0]], 0, 0, 1, 0) +
    `<mask id="m1" maskUnits="userSpaceOnUse" x="-200" y="0" width="2000" height="${H}"><g class="wv"><path d="${RIB1}" fill="none" stroke="#fff" stroke-width="30"/><path d="${RIB2}" fill="none" stroke="#fff" stroke-width="9"/></g></mask>`;
  const top = 'M1720,140 C1300,260 1000,60 640,170 S140,330 -120,250';
  const body = fields() +
    `<g class="wv"><g filter="url(#b3)"><path d="${RIB1}" fill="none" stroke="url(#rib)" stroke-width="34" opacity=".6"/><path d="${RIB2}" fill="none" stroke="url(#rib)" stroke-width="10" opacity=".5"/></g>
<g filter="url(#s1)" opacity=".85"><path d="${RIB1}" fill="none" stroke="url(#rib)" stroke-width="6" opacity=".5"/></g></g>
<g class="wv2" filter="url(#b3)"><path d="${top}" fill="none" stroke="url(#rib2)" stroke-width="26" opacity=".45"/><path d="M1720,190 C1320,300 1010,110 650,215 S150,370 -120,300" fill="none" stroke="url(#rib2)" stroke-width="8" opacity=".35"/></g>
<g mask="url(#m1)"><g class="sw" filter="url(#s2)"><rect x="0" y="0" width="260" height="${H}" fill="url(#bar)" opacity=".8" transform="skewX(-25)"/></g></g>`;
  return svg('Plum light with a satin ribbon that catches a slow sweep of light', style, defs, body);
}

// 3. Glass: frosted glass forms floating in the glow, refracting it.
function glass() {
  const style = `.fl1{animation:fl1 24s ease-in-out infinite alternate}@keyframes fl1{to{transform:translate(-14px,-22px) rotate(-1.5deg)}}
.fl2{animation:fl2 30s ease-in-out infinite alternate}@keyframes fl2{to{transform:translate(18px,16px) rotate(2deg)}}
.fl3{animation:fl3 19s ease-in-out infinite alternate}@keyframes fl3{to{transform:translate(10px,-18px)}}`;
  const shapes = {
    slab: { s: `<rect x="1050" y="430" width="440" height="310" rx="64" transform="rotate(-14 1270 585)"/>`, hl: [1150, 470, 120, 22, -14] },
    pill: { s: `<rect x="1180" y="120" width="330" height="120" rx="60" transform="rotate(18 1345 180)"/>`, hl: [1290, 140, 90, 14, 18] },
    orb: { s: `<circle cx="190" cy="520" r="104"/>`, hl: [150, 470, 42, 26, -30] },
  };
  let defs = blur('rf', 26) + blur('gl', 2.5) + blur('ish', 7) + blur('sp', 6) +
    lg('edge', [[0, '#ffffff', 0.95], [0.3, '#f6dcf8', 0.25], [0.65, '#ffffff', 0.04], [1, '#ffc2dc', 0.6]], 0, 0, 1, 1) +
    lg('shine', [[0, '#ffffff', 0.14], [0.5, '#ffffff', 0.04], [1, '#ffffff', 0]]) +
    `<radialGradient id="orbsh" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".10"/><stop offset=".7" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#0a0612" stop-opacity=".35"/></radialGradient>`;
  for (const [k, v] of Object.entries(shapes)) defs += `<clipPath id="c-${k}">${v.s}</clipPath>`;
  const still = m => m.replace(/class="(d\d|br)"/g, '');
  // Inside each form: the same light, shifted and brighter, so the glass bends it;
  // a dark inner rim, a soft glint, and a bright edge catching light from the top left.
  const form = (k, cls, dx, dy) => {
    const { s, hl } = shapes[k];
    return `<g class="${cls}"><g clip-path="url(#c-${k})">
<rect width="${W}" height="${H}" fill="#2a1a3d" opacity=".4"/>
<g filter="url(#rf)">${still(fields(dx, dy, 1.9))}</g>
<rect width="${W}" height="${H}" fill="#ffffff" opacity=".05"/><rect width="${W}" height="${H}" fill="url(#shine)"/>
${k === 'orb' ? `<circle cx="190" cy="520" r="104" fill="url(#orbsh)"/>` : ''}
<g fill="none" stroke="#0a0612" stroke-opacity=".45" stroke-width="16" filter="url(#ish)">${s}</g>
<ellipse cx="${hl[0]}" cy="${hl[1]}" rx="${hl[2]}" ry="${hl[3]}" transform="rotate(${hl[4]} ${hl[0]} ${hl[1]})" fill="#ffffff" opacity=".22" filter="url(#sp)"/></g>
<g fill="none" stroke="url(#edge)" stroke-width="3" filter="url(#gl)" opacity=".8">${s}</g><g fill="none" stroke="url(#edge)" stroke-width="1.2">${s}</g></g>`;
  };
  const body = fields() + ribbon() + form('slab', 'fl1', -110, -90) + form('pill', 'fl2', 80, 160) + form('orb', 'fl3', 260, 90);
  return svg('Frosted glass forms floating in soft plum light', style, defs, body);
}

// 4. Motes: soft out-of-focus specks of light rising slowly at three depths.
function motes() {
  const r = rng(91);
  const cols = ['#f6c2d6', '#ffd6c0', '#e8b0e6', '#ffcfb0'];
  const style = `.up{animation:up linear infinite}@keyframes up{from{transform:translateY(0)}to{transform:translateY(-1150px)}}
.sy{animation:sy ease-in-out infinite alternate}@keyframes sy{from{transform:translateX(-18px)}to{transform:translateX(18px)}}
.fd{animation:fd ease-in-out infinite alternate}@keyframes fd{from{opacity:.35}to{opacity:1}}`;
  const defs = blur('m1', 2, 300) + blur('m2', 5, 200) + blur('m3', 13, 200);
  const layer = (n, rMin, rMax, op, filt, speed) => {
    let o = `<g filter="url(#${filt})">`;
    for (let i = 0; i < n; i++) {
      const x = r() < 0.7 ? 700 + r() * 900 : r() * 700; // heavier on the right, where the light is
      const y = 300 + r() * 1100, rad = rMin + r() * (rMax - rMin), dur = speed * (0.75 + r() * 0.5);
      o += `<g class="up" style="animation-duration:${dur.toFixed(0)}s;animation-delay:-${(r() * dur).toFixed(0)}s"><g class="sy" style="animation-duration:${(6 + r() * 8).toFixed(1)}s"><circle class="fd" style="animation-duration:${(3 + r() * 5).toFixed(1)}s" cx="${f1(x)}" cy="${f1(y)}" r="${f1(rad)}" fill="${cols[i % cols.length]}" opacity="${op}"/></g></g>`;
    }
    return o + '</g>';
  };
  const body = fields() + ribbon() + layer(14, 2.6, 4, 0.6, 'm1', 120) + layer(20, 6, 10, 0.4, 'm2', 80) + layer(8, 20, 36, 0.2, 'm3', 55);
  return svg('Plum light with soft specks of light rising slowly', style, defs, body);
}

// 5. Silk: several ribbons of light flowing at different depths, the boldest variant.
function silk() {
  const style = `.w1{animation:w1 18s ease-in-out infinite alternate}@keyframes w1{to{transform:translateY(-34px) scaleY(1.08)}}
.w2{animation:w2 24s ease-in-out infinite alternate}@keyframes w2{to{transform:translateY(28px) scaleY(.94)}}
.w3{animation:w3 31s ease-in-out infinite alternate}@keyframes w3{to{transform:translate(-40px,-20px)}}
.w1,.w2,.w3{transform-box:fill-box;transform-origin:50% 50%}`;
  const defs = blur('k1', 30) + blur('k2', 12) + blur('k3', 3) +
    lg('ra', [[0, '#3b2a7a', 0], [0.3, '#6c3fae'], [0.65, '#b0549a'], [1, '#f0a0a0', 0]], 0, 0, 1, 0) +
    lg('rb', [[0, '#e89aba', 0], [0.35, '#c45a86'], [0.7, '#7a3577'], [1, '#3b2a7a', 0]], 0, 0, 1, 0) +
    lg('rc', [[0, '#ffffff', 0], [0.45, '#ffd9ea', 0.9], [0.6, '#f6c4ff', 0.6], [1, '#ffffff', 0]], 0, 0, 1, 0);
  const band = (d, w, stroke, op, filt, cls) => `<g class="${cls}" filter="url(#${filt})"><path d="${d}" fill="none" stroke="url(#${stroke})" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/></g>`;
  const body = fields() +
    band('M-150,620 C250,470 600,700 960,580 S1450,330 1750,420', 120, 'ra', 0.35, 'k1', 'w3') +
    band('M-150,840 C260,700 560,900 940,780 S1430,560 1750,640', 80, 'rb', 0.45, 'k1', 'w2') +
    band('M-150,740 C300,600 620,820 980,700 S1460,470 1750,560', 36, 'ra', 0.6, 'k2', 'w1') +
    band('M-150,760 C320,640 640,850 1000,740 S1480,520 1750,610', 14, 'rb', 0.7, 'k2', 'w2') +
    band('M-150,748 C310,615 630,835 990,718 S1470,492 1750,582', 3, 'rc', 0.8, 'k3', 'w1') +
    band('M1750,120 C1350,240 1020,50 660,160 S150,320 -150,240', 46, 'ra', 0.3, 'k1', 'w2');
  return svg('Ribbons of plum, violet and rose light flowing like silk', style, defs, body);
}

const scenes = { classic, satin, glass, motes, silk };
let ts = '// Generated: the Velvet scenes. Each is one SVG drawn behind the conversation.\n\n';
for (const [name, fn] of Object.entries(scenes)) {
  const s = fn();
  fs.writeFileSync(path.join(svgDir, `velvet-${name}.svg`), s);
  console.log(name, s.length, s.length > 131072 ? 'OVER LIMIT' : 'ok');
  ts += `export const ${name.toUpperCase()} = ${JSON.stringify(s)}\n\n`;
}
if (tsOut) fs.writeFileSync(tsOut, ts);
