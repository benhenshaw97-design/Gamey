// Flat SVG drawings: part icons for the body map, and character portraits for the cards.
const f1 = n => (+n).toFixed(1);

export const DRAW = {
  core(p) {
    const [x, y] = p.cent, cs = p.cs;
    let v = '';
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .4; v += `M${f1(x)},${f1(y)} Q${f1(x + Math.cos(a + .5) * cs * .7)},${f1(y + Math.sin(a + .5) * cs * .7)} ${f1(x + Math.cos(a) * cs * 1.15)},${f1(y + Math.sin(a) * cs * 1.15)} `; }
    return `<path d="${v}" stroke="${p.flesh.vein}" stroke-opacity=".35" stroke-width="${f1(cs * .08)}" fill="none"/>
      <circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(cs * .62)}" fill="url(#${p.idp}-core)"><animate attributeName="r" values="${f1(cs * .58)};${f1(cs * .7)};${f1(cs * .58)}" dur="1.8s" repeatCount="indefinite"/></circle>`;
  },
  eye(p) {
    return p.pts.map(([x, y], i) => {
      const r = p.cs * .42;
      return `<g transform="translate(${f1(x)} ${f1(y)})"><g>
        <animateTransform attributeName="transform" type="scale" values="1 1;1 1;1 .08;1 1" keyTimes="0;.93;.96;1" dur="${f1(5 + (p.uid % 4))}s" begin="-${(p.uid * 1.3 + i) % 5}s" repeatCount="indefinite"/>
        <ellipse rx="${f1(r)}" ry="${f1(r * .85)}" fill="#e9e1c4"/>
        <circle r="${f1(r * .62)}" fill="#c9a227"/><ellipse rx="${f1(r * .14)}" ry="${f1(r * .55)}" fill="#050203"/>
        <circle cx="${f1(-r * .3)}" cy="${f1(-r * .3)}" r="${f1(r * .14)}" fill="#fff" opacity=".7"/></g></g>`;
    }).join('');
  },
  maw(p) {
    const [a, b] = p.pts, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, cs = p.cs;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, half = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 + cs * .42;
    let teeth = '';
    const n = 7;
    for (let i = 0; i < n; i++) {
      const x0 = -half * .85 + i * (half * 1.7 / n), x1 = x0 + half * 1.7 / n, xm = (x0 + x1) / 2;
      teeth += `M${f1(x0)},${f1(-cs * .2)} L${f1(xm)},${f1(cs * .02)} L${f1(x1)},${f1(-cs * .2)} M${f1(x0)},${f1(cs * .22)} L${f1(xm)},${f1(cs * .02)} L${f1(x1)},${f1(cs * .22)} `;
    }
    return `<g transform="translate(${f1(mx)} ${f1(my)}) rotate(${f1(ang)})">
      <ellipse rx="${f1(half)}" ry="${f1(cs * .36)}" fill="#170305" stroke="#3a0a0e" stroke-width="${f1(cs * .06)}"><animate attributeName="ry" values="${f1(cs * .3)};${f1(cs * .4)};${f1(cs * .3)}" dur="2.6s" repeatCount="indefinite"/></ellipse>
      <ellipse cy="${f1(cs * .1)}" rx="${f1(half * .4)}" ry="${f1(cs * .12)}" fill="#7a1a22"/>
      <path d="${teeth}" fill="#e9e1c4"/></g>`;
  },
  mouth(p) {
    const [x, y] = p.pts[0], cs = p.cs;
    return `<g transform="translate(${f1(x)} ${f1(y)})"><ellipse rx="${f1(cs * .34)}" ry="${f1(cs * .18)}" fill="#170305"><animate attributeName="ry" values="${f1(cs * .1)};${f1(cs * .22)};${f1(cs * .1)}" dur="1.7s" repeatCount="indefinite"/></ellipse>
      <path d="M${f1(-cs * .25)},${f1(-cs * .08)} l${f1(cs * .08)},${f1(cs * .12)} l${f1(cs * .08)},${f1(-cs * .12)} l${f1(cs * .08)},${f1(cs * .12)} l${f1(cs * .08)},${f1(-cs * .12)} l${f1(cs * .08)},${f1(cs * .12)}" fill="#e9e1c4"/></g>`;
  },
  tentacle(p) {
    const cs = p.cs, [ux, uy] = p.out, o = p.ordered;
    const base = [o[0][0] - ux * cs * .2, o[0][1] - uy * cs * .2], last = o[o.length - 1];
    const tip = [last[0] + ux * cs * 1.4, last[1] + uy * cs * 1.4];
    const L = Math.hypot(tip[0] - base[0], tip[1] - base[1]), ang = Math.atan2(tip[1] - base[1], tip[0] - base[0]) * 180 / Math.PI, w = cs * .3;
    let suck = '';
    for (let i = 1; i < 5; i++) suck += `<circle cx="${f1(L * i / 5.5)}" cy="${f1(w * .35)}" r="${f1(w * .22 * (1 - i / 6))}" fill="#c8b8a0" opacity=".55"/>`;
    return `<g transform="translate(${f1(base[0])} ${f1(base[1])}) rotate(${f1(ang)})"><g>
      <animateTransform attributeName="transform" type="rotate" values="-12;12;-12" dur="${f1(2.6 + (p.uid % 3) * .4)}s" begin="-${p.uid % 3}s" repeatCount="indefinite"/>
      <path d="M0,${f1(-w)} Q${f1(L * .5)},${f1(-w * 1.1)} ${f1(L)},${f1(w * .3)} Q${f1(L * .55)},${f1(w * .6)} 0,${f1(w)} Z" fill="${p.col}" stroke="rgba(0,0,0,.4)" stroke-width="${f1(cs * .05)}"/>${suck}</g></g>`;
  },
  claw(p) {
    const cs = p.cs, [ux, uy] = p.out, o = p.ordered, last = o[o.length - 1];
    const end = [last[0] + ux * cs * .5, last[1] + uy * cs * .5], ang = Math.atan2(uy, ux) * 180 / Math.PI;
    const arm = o.map(q => q.map(f1).join(',')).join(' L');
    let talons = '';
    [-35, 0, 35].forEach(d => talons += `<path d="M0,0 Q${f1(cs * .6)},${f1(cs * d / 100)} ${f1(cs * 1)},${f1(cs * (d / 60 + .25))}" stroke="#e9e1c4" stroke-width="${f1(cs * .14)}" fill="none" stroke-linecap="round"/>`);
    return `<path d="M${arm} L${f1(end[0])},${f1(end[1])}" stroke="${p.col}" stroke-width="${f1(cs * .42)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <g transform="translate(${f1(end[0])} ${f1(end[1])}) rotate(${f1(ang)})"><g><animateTransform attributeName="transform" type="rotate" values="-8;8;-8" dur="3.2s" repeatCount="indefinite"/>${talons}</g></g>`;
  },
  horn(p) {
    const cs = p.cs, ang = Math.atan2(p.out[1], p.out[0]) * 180 / Math.PI;
    return p.pts.map(([x, y]) => `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)})">
      <path d="M0,${f1(-cs * .28)} Q${f1(cs * .9)},${f1(-cs * .4)} ${f1(cs * 1.5)},${f1(-cs * .75)} Q${f1(cs * .9)},${f1(cs * .02)} 0,${f1(cs * .28)} Z" fill="#b8a070" stroke="#5a4a30" stroke-width="${f1(cs * .05)}"/>
      <path d="M${f1(cs * .4)},${f1(-cs * .28)} l${f1(cs * .05)},${f1(cs * .4)} M${f1(cs * .8)},${f1(-cs * .38)} l${f1(cs * .05)},${f1(cs * .3)}" stroke="#5a4a30" stroke-width="${f1(cs * .04)}"/></g>`).join('');
  },
  wing(p) {
    const cs = p.cs, base = p.ordered[0], ang = Math.atan2(p.out[1], p.out[0]) * 180 / Math.PI, L = cs * 2.6;
    const tips = [-55, -15, 25].map(d => [Math.cos(d * Math.PI / 180) * L, Math.sin(d * Math.PI / 180) * L]);
    const bones = tips.map(t => `M0,0 L${f1(t[0])},${f1(t[1])}`).join(' ');
    const mem = `M0,0 L${f1(tips[0][0])},${f1(tips[0][1])} Q${f1(tips[0][0] * .55 + tips[1][0] * .2)},${f1((tips[0][1] + tips[1][1]) * .3)} ${f1(tips[1][0])},${f1(tips[1][1])} Q${f1(tips[1][0] * .55 + tips[2][0] * .2)},${f1((tips[1][1] + tips[2][1]) * .3)} ${f1(tips[2][0])},${f1(tips[2][1])} Z`;
    return `<g transform="translate(${f1(base[0])} ${f1(base[1])}) rotate(${f1(ang)})"><g>
      <animateTransform attributeName="transform" type="rotate" values="-10;14;-10" dur="2.4s" begin="-${p.uid % 2}s" repeatCount="indefinite"/>
      <path d="${mem}" fill="${p.col}" fill-opacity=".85" stroke="#1a1020" stroke-width="${f1(cs * .05)}"/>
      <path d="${bones}" stroke="#8a7a8a" stroke-width="${f1(cs * .1)}" stroke-linecap="round"/></g></g>`;
  },
  spine(p) {
    const cs = p.cs, [ux, uy] = p.out, px = -uy, py = ux;
    return p.pts.map(([x, y], i) => [-1, 1].map(s => {
      const bx = x + px * s * cs * .18, by = y + py * s * cs * .18, len = cs * (.9 + ((p.uid + i) % 3) * .15);
      return `<path d="M${f1(bx - px * cs * .1)},${f1(by - py * cs * .1)} L${f1(bx + ux * len)},${f1(by + uy * len)} L${f1(bx + px * cs * .1)},${f1(by + py * cs * .1)} Z" fill="#cfc4a8" stroke="#5a4a30" stroke-width="${f1(cs * .03)}"/>`;
    }).join('')).join('');
  },
  heart(p) {
    const [x, y] = p.pts[0], s = p.cs * .042;
    return `<g transform="translate(${f1(x)} ${f1(y)})"><g><animateTransform attributeName="transform" type="scale" values="1;1.22;1;1.1;1" dur="1.1s" repeatCount="indefinite"/>
      <path transform="scale(${f1(s)})" d="M0,6 C-12,-2 -8,-12 0,-6 C8,-12 12,-2 0,6 Z" fill="#b0182a" stroke="#4a0610" stroke-width="1.2"/>
      <circle cx="${f1(-p.cs * .12)}" cy="${f1(-p.cs * .14)}" r="${f1(p.cs * .06)}" fill="#ff8a8a" opacity=".6"/></g></g>`;
  },
  hive(p) {
    const [x, y] = p.cent, cs = p.cs;
    let s = '';
    [[0, 0, .75], [-.45, -.35, .45], [.45, -.3, .5], [-.4, .4, .5], [.45, .42, .45]].forEach(([a, b, r]) => s += `<circle cx="${f1(x + a * cs)}" cy="${f1(y + b * cs)}" r="${f1(r * cs)}" fill="#8a6a2a" stroke="#3a2a0a" stroke-width="${f1(cs * .04)}"/>`);
    [[-.3, -.1], [.2, -.3], [.1, .25], [-.2, .35], [.4, .1]].forEach(([a, b]) => s += `<circle cx="${f1(x + a * cs)}" cy="${f1(y + b * cs)}" r="${f1(cs * .1)}" fill="#1a1206"/>`);
    for (let i = 0; i < 3; i++) s += `<g><animateTransform attributeName="transform" type="rotate" from="${i * 120} ${f1(x)} ${f1(y)}" to="${i * 120 + 360} ${f1(x)} ${f1(y)}" dur="${2 + i * .7}s" repeatCount="indefinite"/><circle cx="${f1(x + cs * (1.1 + i * .2))}" cy="${f1(y)}" r="${f1(cs * .06)}" fill="#111"/></g>`;
    return s;
  },
  bone(p) {
    const cs = p.cs;
    return p.pts.map(([x, y], i) => `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${(i * 17 + p.uid * 7) % 20 - 10})">
      <rect x="${f1(-cs * .44)}" y="${f1(-cs * .4)}" width="${f1(cs * .88)}" height="${f1(cs * .8)}" rx="${f1(cs * .2)}" fill="#cfc4a8" stroke="#6e6553" stroke-width="${f1(cs * .05)}"/>
      <path d="M${f1(-cs * .2)},${f1(-cs * .3)} l${f1(cs * .12)},${f1(cs * .25)} l${f1(-cs * .06)},${f1(cs * .2)}" stroke="#6e6553" stroke-width="${f1(cs * .04)}" fill="none"/></g>`).join('');
  },
  void(p) {
    const [x, y] = p.pts[0], cs = p.cs, r = cs * .42;
    return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 1.35)}" fill="none" stroke="#8d6bd1" stroke-width="${f1(cs * .07)}"><animate attributeName="stroke-opacity" values=".2;.9;.2" dur="2.2s" repeatCount="indefinite"/></circle>
      <circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="#000"/>
      <g><animateTransform attributeName="transform" type="rotate" from="0 ${f1(x)} ${f1(y)}" to="360 ${f1(x)} ${f1(y)}" dur="4s" repeatCount="indefinite"/>
      <path d="M${f1(x - r * .6)},${f1(y)} A${f1(r * .6)},${f1(r * .6)} 0 0 1 ${f1(x + r * .6)},${f1(y)}" stroke="#b49ae8" stroke-width="${f1(cs * .05)}" fill="none" opacity=".7"/></g>`;
  },
};

export function partGeom(part, N, cs) {
  const pts = part.cells.map(([x, y]) => [(x - N / 2 + .5) * cs, (y - N / 2 + .5) * cs]);
  const cent = [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];
  let d = Math.hypot(cent[0], cent[1]);
  const out = d < 0.01 ? [0, -1] : [cent[0] / d, cent[1] / d];
  const ordered = pts.slice().sort((a, b) => (a[0] * out[0] + a[1] * out[1]) - (b[0] * out[0] + b[1] * out[1]));
  return { pts, cent, out, ordered };
}

export function portrait(style, horrorImage) {
  const bg = `<defs><radialGradient id="pbg"><stop offset="0" stop-color="#2a1a22"/><stop offset="1" stop-color="#07060a"/></radialGradient></defs><rect width="100" height="100" fill="url(#pbg)"/>`;
  const body = (robe) => `<path d="M10,104 Q16,70 50,64 Q84,70 90,104Z" fill="${robe}"/>`;
  const head = (skin, y) => `<circle cx="50" cy="${y || 44}" r="16" fill="${skin}"/>`;
  const eyes = (y, col) => `<circle cx="44" cy="${y}" r="1.8" fill="${col || '#120a0a'}"/><circle cx="56" cy="${y}" r="1.8" fill="${col || '#120a0a'}"/>`;
  let s = '';
  switch (style) {
    case 'horror':
      // a snapshot of the 3D creature, when one is available
      s = horrorImage ? `<image href="${horrorImage}" x="-20" y="-6" width="140" height="140" preserveAspectRatio="xMidYMid slice"/>`
        : `<circle cx="50" cy="52" r="20" fill="#5a0e14"/><circle cx="50" cy="50" r="7" fill="#e9e1c4"/><ellipse cx="50" cy="50" rx="1.6" ry="5" fill="#000"/>`;
      break;
    case 'hood':
      s = body('#4a1418') + `<path d="M26,72 Q24,30 50,22 Q76,30 74,72 Q50,62 26,72Z" fill="#5a1a20"/><ellipse cx="50" cy="48" rx="13" ry="16" fill="#0a0507"/>` + eyes(47, '#ffcf7a');
      break;
    case 'priest':
      s = body('#141018') + `<rect x="44" y="62" width="12" height="6" fill="#e9e1c4"/>` + head('#c9a888') + `<path d="M34,40 Q36,30 42,34 M66,40 Q64,30 58,34" stroke="#888" stroke-width="3" fill="none"/>` + eyes(45) + `<path d="M45,53 Q50,51 55,53" stroke="#5a3a2a" stroke-width="1.5" fill="none"/><path d="M50,74 v14 M44,79 h12" stroke="#c9a227" stroke-width="2.5"/>`;
      break;
    case 'elder':
      s = body('#3a3036') + `<path d="M24,80 Q50,58 76,80" fill="#5a4a4a"/>` + head('#c8a890') + `<circle cx="50" cy="27" r="9" fill="#bbb"/><path d="M34,42 Q36,28 50,28 Q64,28 66,42" fill="#aaa"/>` + eyes(45) + `<path d="M40,41 l6,1 M60,41 l-6,1 M45,54 h10" stroke="#5a3a2a" stroke-width="1.4"/>`;
      break;
    case 'hunter':
      s = body('#2a2218') + head('#b8987a', 47) + `<ellipse cx="50" cy="35" rx="32" ry="6" fill="#141010"/><rect x="36" y="16" width="28" height="20" rx="3" fill="#141010"/><rect x="36" y="30" width="28" height="3" fill="#5a1a1a"/>` + `<path d="M42,46 h5 M53,46 h5" stroke="#120a0a" stroke-width="2"/><path d="M44,56 h12" stroke="#4a3020" stroke-width="1.5"/>`;
      break;
    case 'child':
      s = `<path d="M24,104 Q28,76 50,72 Q72,76 76,104Z" fill="#5a6a8a"/>` + `<circle cx="50" cy="52" r="14" fill="#e0c0a0"/><circle cx="33" cy="50" r="6" fill="#8a5a2a"/><circle cx="67" cy="50" r="6" fill="#8a5a2a"/><path d="M37,48 Q38,36 50,36 Q62,36 63,48" fill="#8a5a2a"/>` + eyes(53) + `<path d="M46,59 Q50,62 54,59" stroke="#8a4a3a" stroke-width="1.4" fill="none"/>`;
      break;
    case 'stranger':
      s = body('#4a4a50') + `<path d="M24,76 Q22,26 50,18 Q78,26 76,76 Q50,64 24,76Z" fill="#5a5a62"/><ellipse cx="50" cy="46" rx="14" ry="17" fill="#000"/><circle cx="44" cy="45" r="2.2" fill="#dfe8ff"><animate attributeName="opacity" values="1;.3;1" dur="3s" repeatCount="indefinite"/></circle><circle cx="56" cy="45" r="2.2" fill="#dfe8ff"><animate attributeName="opacity" values="1;.3;1" dur="3s" repeatCount="indefinite"/></circle>`;
      break;
    case 'rival':
      s = body('#d8d0c4') + `<path d="M26,74 Q24,28 50,20 Q76,28 74,74 Q50,62 26,74Z" fill="#e8e2d8"/>` + head('#d8c8c0', 46) + eyes(46, '#7a8aa0') + `<path d="M40,84 q5,-5 10,0 t10,0" stroke="#9a9488" stroke-width="2.5" fill="none"/><path d="M46,54 Q50,56 54,54" stroke="#8a6a6a" stroke-width="1.4" fill="none"/>`;
      break;
    case 'peddler':
      s = body('#4a3a22') + `<path d="M22,78 L78,96" stroke="#6a4a2a" stroke-width="4"/>` + head('#c8a080') + `<path d="M34,36 Q50,22 66,36 Z" fill="#3a2a1a"/><path d="M36,50 Q50,78 64,50 Q50,58 36,50Z" fill="#ddd"/>` + eyes(43);
      break;
    case 'digger':
      s = body('#3a3428') + `<path d="M70,30 L84,100" stroke="#6a5a3a" stroke-width="4"/><path d="M78,92 l10,4 l-4,8 l-10,-4Z" fill="#888"/>` + head('#b89878') + `<path d="M32,38 Q50,24 68,38 L70,40 L30,40Z" fill="#2a2420"/>` + eyes(46) + `<path d="M43,55 h14" stroke="#4a3020" stroke-width="1.5"/>`;
      break;
    case 'constable':
      s = body('#1a2238') + `<circle cx="50" cy="80" r="3" fill="#c9a227"/>` + head('#c8a088', 48) + `<path d="M34,40 Q34,14 50,12 Q66,14 66,40 Z" fill="#141a2a"/><rect x="33" y="38" width="34" height="4" fill="#0a0e18"/>` + eyes(49) + `<path d="M42,57 Q50,54 58,57" stroke="#3a2010" stroke-width="2.5" fill="none"/>`;
      break;
    case 'village':
      s = `<circle cx="72" cy="26" r="9" fill="#e9e1c4" opacity=".8"/><path d="M0,100 L0,64 L12,54 L24,64 L24,58 L38,46 L52,58 L52,66 L66,56 L80,66 L80,52 L86,44 L92,52 L92,64 L100,60 L100,100Z" fill="#0d0a10"/><rect x="16" y="68" width="4" height="5" fill="#ffcf7a"/><rect x="42" y="62" width="4" height="5" fill="#ffcf7a" opacity=".7"/><rect x="70" y="70" width="4" height="5" fill="#ffcf7a"/>`;
      break;
    case 'omen':
      s = `<circle cx="50" cy="46" r="24" fill="#8a1a1a"><animate attributeName="r" values="23;25;23" dur="4s" repeatCount="indefinite"/></circle><circle cx="58" cy="40" r="22" fill="#07060a" opacity=".85"/><path d="M0,80 Q25,70 50,80 T100,78 L100,100 L0,100Z" fill="#100c14"/>`;
      break;
  }
  return `<svg viewBox="0 0 100 100">${bg}${s}</svg>`;
}

