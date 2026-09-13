/* ============================================================
 * 星语星图 · 3D 星座星图（Three.js 穹顶星空）
 * 将 2D 星图印在向相机外鼓的虚拟天球上：拖动旋转 / 双指缩放 / 缓速自转。
 *
 * 视觉设计（小红书女性审美 · 高定珠宝/香氛片质感）：
 *  - 星星 = 珍珠细闪：芒短而柔、核亮如碎钻高光，暗星只是温柔光点，不做锐利刀锋
 *  - 连线 = 香槟金细丝（向暖金收敛），像首饰的包金勾线，而非霓虹管/冰丝
 *  - 星星色泽向珠光暖白靠拢；星座主题色只留一丝给最亮星的光晕 → 克制高级
 *  - 星尘为香槟金粉 + 远层淡薰衣草，叠加柔雾大光斑（散景）→ 层次与氛围
 *  - 呼吸更慢、更慵懒：像夜风里微微发光，不是圣诞灯串
 * 背景透明 → 星座专属星夜渐变由 .scene 承载，.chart-3d 再叠珠光雾面滤镜。
 * ============================================================ */
(function () {
  'use strict';
  const D = window.XY;
  let THREE = null;
  try { THREE = window.THREE; } catch (e) {}

  const S = {
    ready: false,           // 是否已初始化
    sign: null,             // 当前星座
    visible: false,
    scene: null, camera: null, renderer: null, controls: null,
    groups: [], raf: 0,
    anims: [],              // 呼吸动画：[{ mat, base, depth, rate, phase }]
  };

  /* ================= 程序化纹理 ================= */

  // 柔晕（大而软，像珍珠表面散开的月光）
  function makeGlowTex() {
    const sz = 128, c = document.createElement('canvas');
    c.width = c.height = sz;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
    rg.addColorStop(0, 'rgba(255,255,255,.34)');
    rg.addColorStop(0.42, 'rgba(255,255,255,.11)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, sz, sz);
    return new THREE.CanvasTexture(c);
  }

  // 微尘圆点（小而柔的边缘，像落在丝绒上的金粉）
  function makeDotTex() {
    const sz = 64, c = document.createElement('canvas');
    c.width = c.height = sz;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.2, 'rgba(255,255,255,.46)');
    rg.addColorStop(0.5, 'rgba(255,255,255,.07)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, sz, sz);
    return new THREE.CanvasTexture(c);
  }

  // 星芒：碎钻式细闪 —— 芒短、细、边缘渐隐，中心圆润高光
  function makeStarTex() {
    const sz = 256, cx = sz / 2, c = document.createElement('canvas');
    c.width = c.height = sz;
    const g = c.getContext('2d');
    g.translate(cx, cx);

    // 极淡柔晕铺底（珠光感）
    let rg = g.createRadialGradient(0, 0, 0, 0, 0, 120);
    rg.addColorStop(0, 'rgba(255,255,255,.20)');
    rg.addColorStop(0.5, 'rgba(255,255,255,.055)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(-cx, -cx, sz, sz);

    // 一条芒（双向、短、细，向末梢渐隐 → 温柔细闪而非刀锋）
    function ray(len, w0, w1, alpha) {
      const lg = g.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, -w0); g.lineTo(len, -w1); g.lineTo(len, w1); g.lineTo(0, w0);
      g.closePath(); g.fill();
      const lg2 = g.createLinearGradient(0, 0, -len, 0);
      lg2.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
      lg2.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg2;
      g.beginPath();
      g.moveTo(0, -w0); g.lineTo(-len, -w1); g.lineTo(-len, w1); g.lineTo(0, w0);
      g.closePath(); g.fill();
    }
    g.save(); ray(98, 4.4, 0.9, .62); g.restore();
    g.save(); g.rotate(Math.PI / 2); ray(98, 4.4, 0.9, .62); g.restore();
    g.save(); g.rotate(Math.PI / 4); ray(62, 1.9, .36, .24); g.restore();
    g.save(); g.rotate(-Math.PI / 4); ray(62, 1.9, .36, .24); g.restore();

    // 圆润亮核（像珍珠高光，带一点外圈羽化）
    rg = g.createRadialGradient(0, 0, 0, 0, 0, 12);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.5, 'rgba(255,255,255,.94)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
    return new THREE.CanvasTexture(c);
  }

  /* ================= 球面投影 ================= */
  const R = 1.95, KX = 1.35, KY = 1.35;
  function sphere3d(u, v) {
    const th = u * KX, ph = v * KY;
    const cp = Math.cos(ph);
    return new THREE.Vector3(Math.sin(th) * cp * R, Math.sin(ph) * R, Math.cos(th) * cp * R);
  }

  /* ================= 呼吸动画注册 ================= */
  function breathe(mat, base, depth, rate, phase) {
    S.anims.push({ mat, base, depth, rate, phase });
  }

  /* ================= 场景构建 ================= */
  function build(sign) {
    dispose();
    const { P, mags, edges } = XY.svg2d.prepare2D(sign);
    const si = D.SIGNS.findIndex(x => x.name === sign);
    const signObj = D.SIGNS[si];
    const theme = D.themeOf(signObj);         // 完整对象
    const acc = new THREE.Color(theme.accent);

    const starTex = makeStarTex();
    const glowTex = makeGlowTex();
    const dotTex = makeDotTex();

    // 低饱和香槟基调：珠光暖白 & 香槟金 & 淡薰衣草
    const pearl = new THREE.Color('#FFF0DA');
    const champagne = new THREE.Color('#F3E3C6');
    const moon = new THREE.Color('#FFE7C4');

    // 指数雾：固定低饱和夜雾，让远层自然隐入，氛围不脏
    S.scene.fog = new THREE.FogExp2(new THREE.Color(0x12101E), 0.06);

    /* ---- 星星：每颗独立 Sprite（碎钻细闪），可独立闪烁 ---- */
    const sortedMags = [...mags].sort((a, b) => a - b);
    const rankOf = m => sortedMags.indexOf(m);
    const isMain = (m, i) => { const r = rankOf(m); return r === 0 || m <= 1.4; };

    mags.forEach((m, i) => {
      const rank = rankOf(m);
      const u = (P[i][0] - 120) / 90, v = (90 - P[i][1]) / 90;
      const p = sphere3d(u, v);

      // 层级：主星(≥-1.4等或第1亮) / 亮星 / 中星 / 暗星
      const main = isMain(m, i);
      const bright = !main && (m <= 1.9 || rank === 1);
      const mid = !main && !bright && (m <= 3.6 || rank <= 3);
      let coreSz = 0.5;
      const glowCfg = { scale: 1.5, op: 0.08 };
      if (main) {
        coreSz = 0.86; glowCfg.scale = 1.9; glowCfg.op = 0.2;
      } else if (bright) {
        coreSz = 0.65; glowCfg.scale = 1.55; glowCfg.op = 0.14;
      } else if (mid) {
        coreSz = 0.44; glowCfg.scale = 1.25; glowCfg.op = 0.11;
      } else {
        coreSz = 0.27; glowCfg.scale = 1.0; glowCfg.op = 0.08;
      }

      // 星色：在真实星色上叠一层珠光暖白 → 统一成珍珠细闪，去除冷感
      const col = new THREE.Color(XY.svg2d.pickColorHex(si, i, main || bright ? 'bright' : mid ? 'mid' : 'faint'));
      col.lerp(pearl, 0.3);
      const coreMat = new THREE.SpriteMaterial({
        map: starTex, color: col, transparent: true, opacity: 1,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const spr = new THREE.Sprite(coreMat);
      spr.scale.set(coreSz, coreSz, 1);
      spr.position.copy(p);
      S.scene.add(spr);
      S.groups.push({ dispose: () => { coreMat.dispose(); } });

      // 呼吸：更慢、更慵懒，相位由星 id 确定性散开
      const ph = ((si * 131 + i * 47) % 628) / 100;
      const rate = 0.62 + ((si * 53 + i * 29) % 25) / 42;   // 0.62~1.21 Hz 错开
      if (main) { coreMat.opacity = 0.96; breathe(coreMat, 0.92, 0.1, rate, ph); }
      else if (bright) { breathe(coreMat, 0.9, 0.16, rate, ph); }
      else if (mid) { breathe(coreMat, 0.8, 0.2, rate, ph + 0.9); }
      else { breathe(coreMat, 0.66, 0.26, rate * 1.15, ph + 1.7); }

      // 柔晕：主星保留一丝星座主题色（再混入珠光），其余均为月光珠光白
      const gCol = main ? acc.clone().lerp(moon, 0.35) : pearl;
      const gMat = new THREE.SpriteMaterial({
        map: glowTex, color: gCol, transparent: true,
        opacity: main ? glowCfg.op : glowCfg.op * 0.72, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const gSpr = new THREE.Sprite(gMat);
      const gSz = coreSz * glowCfg.scale;
      gSpr.scale.set(gSz, gSz, 1);
      gSpr.position.copy(p);
      S.scene.add(gSpr);
      S.groups.push({ dispose: () => { gMat.dispose(); } });
      breathe(gMat, main ? glowCfg.op : glowCfg.op * 0.72, main ? 0.1 : 0.14, rate * 0.5, ph + 1.2);
    });

    /* ---- 连线：香槟金包丝（core）+ 更淡金晕（halo），呼吸脉动 ---- */
    // 色彩向香槟金大幅收敛：像首饰的勾线，只剩一丝主题色，绝无霓虹感
    const coreCol = acc.clone().lerp(champagne, 0.8);
    const haloCol = acc.clone().lerp(champagne, 0.62);
    const coreMat = new THREE.MeshBasicMaterial({
      color: coreCol, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: haloCol, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (const [a, b] of edges) {
      const pa = sphere3d((P[a][0] - 120) / 90, (90 - P[a][1]) / 90);
      const pb = sphere3d((P[b][0] - 120) / 90, (90 - P[b][1]) / 90);
      const mid = pa.clone().add(pb).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.14);
      const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);
      const haloGeo = new THREE.TubeGeometry(curve, 14, 0.029, 6, false);
      S.scene.add(new THREE.Mesh(haloGeo, haloMat));
      S.groups.push({ dispose: () => { haloGeo.dispose(); } });
      const coreGeo = new THREE.TubeGeometry(curve, 14, 0.0098, 6, false);
      S.scene.add(new THREE.Mesh(coreGeo, coreMat));
      S.groups.push({ dispose: () => { coreGeo.dispose(); } });
    }
    breathe(coreMat, 0.5, 0.14, 0.8, 0);
    breathe(haloMat, 0.06, 0.025, 0.8, 2.4);
    S.groups.push({ dispose: () => { coreMat.dispose(); haloMat.dispose(); } });

    /* ---- 氛围星尘：香槟金粉（近）+ 淡薰衣草雾（远），柔而稀疏 ---- */
    const rand = D.util.rng(7 + si * 31);
    const addDust = (N, r0, r1, sz, op, squish, rateScale, color) => {
      const pos3 = new Float32Array(N * 3);
      const phases = [];
      for (let i = 0; i < N; i++) {
        const rr = r0 + rand() * (r1 - r0);
        const t = rand() * Math.PI * 2, ph = Math.acos(rand() * 2 - 1);
        pos3[i * 3] = rr * Math.sin(ph) * Math.cos(t);
        pos3[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(t) * squish;
        pos3[i * 3 + 2] = rr * Math.cos(ph);
        phases.push(rand() * Math.PI * 2);
      }
      const g3 = new THREE.BufferGeometry();
      g3.setAttribute('position', new THREE.BufferAttribute(pos3, 3));
      const m3 = new THREE.PointsMaterial({
        size: sz, map: dotTex, transparent: true, opacity: op,
        depthWrite: false, sizeAttenuation: true, color,
        blending: THREE.AdditiveBlending,
      });
      S.scene.add(new THREE.Points(g3, m3));
      S.groups.push({ dispose: () => { g3.dispose(); m3.dispose(); } });
      breathe(m3, op, op * 0.32, rateScale, 0);
    };
    addDust(110, 2.6, 4.1, 0.062, 0.2, 0.6, 0.35, 0xEFDCC2);  // 近层：香槟金粉
    addDust(42, 4.8, 6.8, 0.1, 0.12, 0.62, 0.25, 0xE2DBF2);    // 远层：淡薰衣草雾

    /* ---- 柔雾散景光斑：几颗大而朦胧的珍珠光斑，拉出景深氛围 ---- */
    const bokehTints = [0xFFF0DA, 0xEDE3FF, 0xFFEAD8];
    for (let b = 0; b < 6; b++) {
      const th = rand() * Math.PI * 2;
      const rr = 1.3 + rand() * 1.6;              // 环绕在星图外围
      const z = -0.9 - rand() * 1.5;              // 推向相机远侧 → 被雾柔化
      const bCol = bokehTints[b % 3];
      const bMat = new THREE.SpriteMaterial({
        map: glowTex, color: bCol, transparent: true,
        opacity: 0.05 + rand() * 0.04, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const bSpr = new THREE.Sprite(bMat);
      const bs = 1.1 + rand() * 1.1;
      bSpr.scale.set(bs, bs, 1);
      bSpr.position.set(Math.cos(th) * rr, (rand() - 0.5) * 1.7, z);
      S.scene.add(bSpr);
      S.groups.push({ dispose: () => { bMat.dispose(); } });
      breathe(bMat, 0.05 + rand() * 0.04, 0.4, 0.12 + rand() * 0.1, rand() * Math.PI * 2);
    }

    S.groups.push({ dispose: () => { starTex.dispose(); glowTex.dispose(); dotTex.dispose(); } });
  }

  function initIfNeeded() {
    if (S.ready || !THREE) return;
    const canvas = document.getElementById('gl-canvas');
    if (!canvas) return;
    // 兜底：禁止浏览器把画布当图片拖走（避免 no-drop 光标与 pointercancel 打断旋转）
    canvas.addEventListener('dragstart', e => e.preventDefault());
    S.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    S.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    S.scene = new THREE.Scene();
    S.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    S.camera.position.set(0, 0.12, 6.1);
    S.controls = new THREE.OrbitControls(S.camera, canvas);
    S.controls.enablePan = false;
    S.controls.enableDamping = true;
    S.controls.dampingFactor = 0.08;
    S.controls.minDistance = 4.6;
    S.controls.maxDistance = 9.6;
    S.controls.autoRotate = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    S.controls.autoRotateSpeed = 0.65;   // 更慢的缓转，氛围优先
    S.ready = true;
    window.addEventListener('resize', resize);
    loop();
  }

  function resize() {
    if (!S.ready) return;
    const box = document.getElementById('chart-3d');
    const w = box ? box.clientWidth : 320;
    const h = box ? box.clientHeight : 360;
    S.renderer.setSize(w, h, false);
    S.camera.aspect = w / h;
    S.camera.updateProjectionMatrix();
  }

  /** 全屏沉浸构图：相机拉近 + 视野放宽，让星座在画面里更大更居中 */
  function setFocus(on) {
    if (!S.ready || !S.controls) return;
    S.controls.target.set(0, 0, 0);
    if (on) {
      S.camera.position.set(0, 0.06, 4.55);
      S.camera.fov = 45;
      S.controls.minDistance = 3.0;
      S.controls.maxDistance = 8.5;
    } else {
      S.camera.position.set(0, 0.12, 6.1);
      S.camera.fov = 38;
      S.controls.minDistance = 4.6;
      S.controls.maxDistance = 9.6;
    }
    S.camera.updateProjectionMatrix();
    S.controls.update();
  }

  function loop() {
    if (!S.visible) return;
    S.raf = requestAnimationFrame(loop);
    const t = performance.now() * 0.001;
    // 呼吸动画
    for (let i = 0; i < S.anims.length; i++) {
      const a = S.anims[i];
      a.mat.opacity = a.base * (1 + a.depth * Math.sin(t * a.rate + a.phase));
    }
    if (S.controls) S.controls.update();
    if (S.renderer) S.renderer.render(S.scene, S.camera);
  }

  // build 带兜底：失败不中断流程（保留部分场景），并输出日志便于排查
  function tryBuild() {
    try { build(S.sign); return true; }
    catch (err) {
      if (window.console) console.error('[3D] build 失败:', err);
      return false;
    }
  }
  function setSign(sign) {
    if (!THREE) return;
    initIfNeeded();
    if (!S.ready) return;
    if (sign !== S.sign) { S.sign = sign; tryBuild(); resize(); }
  }
  function setVisible(on) {
    S.visible = !!on;
    if (on) {
      initIfNeeded();
      if (!S.ready) return;
      if (S.sign && !S.groups.length) tryBuild(); // 先 visible 后 setSign 时补建场景
      cancelAnimationFrame(S.raf); resize(); loop();
    }
  }
  function dispose() {
    (S.groups || []).forEach(g => { try { g.dispose(); } catch (e) {} });
    S.groups = [];
    S.anims = [];
    if (S.scene) {
      while (S.scene.children.length) {
        const c = S.scene.children[0];
        S.scene.remove(c);
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      }
    }
  }

  window.XY.gl3d = {
    get enabled() { return !!THREE; },
    setSign, setVisible, resize, setFocus,
    get visible() { return S.visible; },
  };
})();
