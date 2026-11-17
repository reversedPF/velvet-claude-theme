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

// --- Still scenes: the same art with no filter, animation or grain, for /velvet still. ---
// The app redraws a backdrop whenever the panels above it repaint; SVG blur filters make each
// redraw costly on a modest GPU, while gradients and plain strokes cost next to nothing. So a
// blurred shape becomes a gradient with the blur's own falloff, and a blurred stroke becomes
// three nested strokes whose stacked opacity follows that falloff.
let LITE = false;
let liteDefs = [];
const liteIds = new Map();
const f3 = n => +n.toFixed(3);
const erf = x => {
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
};
const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));

// A filled ellipse blurred by sd, as an ellipse filled with a radial gradient.
function glow(cx, cy, rx, ry, color, op, sd, extra = '') {
  const ex = rx + 3 * sd, ey = ry + 3 * sd;
  const at = (r, e, t) => (1 - Math.exp(-(r * r) / (2 * sd * sd))) * Phi((r - t * e) / sd) / Phi(r / sd);
  let stops = '';
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, a = op * (at(rx, ex, t) + at(ry, ey, t)) / 2;
    stops += `<stop offset="${f3(t)}" stop-color="${color}" stop-opacity="${f3(Math.max(0, Math.min(1, a)))}"/>`;
  }
  if (!liteIds.has(stops)) {
    const id = `lg${liteIds.size}`;
    liteIds.set(stops, id);
    liteDefs.push(`<radialGradient id="${id}">${stops}</radialGradient>`);
  }
  return `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(ex)}" ry="${f1(ey)}" fill="url(#${liteIds.get(stops)})"${extra}/>`;
}

// A stroke of width w and opacity op blurred by sd, as nested strokes (more for a wider blur,
// so no step shows), each reaching where the blur's falloff crosses the next level: draw(width, opacity).
function soft(draw, w, sd, op) {
  const prof = d => Phi((w / 2 - d) / sd) + Phi((w / 2 + d) / sd) - 1;
  const peak = prof(0), P = op * peak, n = Math.min(8, 3 + Math.ceil(sd / 6));
  const reach = f => {
    let lo = 0, hi = w / 2 + 4 * sd;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (prof(m) > f * peak) lo = m; else hi = m; }
    return lo;
  };
  let out = '', before = 0;
  for (let k = 1; k <= n; k++) {
    // Between levels (k-0.5)/n and (k+0.5)/n the falloff averages k/n; inside the last, (n-0.25)/n.
    const total = P * (k < n ? k / n : (n - 0.25) / n), a = 1 - (1 - total) / (1 - before);
    out += draw(f1(Math.max(0.5, 2 * reach((k - 0.5) / n))), f3(Math.max(0, a)));
    before = total;
  }
  return out;
}

// The light fields every variant shares; `more` is any further blur laid over them.
const fieldsLite = (dx, dy, boost, more = 0) => {
  const s1 = Math.hypot(130, more), s2 = Math.hypot(60, more), o = v => Math.min(1, v * boost);
  return `<g transform="translate(${dx},${dy})">` +
    glow(1340, 830, 560, 380, '#6a2368', o(0.95), s1) + glow(180, -40, 640, 300, '#33246e', o(0.7), s1) +
    glow(1080, 620, 300, 220, '#7c2a6a', o(0.55), s1) +
    glow(1480, 900, 300, 200, '#b14d73', o(0.75), s2) + glow(1560, 960, 170, 120, '#f0a08e', o(0.55), s2) + '</g>';
};
const strokeLite = (d, stroke, w, sd, op, cap = '') =>
  soft((sw, a) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}"${cap} opacity="${a}"/>`, w, sd, op);

// The light fields every variant shares.
const fields = (dx = 0, dy = 0, boost = 1) => LITE ? fieldsLite(dx, dy, boost) : `<g transform="translate(${dx},${dy})">
<g filter="url(#b1)"><g class="d1"><ellipse cx="1340" cy="830" rx="560" ry="380" fill="#6a2368" opacity="${Math.min(1, 0.95 * boost)}"/></g><g class="d3"><ellipse cx="180" cy="-40" rx="640" ry="300" fill="#33246e" opacity="${Math.min(1, 0.7 * boost)}"/></g><g class="d2"><ellipse cx="1080" cy="620" rx="300" ry="220" fill="#7c2a6a" opacity="${Math.min(1, 0.55 * boost)}"/></g></g>
<g filter="url(#b2)" class="br"><ellipse cx="1480" cy="900" rx="300" ry="200" fill="#b14d73" opacity="${Math.min(1, 0.75 * boost)}"/><ellipse cx="1560" cy="960" rx="170" ry="120" fill="#f0a08e" opacity="${Math.min(1, 0.55 * boost)}"/></g></g>`;
const RIB1 = 'M-100,760 C300,600 620,820 980,700 S1460,470 1720,560';
const RIB2 = 'M-100,800 C320,660 640,860 1000,760 S1480,540 1720,640';
const ribbon = (cls = 'd2') => LITE
  ? strokeLite(RIB1, 'url(#rib)', 34, 15, 0.55) + strokeLite(RIB2, 'url(#rib)', 10, 15, 0.45)
  : `<g filter="url(#b3)" class="${cls}"><path d="${RIB1}" fill="none" stroke="url(#rib)" stroke-width="34" opacity=".55"/><path d="${RIB2}" fill="none" stroke="url(#rib)" stroke-width="10" opacity=".45"/></g>`;
