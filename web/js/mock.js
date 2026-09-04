/* ============================================================
 * 星语星图 · Mock 引擎（全本地 · 确定性）
 * 同一天/同一输入 → 永远同一结果，不联网、不落库。
 * ============================================================ */
(function () {
  'use strict';

  const D = window.XY;

  /* ---------- 基础工具 ---------- */
  function hash(str) {
    let h = 0;
    const s = String(str == null ? '' : str);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  // 确定性伪随机（seed 字符串）
  function rng(seedStr) {
    let s = hash(seedStr) || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s % 100000) / 100000;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------- 生日判定 ---------- */
  function signOf(m, d) {
    for (const s of D.SIGNS) {
      const fm = s.from[0], fd = s.from[1], tm = s.to[0], td = s.to[1];
      const afterStart = (m > fm) || (m === fm && d >= fd);
      const beforeEnd = (m < tm) || (m === tm && d <= td);
      if (fm <= tm) { if (afterStart && beforeEnd) return s; }
      else if (afterStart || beforeEnd) return s;
    }
    return D.SIGNS[0];
  }
  function fmtDate(date) {
    const [y, m, d] = date.split('-').map(Number);
    return y + '年' + m + '月' + d + '日';
  }

  /* ---------- 今日运势（4 维，当日稳定） ---------- */
  function fortuneFor(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const sun = signOf(m, d);
    const seed = todayStr() + ':' + sun.name;
    const r = rng(seed);
    const names = ['整体', '爱情', '事业', '财运'];
    const items = sun.luck.map((base, i) => {
      const jitter = Math.round((r() - 0.5) * 10);
      return { name: names[i], val: clamp(base + jitter, 52, 99) };
    });
    const wise = pick(r, sun.whisper);
    return { sun, fortune: items, wise };
  }

  /* ---------- 星座合拍 ---------- */
  const EL_BASE = {
    火: { 火: 86, 土: 72, 风: 88, 水: 62 },
    土: { 火: 72, 土: 84, 风: 64, 水: 86 },
    风: { 火: 88, 土: 64, 风: 84, 水: 76 },
    水: { 火: 62, 土: 86, 风: 76, 水: 84 },
  };
  const EL_KW = {
    火: { 火: '双倍热情，火花四溅', 土: '火光落地，踏实升温', 风: '风助火势，越处越燃', 水: '冰火相逢，靠近就暖' },
    土: { 火: '星火燎原，稳重生光', 土: '厚土相承，岁月静好', 风: '风吹土扬，需要磨合', 水: '水土滋养，细水长流' },
    风: { 火: '风吹火旺，自由共振', 土: '风土相斥，慢热试探', 风: '同频的风，来去自如', 水: '风起水皱，浪漫涟漪' },
    水: { 火: '水火相煎，戏剧张力', 土: '水土相生，温柔相依', 风: '水随风动，诗与远方', 水: '两片海相遇，温柔加倍' },
  };
  const LEVELS = [
    { min: 88, kw: '天作之合', desc: '星盘共振，你们像是提前约好来相遇的两颗星。' },
    { min: 78, kw: '越处越有', desc: '默契藏在细节里，相处越久越会发现彼此的好。' },
    { min: 68, kw: '需要经营', desc: '性格有温差，但只要愿意靠近，反而互补成糖。' },
    { min: 0, kw: '磨合剧本', desc: '两种星语需要翻译，慢一点，真诚永远有效。' },
  ];
  // 合拍解读模板（占位 {A} {B} 为两星座）
  const MATCH_TXT = [
    '在星图上，{A}和{B}相遇的那一刻，连线仿佛被点亮。你们一个负责把日子过成故事，一个负责把故事讲成诗。',
    '当{B}的星轨与{A}交错，不是偶然是引力。别急着定义关系，让两颗星星按自己的节奏靠近。',
    '{A}是白昼般的存在，{B}像夜晚的守护。昼夜交替之间，藏着你们独有的时区。',
    '有人说不同星座像不同语言，但{A}与{B}之间，一个眼神就是翻译。',
    '你们像是同一本星历上的两个章节，各自精彩，合在一起才完整。',
    '星星不会说慌，{A}与{B}的连线，是这片夜空里最好看的一段弧线。',
  ];

  function matchFor(dateA, dateB) {
    const [, ma, da] = dateA.split('-').map(Number);
    const [, mb, db] = dateB.split('-').map(Number);
    const A = signOf(ma, da), B = signOf(mb, db);
    const elA = A.element, elB = B.element;
    const seed = todayStr() + ':' + A.name + ':' + B.name;
    const r = rng(seed);
    const base = EL_BASE[elA][elB];
    const score = clamp(base + Math.round((r() - 0.5) * 8), 55, 98);
    const lv = LEVELS.find(l => score >= l.min);
    const kw0 = EL_KW[elA][elB];
    const txt = MATCH_TXT[hash(A.name + B.name) % MATCH_TXT.length]
      .replace(/\{A\}/g, A.name).replace(/\{B\}/g, B.name);
    const elTxt =
      '『' + A.name + '·' + elA + '』' + D.ELEMENTS[elA].motto +
      '　×　『' + B.name + '·' + elB + '』' + D.ELEMENTS[elB].motto;
    const traitA = A.traits[r() * A.traits.length | 0];
    const traitB = B.traits[r() * B.traits.length | 0];
    return { A, B, score, kw: lv.kw, elKw: kw0, txt, elTxt, traitA, traitB, dateA, dateB };
  }

  window.XY.mock = { signOf, fortuneFor, matchFor, todayStr };
  D.util = { hash, rng, todayStr, fmtDate };
})();
