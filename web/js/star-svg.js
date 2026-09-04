/* ============================================================
 * 星语星图 · 2D 星座星图引擎（真实亮星 · SVG）
 * 星点/连线/闪烁动画全部本地生成，背景透明（由 scene 渐变承载）。
 * ============================================================ */
(function () {
  'use strict';
  const D = window.XY;

  /* 赤经/赤纬 → 归一化坐标（绕星座中心 RA 展开，等距投影 + 纬度 cos 校正） */
  function projectConst(stars) {
    const cd = stars.reduce((a, p) => a + p[1], 0) / stars.length * Math.PI / 180;
    const cosd = Math.cos(cd);
    const mid = stars.reduce((a, p) => a + p[0], 0) / stars.length;
    const ras = stars.map(p => { let x = p[0] - mid; if (x > 12) x -= 24; else if (x < -12) x += 24; return x; });
    const raw = ras.map((r, i) => [-r * 15 * cosd, -stars[i][1]]);
    const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
    const lo = 0.14, hi = 0.86, box = hi - lo;
    const scale = Math.min(box / spanX, box / spanY);
    const offX = lo + (box - spanX * scale) / 2, offY = lo + (box - spanY * scale) / 2;
    return raw.map(p => [offX + (p[0] - minX) * scale, offY + (p[1] - minY) * scale]);
  }

  /* 星点配色：暗夜星野多色，亮星暖白/粉金，暗星冷蓝紫 */
  const STAR_COLORS = {
    bright: ['#FFFFFF', '#FFD9EC', '#FFF0D0', '#FFFFFF', '#FFE0F0'],
    mid:    ['#FFF0D0', '#FFE8D8', '#FFFFFF', '#E6DCFF', '#FFE4CE'],
    faint:  ['#C4D8FF', '#D6CCF5', '#B8C4E0', '#98AAD0', '#D8D0F0'],
  };
  function pickColor(si, i, level) {
    const arr = STAR_COLORS[level];
    const h = Math.abs((si * 131 + i * 17 + (level === 'bright' ? 7 : level === 'mid' ? 3 : 11)) | 0);
    return arr[h % arr.length];
  }
  function starLevel(mag, rank) {
    if (mag <= 1.9) return { lvl: 'bright', R: Math.max(2.6, 4.4 - mag * 0.55) };
    if (mag <= 3.5) return { lvl: 'mid', R: Math.max(1.7, 4.0 - mag * 0.6) };
    if (rank === 0) return { lvl: 'bright', R: Math.max(2.5, 4.2 - mag * 0.5) };
    if (rank === 1) return { lvl: 'mid', R: Math.max(1.7, 3.8 - mag * 0.55) };
    return { lvl: 'faint', R: Math.max(1.0, 3.6 - mag * 0.8) };
  }

  /* 单颗星：光晕 + 十字芒 +（亮星）X 芒 + 亮核 */
  function sparkle(cx, cy, R, lvl) {
    const L = R * (lvl === 'bright' ? 4.4 : lvl === 'mid' ? 3.2 : 2.0);
    const sw = lvl === 'bright' ? 0.6 : lvl === 'mid' ? 0.5 : 0.35;
    const haloR = lvl === 'bright' ? R * 2.6 : lvl === 'mid' ? R * 2.0 : R * 1.5;
    const haloOp = lvl === 'bright' ? 0.2 : lvl === 'mid' ? 0.15 : 0.11;
    let d = '<circle cx="' + cx + '" cy="' + cy + '" r="' + haloR.toFixed(2) + '" class="sp-halo" style="opacity:' + haloOp + '"/>';
    d += '<line x1="' + cx + '" y1="' + (cy - L).toFixed(2) + '" x2="' + cx + '" y2="' + (cy + L).toFixed(2) + '" class="sp-v" style="stroke-width:' + sw + '"/>';
    d += '<line x1="' + (cx - L).toFixed(2) + '" y1="' + cy + '" x2="' + (cx + L).toFixed(2) + '" y2="' + cy + '" class="sp-h" style="stroke-width:' + sw + '"/>';
    if (lvl === 'bright') {
      const Dx = R * 2.6;
      d += '<line x1="' + (cx - Dx).toFixed(2) + '" y1="' + (cy - Dx).toFixed(2) + '" x2="' + (cx + Dx).toFixed(2) + '" y2="' + (cy + Dx).toFixed(2) + '" class="sp-d" style="stroke-width:.3"/>';
      d += '<line x1="' + (cx - Dx).toFixed(2) + '" y1="' + (cy + Dx).toFixed(2) + '" x2="' + (cx + Dx).toFixed(2) + '" y2="' + (cy - Dx).toFixed(2) + '" class="sp-d" style="stroke-width:.3"/>';
    }
    d += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * (lvl === 'bright' ? 0.9 : 0.85)).toFixed(2) + '" class="sp-core"/>';
    return d;
  }

  /* viewBox 240×180 的像素映射 */
  const px = p => [Math.round(18 + p[0] * 204), Math.round(14 + p[1] * 152)];

  /** 渲染 2D 星座星图。data: {stars,mags,segs}（由 prepare2D 输出）；isDraw=是否播放连线动画 */
  function constellationSVG(sign, isDraw) {
    const data = prepare2D(sign);
    const si = D.SIGNS.findIndex(s => s.name === sign);
    const { P, mags, edges } = data;
    const sortedMags = [...mags].sort((a, b) => a - b);
    const levels = mags.map(m => starLevel(m, sortedMags.indexOf(m)));

    const lineParts = edges.map(([a, b], i) =>
      '<path class="star-line" style="--ld:' + (i * 0.13).toFixed(2) + 's" d="M' + P[a][0] + ' ' + P[a][1] + ' L' + P[b][0] + ' ' + P[b][1] + '"></path>'
    ).join('');

    const starParts = P.map((p, i) => {
      const { lvl, R } = levels[i];
      const col = pickColor(si, i, lvl);
      const h1 = D.util.hash(sign + ':' + i + ':' + (si + 1));
      const dly = ((h1 % 100) / 100 * 3.1).toFixed(2);
      const dur = (3.2 + (h1 % 45) / 100).toFixed(2);
      const dur2 = (dur * 0.62).toFixed(2);
      const dur3 = (dur * 1.55).toFixed(2);
      const dur4 = (dur * 2.3).toFixed(2);
      return '<g class="star-sparkle" style="color:' + col + ';--d:' + dly + 's;--dur:' + dur + 's;--dur2:' + dur2 + 's;--dur3:' + dur3 + 's;--dur4:' + dur4 + 's">' +
        sparkle(p[0], p[1], R, lvl) + '</g>';
    }).join('');

    // 远景星点（确定性散布，避开主星 7px）
    const rand = D.util.rng((si + 1) * 9173);
    const bgParts = [];
    let placed = 0, tries = 0;
    while (placed < 26 && tries < 400) {
      const x = 10 + rand() * 220, y = 8 + rand() * 164;
      const r = 0.35 + rand() * 0.6;
      const op = 0.3 + rand() * 0.34;
      const col = ['#E6ECFF', '#C0D0F0', '#FFFFFF', '#D8D2F0'][Math.floor(rand() * 4)];
      if (!P.some(p => Math.hypot(x - p[0], y - p[1]) < 7)) {
        if (rand() < 0.28) {
          bgParts.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(2) + '" fill="' + col + '" class="bg-twinkle" style="--d:' + (rand() * 5).toFixed(2) + 's"/>');
        } else {
          bgParts.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(2) + '" fill="' + col + '" opacity="' + op.toFixed(2) + '"/>');
        }
        placed++;
      }
      tries++;
    }

    return '<svg class="constellation ' + (isDraw ? 'is-drawing' : '') + '" viewBox="0 0 240 180" aria-hidden="true">' +
      '<g class="bg-stars">' + bgParts.join('') + '</g>' +
      lineParts + starParts + '</svg>';
  }

  /** 供 2D/3D/分享卡共用的投影数据缓存 */
  const cache = {};
  function prepare2D(sign) {
    if (cache[sign]) return cache[sign];
    const c = D.CONSTELLATIONS_ACCURATE[sign] || D.CONSTELLATIONS_ACCURATE['白羊座'];
    cache[sign] = {
      P: projectConst(c.stars.map(s => [s.ra, s.dec])).map(px),
      mags: c.stars.map(s => s.mag),
      edges: c.segs,
    };
    return cache[sign];
  }

  window.XY.svg2d = { prepare2D, constellationSVG, pickColorHex: pickColor };
})();