// The art is drawn in a 1600x900 design space and scaled onto a native 2560x1440 canvas,
// where the grain is laid at the screen's own pixel size so nothing reads as upscaled.
const CW = 2560, CH = 1440, K = CW / W;
const FINISH = `<rect width="${CW}" height="${CH}" filter="url(#grain)" opacity=".13"/><rect width="${CW}" height="${CH}" fill="url(#vig)"/>`;
// Still: no style (nothing moves), no filter or mask in the defs, the gradients glow() made, no grain.
const svgLite = (title, defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="xMidYMid slice"><title>${title}</title><defs>${(BASE_DEFS + defs).replace(/<(filter|mask)\b[\s\S]*?<\/\1>/g, '')}${liteDefs.join('')}</defs><g transform="scale(${K})"><rect width="${W}" height="${H}" fill="url(#base)"/>${body}</g><rect width="${CW}" height="${CH}" fill="url(#vig)"/></svg>`;
const svg = (title, style, defs, body) => LITE ? svgLite(title, defs, body) :
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
  if (LITE) {
    // The sweep of light is motion alone, so the still scene has none.
    const lite = fields() +
      strokeLite(RIB1, 'url(#rib)', 34, 15, 0.6) + strokeLite(RIB2, 'url(#rib)', 10, 15, 0.5) +
      strokeLite(RIB1, 'url(#rib)', 6, 8, 0.5 * 0.85) +
      strokeLite(top, 'url(#rib2)', 26, 15, 0.45) +
      strokeLite('M1720,190 C1320,300 1010,110 650,215 S150,370 -120,300', 'url(#rib2)', 8, 15, 0.35);
    return svg('Plum light with a satin ribbon that catches a slow sweep of light', style, defs, lite);
  }
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
    if (LITE) {
      return `<g><g clip-path="url(#c-${k})">
<rect width="${W}" height="${H}" fill="#2a1a3d" opacity=".4"/>
${fieldsLite(dx, dy, 1.9, 26)}
<rect width="${W}" height="${H}" fill="#ffffff" opacity=".05"/><rect width="${W}" height="${H}" fill="url(#shine)"/>
${k === 'orb' ? `<circle cx="190" cy="520" r="104" fill="url(#orbsh)"/>` : ''}
${soft((w, a) => `<g fill="none" stroke="#0a0612" stroke-width="${w}" opacity="${a}">${s}</g>`, 16, 7, 0.45)}
${glow(hl[0], hl[1], hl[2], hl[3], '#ffffff', 0.22, 6, ` transform="rotate(${hl[4]} ${hl[0]} ${hl[1]})"`)}</g>
${soft((w, a) => `<g fill="none" stroke="url(#edge)" stroke-width="${w}" opacity="${a}">${s}</g>`, 3, 2.5, 0.8)}<g fill="none" stroke="url(#edge)" stroke-width="1.2">${s}</g></g>`;
    }
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
  const SD = { m1: 2, m2: 5, m3: 13 };
  const layer = (n, rMin, rMax, op, filt, speed) => {
    let o = LITE ? '' : `<g filter="url(#${filt})">`;
    for (let i = 0; i < n; i++) {
      // Draw every random number in the same order either way, so the still motes sit where the moving ones start.
      const x = r() < 0.7 ? 700 + r() * 900 : r() * 700; // heavier on the right, where the light is
      const y = 300 + r() * 1100, rad = rMin + r() * (rMax - rMin), dur = speed * (0.75 + r() * 0.5);
      const delay = r() * dur, sway = 6 + r() * 8, fade = 3 + r() * 5;
      o += LITE
        ? glow(x, y, rad, rad, cols[i % cols.length], op, SD[filt])
        : `<g class="up" style="animation-duration:${dur.toFixed(0)}s;animation-delay:-${delay.toFixed(0)}s"><g class="sy" style="animation-duration:${sway.toFixed(1)}s"><circle class="fd" style="animation-duration:${fade.toFixed(1)}s" cx="${f1(x)}" cy="${f1(y)}" r="${f1(rad)}" fill="${cols[i % cols.length]}" opacity="${op}"/></g></g>`;
    }
    return LITE ? o : o + '</g>';
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
  const SD = { k1: 30, k2: 12, k3: 3 };
  const band = (d, w, stroke, op, filt, cls) => LITE ? strokeLite(d, `url(#${stroke})`, w, SD[filt], op, ' stroke-linecap="round"') : `<g class="${cls}" filter="url(#${filt})"><path d="${d}" fill="none" stroke="url(#${stroke})" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/></g>`;
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
  LITE = false;
  const s = fn();
  LITE = true;
  liteDefs = [];
  liteIds.clear();
  const still = fn();
  for (const [file, text, constant] of [[`velvet-${name}`, s, name.toUpperCase()], [`velvet-${name}-still`, still, `${name.toUpperCase()}_STILL`]]) {
    fs.writeFileSync(path.join(svgDir, `${file}.svg`), text);
    console.log(file, text.length, text.length > 131072 ? 'OVER LIMIT' : 'ok', /filter|animation|feTurbulence/.test(text) && file.endsWith('-still') ? 'HAS FILTER OR MOTION' : '');
    ts += `export const ${constant} = ${JSON.stringify(text)}\n\n`;
  }
}
if (tsOut) fs.writeFileSync(tsOut, ts);
