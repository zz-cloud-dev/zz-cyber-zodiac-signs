/* ============================================================
 * 星语星图 · 应用入口与视图逻辑
 * 首页 / 专属星图（2D⇄3D）/ 星座合拍 / 分享卡
 * 星座主题色随所选星座实时注入 body。
 * ============================================================ */
(function () {
  'use strict';
  const D = window.XY;

  /* ---------- 轻量统计（本地计数，不上报） ---------- */
  const stats = {
    load() { try { return JSON.parse(localStorage.getItem('xy_stats') || '{}'); } catch (e) { return {}; } },
    inc(key) {
      try {
        const s = this.load();
        s[key] = (s[key] || 0) + 1;
        localStorage.setItem('xy_stats', JSON.stringify(s));
      } catch (e) { /* 隐私模式等场景静默失败 */ }
    },
  };

  /* ---------- 工具 ---------- */
  const $ = id => document.getElementById(id);
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('is-show'), 2300);
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  /** 按星座注入主题变量（accent / 星夜渐变 / 底色） */
  function applyTheme(sign) {
    const t = D.themeOf(sign);
    const b = document.body.style;
    b.setProperty('--accent', t.accent);
    b.setProperty('--accent-deep', t.accentDeep);
    b.setProperty('--accent-soft', t.accentSoft);
    b.setProperty('--accent-rgb', t.rgb);
    b.setProperty('--sky-a', t.skyA);
    b.setProperty('--sky-b', t.skyB);
    b.setProperty('--sky-c', t.skyC);
    document.body.dataset.sign = sign.name;
  }

  /* ---------- 视图路由 ---------- */
  let curView = 'home';
  function showView(name) {
    ['home', 'personal', 'match'].forEach(v => {
      const el = $('view-' + v);
      el.hidden = v !== name;
      el.classList.toggle('is-active', v === name);
    });
    if (name !== 'personal' && window.XY.gl3d) XY.gl3d.setVisible(false);
    document.body.classList.toggle('is-home', name === 'home');
    curView = name;
    window.scrollTo(0, 0);
  }
  // 返回键按层级走：结果态 → 回到选择页（星座切换）；选择页 → 回首页
  document.addEventListener('click', e => {
    const back = e.target.closest('[data-back]');
    if (!back) return;
    stats.inc('back');
    if (curView === 'personal' && !$('p-result').hidden) resetPersonal();
    else if (curView === 'match' && !$('m-result').hidden) resetMatch();
    else showView('home');
  });
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.go;
    stats.inc('enter_' + v);
    if (v === 'personal') resetPersonal();
    if (v === 'match') resetMatch();
    showView(v);
  }));

  // 回到输入态（清结果、熄 3D、清高亮、滚到顶）
  function resetPersonal() {
    if (window.XY.gl3d) XY.gl3d.setVisible(false);
    pickedSign = null;
    document.querySelectorAll('#zodiac-grid .zgrid__item').forEach(x => x.classList.remove('is-on'));
    $('p-result').hidden = true;
    $('p-input').hidden = false;
  }
  function resetMatch() {
    $('m-result').hidden = true;
    $('m-input').hidden = false;
  }

  /* ---------- 日期选择器（同一 factory，多实例复用） ---------- */
  const YEAR_FROM = 1940;
  function daysInMonth(y, m) {
    if (m === 2) return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : 28;
    return [4, 6, 9, 11].indexOf(m) >= 0 ? 30 : 31;
  }
  function setupDate(prefix) {
    const yEl = $(prefix + '-year');
    const mEl = $(prefix + '-month');
    const dEl = $(prefix + '-day');
    const nowY = new Date().getFullYear();
    yEl.innerHTML = '<option value="">年</option>' +
      Array.from({ length: nowY - YEAR_FROM + 1 }, (_, i) => nowY - i)
        .map(y => '<option value="' + y + '">' + y + '年</option>').join('');
    mEl.innerHTML = '<option value="">月</option>' +
      Array.from({ length: 12 }, (_, i) => i + 1)
        .map(m => '<option value="' + m + '">' + m + '月</option>').join('');
    const fillDays = () => {
      const y = Number(yEl.value), m = Number(mEl.value);
      const max = (y && m) ? daysInMonth(y, m) : 31;
      const keep = dEl.value;
      dEl.innerHTML = '<option value="">日</option>' +
        Array.from({ length: max }, (_, i) => i + 1)
          .map(d => '<option value="' + d + '">' + d + '日</option>').join('');
      if (keep && Number(keep) <= max) dEl.value = keep;
    };
    yEl.addEventListener('change', fillDays);
    mEl.addEventListener('change', fillDays);
    fillDays();
  }
  function readDate(prefix) {
    const y = $(prefix + '-year').value;
    const m = $(prefix + '-month').value;
    const d = $(prefix + '-day').value;
    if (!y || !m || !d) return '';
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  /* ---------- 12 星座点选格 ---------- */
  let pickedSign = null; // { name } 来自直接点选
  function renderGrid() {
    const grid = $('zodiac-grid');
    grid.innerHTML = D.SIGNS.map(s =>
      '<button type="button" class="zgrid__item" data-sign="' + s.name + '">' +
      '<span class="g">' + s.glyph + '</span><span class="n">' + s.name + '</span></button>'
    ).join('');
    grid.querySelectorAll('.zgrid__item').forEach(item => {
      item.addEventListener('click', () => {
        grid.querySelectorAll('.zgrid__item').forEach(x => x.classList.remove('is-on'));
        item.classList.add('is-on');
        pickedSign = D.signByName(item.dataset.sign);
      });
    });
  }

  /* ---------- 运势行（插入后做宽度动画） ---------- */
  function fortuneHTML(items) {
    return '<div class="fortune">' + items.map(it =>
      '<div class="fortune__row"><span class="fortune__k">' + it.name + '运势</span>' +
      '<span class="fortune__bar"><i class="fortune__fill" data-w="' + it.val + '"></i></span>' +
      '<span class="fortune__v">' + it.val + '</span></div>'
    ).join('') + '</div>';
  }
  function animateFortune() {
    requestAnimationFrame(() => {
      document.querySelectorAll('#r-fortune .fortune__fill').forEach((el, i) => {
        setTimeout(() => { el.style.width = el.dataset.w + '%'; }, 120 + i * 140);
      });
    });
  }

  /* ---------- 星图结果态 ---------- */
  let chartMode = '2d';
  let resultSign = null;
  function renderResult(data) {
    // data: { sign, dateLabel, fortune:[{name,val}x4], wise }
    resultSign = data.sign;
    applyTheme(data.sign);
    chartMode = '2d';
    $('p-input').hidden = true;
    $('p-result').hidden = false;

    $('r-name').textContent = data.sign.name;
    $('r-sub').textContent = data.sign.en + ' · ' + data.sign.from.map(x => String(x).padStart(2, '0')).join('.') + ' – ' +
      data.sign.to.map(x => String(x).padStart(2, '0')).join('.');
    $('r-element').textContent = D.ELEMENTS[data.sign.element].icon + ' ' + data.sign.element + '象星座';
    $('r-planet').textContent = '守护星 · ' + data.sign.planet;
    const th = D.themeOf(data.sign);
    $('r-color').innerHTML = '<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' +
      data.sign.hex + ';box-shadow:0 0 8px ' + data.sign.hex + ';margin-right:6px;vertical-align:-1px"></i>幸运色 · ' + data.sign.hex;

    $('chart-2d').innerHTML = XY.svg2d.constellationSVG(data.sign.name, true);
    $('chart-3d').hidden = true;
    $('chart-2d').style.display = 'flex';
    setSeg('2d');

    $('r-fortune').innerHTML = fortuneHTML(data.fortune);
    animateFortune();
    $('r-traits').innerHTML = data.sign.traits.map(t => '<span class="trait__chip">' + t + '</span>').join('');
    $('r-quote').textContent = data.wise;

    // 记录最近一次用于分享
    window._lastPersonal = data;
    window.scrollTo(0, 0);
    stats.inc('gen_personal');
  }
  function setSeg(mode) {
    document.querySelectorAll('.seg__btn').forEach(b =>
      b.classList.toggle('is-on', b.dataset.mode === mode));
    const two = $('chart-2d'), thr = $('chart-3d');
    if (mode === '2d') {
      thr.hidden = true; two.style.display = 'flex';
      if (window.XY.gl3d) XY.gl3d.setVisible(false);
    } else {
      if (!window.XY.gl3d || !XY.gl3d.enabled) { toast('当前浏览器不支持 3D 星图，已展示 2D 版'); setSeg('2d'); return; }
      two.style.display = 'none'; thr.hidden = false;
      XY.gl3d.setSign(resultSign.name);
      XY.gl3d.setVisible(true);
      setTimeout(() => XY.gl3d.resize(), 60);
      stats.inc('mode_3d');
    }
    chartMode = mode;
  }

  // 2D/3D 切换按钮
  document.querySelectorAll('.seg__btn').forEach(b => b.addEventListener('click', () => setSeg(b.dataset.mode)));

  /* ---------- 专属星图主流程 ---------- */
  function goPersonal() {
    const date = readDate('p');
    // signOf 由 mock 引擎提供（按生日判定星座）
    const sign = pickedSign || (date ? window.XY.mock.signOf(Number(date.split('-')[1]), Number(date.split('-')[2])) : null);
    if (!sign) { toast('先选生日，或直接点选一个星座吧'); return; }
    const fakeDate = date || ('2000-' + String(sign.from[0]).padStart(2, '0') + '-' + String(sign.from[1]).padStart(2, '0'));
    const data = window.XY.mock.fortuneFor(fakeDate);
    data.dateLabel = date ? D.util.fmtDate(date) : '直接在星盘点亮 · ' + sign.name;
    // 用点选星座覆盖 fortuneFor 可能判出的不同星座（fakeDate 已保证一致，防御性再设）
    data.sign = sign;
    renderResult(data);
  }
  $('p-go').addEventListener('click', goPersonal);
  $('p-again').addEventListener('click', () => { resetPersonal(); window.scrollTo(0, 0); });

  /* ---------- 合拍流程 ---------- */
  function goMatch() {
    const a = readDate('m1'), b = readDate('m2');
    if (!a || !b) { toast('把两个人的生日都选上吧'); return; }
    renderMatch(window.XY.mock.matchFor(a, b));
  }
  function renderMatch(m) {
    applyTheme(m.A);
    $('m-input').hidden = true;
    $('m-result').hidden = false;

    const elA = $('duo-a'), elB = $('duo-b');
    const signA = m.A, signB = m.B;
    elA.innerHTML = '<span class="g" style="color:' + signA.hex + '">' + signA.glyph + '</span>' +
      '<span class="n">' + signA.name + '</span><span class="e">' + signA.en + '</span>';
    elB.innerHTML = '<span class="g" style="color:' + signB.hex + '">' + signB.glyph + '</span>' +
      '<span class="n">' + signB.name + '</span><span class="e">' + signB.en + '</span>';

    // 环形仪表
    const mid = '#' + D.themeOf(m.A).accent, dim = '#7E7590';
    $('meter').innerHTML =
      '<svg viewBox="0 0 120 120">' +
      '<circle cx="60" cy="60" r="52" fill="none" stroke="' + dim + '" stroke-opacity=".14" stroke-width="10"/>' +
      '<circle class="meter-arc" cx="60" cy="60" r="52" fill="none" stroke="' + mid + '" stroke-width="10" stroke-linecap="round" ' +
      'stroke-dasharray="326.7" stroke-dashoffset="326.7" transform="rotate(-90 60 60)"/>' +
      '<text class="meter__val" x="60" y="68" text-anchor="middle">' + m.score + '</text>' +
      '<text class="meter__lbl" x="60" y="88" text-anchor="middle">合拍度 %</text></svg>';
    requestAnimationFrame(() => {
      setTimeout(() => {
        const arc = document.querySelector('.meter-arc');
        if (arc) arc.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)';
        arc.style.strokeDashoffset = 326.7 * (1 - m.score / 100);
      }, 200);
    });

    $('m-score').textContent = '合拍关键词 · ' + m.kw;
    $('m-kw').textContent = m.elKw;
    $('m-txt').textContent = m.txt;
    $('m-el').innerHTML = m.elTxt.replace(/　/g, '<br>');
    window._lastMatch = m;
    window.scrollTo(0, 0);
    stats.inc('gen_match');
  }
  $('m-go').addEventListener('click', goMatch);
  $('m-again').addEventListener('click', () => { resetMatch(); window.scrollTo(0, 0); });
  // 快速示例（首访提速：随机一对生日）
  $('m-input').insertAdjacentHTML('beforeend',
    '<button type="button" class="btn btn-ghost btn-block" id="m-random" style="margin-top:18px">✨ 懒得想？点这随机一对试试</button>');
  $('m-random').addEventListener('click', () => {
    const mk = () => {
      const y = 1990 + Math.floor(Math.random() * 22);
      const m = 1 + Math.floor(Math.random() * 12);
      const d = 1 + Math.floor(Math.random() * daysInMonth(y, m));
      return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    };
    const a = mk(), b = mk();
    renderMatch(window.XY.mock.matchFor(a, b));
  });

  /* ---------- 分享 ---------- */
  function openShare(type) {
    let url = '';
    if (type === 'personal' && window._lastPersonal) {
      const p = window._lastPersonal;
      url = XY.share.drawPersonal({
        sign: p.sign,
        dateLabel: p.dateLabel.indexOf('点亮') >= 0 ? '' : p.dateLabel,
        fortune: p.fortune,
        wise: p.wise,
      });
      stats.inc('share_personal');
    } else if (type === 'match' && window._lastMatch) {
      const m = window._lastMatch;
      url = XY.share.drawMatch(m);
      stats.inc('share_match');
    } else { return; }
    $('share-preview').innerHTML = '<img id="share-img" src="' + url + '" alt="我的星座星图">';
    $('share-modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  $('p-share').addEventListener('click', () => openShare('personal'));
  $('m-share').addEventListener('click', () => openShare('match'));
  function closeShare() {
    $('share-modal').hidden = true;
    document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-close-share]').forEach(el => el.addEventListener('click', closeShare));
  $('share-dl').addEventListener('click', () => {
    const img = $('share-img');
    if (!img) return;
    const a = document.createElement('a');
    a.href = img.src;
    a.download = window._lastMatch ? 'zodiac-match.png' : 'zodiac-sign.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('图片已保存，去分享吧');
  });

  /* ---------- 首页装饰：glyph 轮换 ---------- */
  function heroSpin() {
    let i = 0;
    const el = $('heroGlyph');
    const tick = () => {
      const s = D.SIGNS[i % 12];
      el.textContent = s.glyph;
      el.style.color = s.hex;
      i++;
    };
    tick();
    setInterval(tick, 2600);
  }

  /* ---------- 启动 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    setupDate('p');
    setupDate('m1');
    setupDate('m2');
    renderGrid();
    heroSpin();
    stats.inc('open');
  });
})();
