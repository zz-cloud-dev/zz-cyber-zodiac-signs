/* ============================================================
 * 星语星图 · 分享卡生成（Canvas 1080 × 1440 · 小红书 3:4）
 * personal：星座大字 + 真实星图 + 运势 + 星语
 * match：双星座 + 合拍度环
 * 水印可配置（SHARE_CFG），用于小红书引流闭环。
 * ============================================================ */
(function () {
  'use strict';
  const D = window.XY;
  const FONT = '"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",sans-serif';

  // 分享卡水印/品牌配置 —— 渲染位置说明：
  //   brand  → 卡片左上角（如「星语星图 ✦」）
  //   slogan → 卡片底部中央（如「拥有一张属于你的星图」）
  //   handle → 卡片右下角（引流账号，如「小红书 @没有庸的程序员」）；留空 '' 则不渲染
  window.SHARE_CFG = window.SHARE_CFG || { brand: '星语星图', slogan: '拥有一张属于你的星图', handle: '小红书 @没有庸的程序员' };

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fit(pts, x, y, w, h) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const sx = (maxX - minX) || 1, sy = (maxY - minY) || 1;
    const s = Math.min(w / sx, h / sy) * 0.92;
    return { s, ox: x + (w - sx * s) / 2 - minX * s, oy: y + (h - sy * s) / 2 - minY * s };
  }

  /* 背景：星座暗夜渐变 + 星尘 + 角光 */
  function drawSky(ctx, th) {
    const g = ctx.createLinearGradient(0, 0, 0, 1440);
    g.addColorStop(0, th.skyA);
    g.addColorStop(0.55, th.skyB);
    g.addColorStop(1, th.skyC);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1440);
    // 星尘（确定性）
    const rand = D.util.rng(88);
    for (let i = 0; i < 130; i++) {
      const x = rand() * 1080, y = rand() * 1440;
      const r = 0.6 + rand() * 1.7;
      const a = 0.15 + rand() * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = rand() < 0.2 ? '#ffe9c8' : '#dfe6ff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 顶部品牌角光
    const glow = ctx.createRadialGradient(540, 300, 40, 540, 300, 640);
    glow.addColorStop(0, 'rgba(' + th.rgb + ',.16)');
    glow.addColorStop(1, 'rgba(' + th.rgb + ',0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1000);
  }

  function drawTopBrand(ctx) {
    const cfg = window.SHARE_CFG;
    ctx.fillStyle = 'rgba(255,255,255,.86)';
    ctx.font = '600 34px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(cfg.brand + '  ✦', 84, 118);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = '500 26px ' + FONT;
    ctx.fillText('专属星图', 996, 118);
  }

  /* 绘制星图：点 + 外鼓线 */
  function drawConstellation(ctx, signName, x, y, w, h, opts) {
    const { P, mags, edges } = XY.svg2d.prepare2D(signName);
    const f = fit(P, x, y, w, h);
    const si = D.SIGNS.findIndex(s => s.name === signName);
    const sorted = [...mags].sort((a, b) => a - b);
    const lv = (m, rank) => (m <= 2.2 || rank === 0) ? 'bright' : (m <= 3.5 || rank === 1) ? 'mid' : 'faint';
    const px = (p, i) => [f.ox + P[i][0] * f.s, f.oy + P[i][1] * f.s];

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 线
    ctx.strokeStyle = 'rgba(232,238,255,.66)';
    ctx.lineWidth = 1.6;
    edges.forEach(([a, b]) => {
      const p1 = P[a], p2 = P[b];
      const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
      // 外鼓控制点（轻微）
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
      const len = Math.hypot(dx, dy) || 1;
      const bx = mx - dy / len * 6, by = my + dx / len * 6;
      ctx.beginPath();
      ctx.moveTo(f.ox + p1[0] * f.s, f.oy + p1[1] * f.s);
      ctx.quadraticCurveTo(f.ox + bx * f.s, f.oy + by * f.s, f.ox + p2[0] * f.s, f.oy + p2[1] * f.s);
      ctx.stroke();
    });
    // 星点
    mags.forEach((m, i) => {
      const [cx, cy] = px(P, i);
      const col = XY.svg2d.pickColorHex(si, i, lv(m, sorted.indexOf(m)));
      const R0 = f.s * (lv(m, sorted.indexOf(m)) === 'bright' ? 0.016 : lv(m, sorted.indexOf(m)) === 'mid' ? 0.011 : 0.007);
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = R0 * 5;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(R0 * 2.4, 1.6), 0, 6.283);
      ctx.fill();
      ctx.restore();
    });
    if (opts && opts.ring) {
      ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2 + 8, 0, 6.283);
      ctx.stroke();
    }
  }

  function wrapText(ctx, text, maxW) {
    const lines = [];
    let cur = '';
    for (const ch of String(text)) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* ---------------- 专属星图卡 ---------------- */
  function drawPersonal(data) {
    // data: { sign(对象), dateLabel, fortune(4 items), wise }
    const th = D.themeOf(data.sign);
    const cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 1440;
    const ctx = cv.getContext('2d');
    const cfg = window.SHARE_CFG;
    drawSky(ctx, th);

    // 顶部
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = '800 44px ' + FONT;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255,255,255,.55)';
    ctx.shadowBlur = 30;
    ctx.fillText(data.sign.glyph, 540, 310);
    ctx.shadowBlur = 0;
    // 星座名
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 120px ' + FONT;
    ctx.fillText(data.sign.name, 540, 470);
    ctx.fillStyle = 'rgba(255,255,255,.66)';
    ctx.font = '500 44px ' + FONT;
    ctx.fillText(data.sign.en.toUpperCase(), 540, 536);

    // 星图
    drawConstellation(ctx, data.sign.name, 140, 620, 800, 430, { ring: true });

    // 运势四维（细柱）
    const names = ['整体', '爱情', '事业', '财运'];
    const bw = 162, gap = (800 - bw * 4) / 3;
    ctx.textAlign = 'left';
    for (let i = 0; i < 4; i++) {
      const bx = 140 + i * (bw + gap);
      const item = data.fortune[i];
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.font = '500 24px ' + FONT;
      ctx.fillText(names[i] + ' ' + item.val, bx, 1120);
      rr(ctx, bx, 1140, bw, 10, 5);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fill();
      rr(ctx, bx, 1140, bw * item.val / 100, 10, 5);
      const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, th.accent);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 星语
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = '600 40px ' + FONT;
    ctx.textAlign = 'center';
    const wl = wrapText(ctx, '「' + data.wise + '」', 860);
    wl.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, 540, 1240 + i * 58));

    // 底部
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = '500 26px ' + FONT;
    ctx.fillText(cfg.slogan, 540, 1372);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '600 30px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(data.dateLabel + ' 生成', 84, 1408);
    ctx.textAlign = 'right';
    if (cfg.handle) ctx.fillText(cfg.handle, 996, 1408);
    return cv.toDataURL('image/png');
  }

  /* ---------------- 合拍星卡 ---------------- */
  function drawMatch(m) {
    // m: matchFor() 结果 + dateLabel
    const th = D.themeOf(m.A);
    const cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 1440;
    const ctx = cv.getContext('2d');
    const cfg = window.SHARE_CFG;
    drawSky(ctx, th);

    // 标题
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = '800 46px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('星座合拍', 540, 150);
    ctx.font = '500 30px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText(cfg.slogan, 540, 204);

    // 两个星图并排
    drawConstellation(ctx, m.A.name, 70, 300, 380, 380);
    drawConstellation(ctx, m.B.name, 630, 300, 380, 380);
    // 名字
    ctx.fillStyle = '#fff';
    ctx.font = '800 60px ' + FONT;
    ctx.fillText(m.A.name, 260, 730);
    ctx.fillText(m.B.name, 820, 730);

    // 中间环：渐变弧 + 内衬圆（让数字永远悬在净空上，不与弧线相碰）
    const cx = 540, cy = 470, rad = 108;
    ctx.lineCap = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, 6.283);
    ctx.stroke();
    const g = ctx.createLinearGradient(cx - rad, 0, cx + rad, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, th.accent);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + 6.283 * m.score / 100);
    ctx.stroke();
    // 内衬：深夜色半透明圆 → 弧线下层被兜住，上层数字干净
    ctx.beginPath();
    ctx.arc(cx, cy, 82, 0, 6.283);
    ctx.fillStyle = 'rgba(18, 13, 42, .72)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.stroke();
    ctx.lineWidth = 14; // 还原，避免影响后续绘制
    // 数字（大）+ %（上标小字）：拼接测宽后整体居中
    ctx.textAlign = 'left';
    const bigFont = '900 84px ' + FONT;
    const pctFont = '900 44px ' + FONT;
    ctx.font = bigFont;
    const bigW = ctx.measureText(String(m.score)).width;
    ctx.font = pctFont;
    const pctW = ctx.measureText('%').width;
    const gap = 7, totalW = bigW + gap + pctW;
    const x0 = cx - totalW / 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = bigFont;
    ctx.fillText(String(m.score), x0, cy + 30);
    ctx.font = pctFont;
    // % 上标对齐数字顶缘（基线按字高差上移），整体视觉重心居中
    ctx.fillText('%', x0 + bigW + gap, cy + 2);
    // 内衬下方小字标签
    ctx.font = '700 30px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.textAlign = 'center';
    ctx.fillText('合拍度', cx, cy + 66);
    // 关键词
    ctx.fillStyle = '#fff';
    ctx.font = '800 66px ' + FONT;
    ctx.fillText('· ' + m.kw + ' ·', 540, 900);
    // 元素关系
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = '600 36px ' + FONT;
    ctx.fillText(m.elKw, 540, 990);

    // 文案（2 行截断）
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.font = '500 38px ' + FONT;
    const lines = wrapText(ctx, m.txt, 880);
    lines.slice(0, 3).forEach((ln, i) => ctx.fillText(ln, 540, 1120 + i * 62));

    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = '500 26px ' + FONT;
    ctx.fillText(cfg.slogan, 540, 1380);
    return cv.toDataURL('image/png');
  }

  window.XY.share = { drawPersonal, drawMatch };
})();
