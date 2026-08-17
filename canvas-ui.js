/*
 * LAST Z canvas interface
 * Visible UI is rendered into #guiCanvas. Interactive widgets are canvasGUI 3.2.0
 * controls; the original DOM remains an invisible state/event bridge so the game
 * simulation and persistence code stay byte-for-byte compatible with the source.
 */
(() => {
  'use strict';

  const canvas = document.getElementById('guiCanvas');
  const ctx = canvas.getContext('2d');
  const gui = createGUI('last-z-canvas-ui', canvas);
  const controls = [];
  const buttons = Object.create(null);
  let width = 0, height = 0, howPage = 0, statsPage = 0;

  const hexRgb = hex => {
    const value = parseInt(hex.replace('#', ''), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  };
  const mixRgb = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const SCHEMES = Object.create(null);
  function addLastZScheme(name, accentHex, foreHex = '#d9f5ff', baseHex = '#07121d') {
    const accent = hexRgb(accentHex), fore = hexRgb(foreHex), base = hexRgb(baseHex);
    const schemeName = `lastz-${name}`;
    const scheme = gui.createScheme(schemeName, 'dark');
    const colors = Array.from({ length: 10 }, (_, i) => mixRgb(base, accent, i / 11));
    colors[0] = mixRgb(base, fore, .12);
    colors[1] = mixRgb(base, fore, .18);
    colors[2] = mixRgb(base, accent, .20);
    colors[3] = mixRgb(base, accent, .25);
    colors[4] = mixRgb(base, accent, .42);
    colors[5] = mixRgb(base, accent, .58);
    colors[6] = accent;
    colors[7] = mixRgb(accent, fore, .36);
    colors[8] = fore;
    colors[9] = mixRgb(accent, [255, 255, 255], .42);
    scheme.setColors(colors);
    scheme.setGreys([[240], [190], [132], [58], [43], [35], [27], [20], [12], [5]]);
    scheme.setTints([[0, 10], [0, 18], [0, 66], [0, 135]]);
    // CanvasGUI 3.2.0's UserColorScheme exposes a write-only `name`
    // accessor, so registering it makes the GUI see the name as undefined.
    // Controls accept the scheme object directly, which also avoids repeated
    // name lookups while preserving the custom palette.
    SCHEMES[name] = scheme;
  }
  addLastZScheme('cyan', '#54d8f5');
  addLastZScheme('blue', '#4b9ed2');
  addLastZScheme('green', '#65e0a4', '#dbffec', '#071710');
  addLastZScheme('orange', '#e9aa55', '#fff0ce', '#181007');
  addLastZScheme('red', '#e75d70', '#ffe3e7', '#19080c');
  addLastZScheme('dark', '#668397', '#a9bfcc', '#070b11');

  const canvasScheme = name => SCHEMES[name] || SCHEMES.cyan;
  gui.scheme('cyan').textSize(13).corners(4).tooltipTimes(900, 5000);

  const shown = id => {
    const el = document.getElementById(id);
    return !!el && !el.classList.contains('hide') && el.style.display !== 'none';
  };
  const click = id => document.getElementById(id)?.click();
  const addButton = (id, action) => {
    const c = gui.button(`cgui-${id}`, 0, 0, 10, 10)
      .transparent().hide().setAction(action || (() => click(id)));
    controls.push(c); buttons[id] = c; return c;
  };

  addButton('rotate', () => requestLandscapeMode());
  addButton('accountUse', () => {
    const value = accountField.text();
    document.getElementById('accountIdInput').value = value;
    useAccountId(value);
  });
  addButton('accountRandom', () => {
    const value = randomAccountId();
    accountField.text(value);
    document.getElementById('accountIdInput').value = value;
    useAccountId(value);
  });
  for (let i = 0; i < 5; i++) addButton(`profile${i}`, () => {
    const list = SAVE.profiles.slice().sort((a, b) => b.lastPlayed - a.lastPlayed);
    if (list[i]) activateProfile(list[i]);
  });

  addButton('switchAccount', () => openAccountScreen());
  addButton('soundSfx', () => SOUND.toggle('sfx'));
  addButton('soundBgm', () => SOUND.toggle('bgm'));
  addButton('modeStage', () => selectMode('stage'));
  addButton('modeEndless', () => selectMode('endless'));
  for (let i = 0; i < STAGES.length; i++) addButton(`stage${i}`, () => {
    const stage = STAGES[i];
    if (PROFILE && stage.id <= PROFILE.unlockedStage) {
      selectedStage = stage.id;
      renderStagePicker();
    }
  });
  addButton('start', () => startGame());
  addButton('growth', () => openGrowth());
  addButton('how', () => { howPage = 0; show('howScreen'); });
  addButton('growthClose', () => hideEl('growthScreen'));
  for (let i = 0; i < TECHS.length; i++) addButton(`tech${i}`, () => buyTech(TECHS[i].id));
  addButton('howClose', () => hideEl('howScreen'));
  addButton('howPrev', () => { howPage = Math.max(0, howPage - 1); });
  addButton('howNext', () => { howPage = Math.min(2, howPage + 1); });

  addButton('pauseResume', () => click('btnResume'));
  addButton('pauseFull', () => toggleFullscreenMode());
  addButton('pauseQuit', () => click('btnQuit'));
  addButton('pauseSfx', () => SOUND.toggle('sfx'));
  addButton('pauseBgm', () => SOUND.toggle('bgm'));
  addButton('statsClose', () => closeStatsPanel());
  addButton('statsPrev', () => { statsPage = Math.max(0, statsPage - 1); });
  addButton('statsNext', () => { statsPage = Math.min(1, statsPage + 1); });
  for (let i = 0; i < 3; i++) addButton(`perk${i}`, () => {
    const card = document.getElementById('cards')?.children[i];
    if (card) card.click();
  });
  addButton('retry', () => startGame());
  addButton('menu', () => returnToMenu());
  addButton('victoryNext', () => click('btnNextStage'));
  addButton('victoryMenu', () => returnToMenu());

  addButton('level', () => { statsPage = 0; openStatsPanel(); });
  for (let i = 0; i < WEAPONS.length; i++) addButton(`weapon${i}`, () => {
    if (P.owned.includes(WEAPONS[i].id)) equipWeapon(i);
  });
  addButton('mobileFull', () => toggleFullscreenMode());
  addButton('mobilePause', () => togglePause());
  addButton('mobileNade', () => triggerMobileNade());
  addButton('mobileReload', () => startReload());
  addButton('mobileDash', () => doDash());
  const accountField = gui.textfield('cgui-account-field', 0, 0, 10, 10)
    .scheme(canvasScheme('dark')).opaque(172).textSize(16).hide().setAction(info => {
      document.getElementById('accountIdInput').value = info.value;
      if (info.event?.key === 'Enter' && info.valid) useAccountId(info.value);
    });
  controls.push(accountField);

  const mobileWeaponSlider = gui.slider('cgui-mobile-weapon-slider', 0, 0, 220, 34)
    .scheme(canvasScheme('cyan')).limits(0, 1).ticks(1, 1, true).weight(10).opaque(70).hide()
    .setAction(info => {
      const owned = ownedWeaponIndices();
      if (owned.length < 2) return;
      const position = clamp(Math.round(info.value), 0, owned.length - 1);
      const index = owned[position];
      if (index !== undefined && index !== P.wIdx) equipWeapon(index);
    });
  controls.push(mobileWeaponSlider);

  const moveJoy = gui.joystick('cgui-move-stick', 0, 0, 132, 132)
    .scheme(canvasScheme('cyan')).opaque(52).hide().setAction(info => {
      const mag = info.final || info.dead ? 0 : Math.max(0, Math.min(1, info.mag));
      JOY.l.act = !info.final && !info.dead;
      JOY.l.x = Math.cos(info.angle) * mag;
      JOY.l.y = Math.sin(info.angle) * mag;
      if (info.final) JOY.l.x = JOY.l.y = 0;
    });
  const aimJoy = gui.joystick('cgui-aim-stick', 0, 0, 132, 132)
    .scheme(canvasScheme('red')).opaque(52).hide().setAction(info => {
      const mag = info.final || info.dead ? 0 : Math.max(0, Math.min(1, info.mag));
      JOY.r.act = !info.final && !info.dead;
      JOY.r.x = Math.cos(info.angle) * mag;
      JOY.r.y = Math.sin(info.angle) * mag;
      JOY.r.outer = mag > .82;
      setMobileFire(JOY.r.outer && G.running && !G.paused);
      if (info.final) {
        JOY.r.act = JOY.r.outer = false;
        JOY.r.x = JOY.r.y = 0;
        setMobileFire(false);
      }
    });
  controls.push(moveJoy, aimJoy);

  // canvasGUI exposes touch controls, while the game needs two sticks to be
  // held at the same time. This small adapter tracks both touch identifiers;
  // the visible controls and all other actions are still canvasGUI widgets.
  const multiTouch = { l: null, r: null };
  function mobileJoyGeometry(side) {
    const size = Math.min(136, height * .24), y = height - size - 20;
    return { x: side === 'l' ? 22 : width - size - 22, y, size };
  }
  function applyMobileTouch(side, touch, final = false) {
    const joy = JOY[side], g = mobileJoyGeometry(side);
    if (final) {
      multiTouch[side] = null; joy.act = joy.outer = false; joy.x = joy.y = 0;
      if (side === 'r') setMobileFire(false);
      return;
    }
    const dx = touch.clientX - (g.x + g.size / 2), dy = touch.clientY - (g.y + g.size / 2);
    const distance = Math.hypot(dx, dy), max = g.size * .39, scale = distance > max ? max / distance : 1;
    joy.act = true; joy.x = dx * scale / max; joy.y = dy * scale / max;
    if (side === 'r') {
      joy.outer = distance > g.size * .41;
      setMobileFire(joy.outer && G.running && !G.paused);
    }
  }
  canvas.addEventListener('touchstart', event => {
    if (!IS_MOBILE || !G.running || G.paused) return;
    for (const touch of event.changedTouches) {
      const side = touch.clientX < width / 2 ? 'l' : 'r', g = mobileJoyGeometry(side);
      if (touch.clientY >= g.y - 18 && multiTouch[side] === null) {
        multiTouch[side] = touch.identifier; applyMobileTouch(side, touch);
      }
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', event => {
    if (!IS_MOBILE || !G.running || G.paused) return;
    let handled = false;
    for (const touch of event.changedTouches) {
      for (const side of ['l', 'r']) if (multiTouch[side] === touch.identifier) {
        applyMobileTouch(side, touch); handled = true;
      }
    }
    if (handled && event.cancelable) event.preventDefault();
  }, { passive: false });
  const endMobileTouches = event => {
    if (!IS_MOBILE) return;
    for (const touch of event.changedTouches) {
      for (const side of ['l', 'r']) if (multiTouch[side] === touch.identifier) applyMobileTouch(side, touch, true);
    }
  };
  canvas.addEventListener('touchend', endMobileTouches, { passive: true });
  canvas.addEventListener('touchcancel', endMobileTouches, { passive: true });

  function resize() {
    width = Math.max(320, innerWidth);
    height = Math.max(180, innerHeight);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  function hideAll() {
    for (const c of controls) c.hide().disable();
  }

  const PLATE_COLORS = {
    cyan: { top: 'rgba(22,67,88,.48)', bottom: 'rgba(6,20,31,.42)', line: 'rgba(99,222,255,.52)', glow: 'rgba(64,200,245,.16)' },
    blue: { top: 'rgba(18,48,72,.46)', bottom: 'rgba(5,15,26,.42)', line: 'rgba(91,174,225,.42)', glow: 'rgba(55,145,210,.12)' },
    green: { top: 'rgba(18,66,49,.46)', bottom: 'rgba(5,22,18,.42)', line: 'rgba(103,232,168,.50)', glow: 'rgba(62,220,145,.13)' },
    orange: { top: 'rgba(81,54,21,.48)', bottom: 'rgba(27,16,5,.43)', line: 'rgba(245,185,92,.52)', glow: 'rgba(235,154,48,.14)' },
    red: { top: 'rgba(81,27,38,.48)', bottom: 'rgba(27,7,13,.43)', line: 'rgba(244,104,123,.52)', glow: 'rgba(235,65,91,.14)' },
    dark: { top: 'rgba(23,35,47,.38)', bottom: 'rgba(5,10,17,.34)', line: 'rgba(122,176,207,.24)', glow: 'rgba(70,160,210,.06)' }
  };

  function buttonPlate(x, y, w, h, scheme) {
    const p = PLATE_COLORS[scheme] || PLATE_COLORS.cyan;
    const cut = Math.min(9, Math.max(4, h * .22));
    ctx.save();
    ctx.shadowColor = p.glow;
    ctx.shadowBlur = scheme === 'dark' ? 5 : 11;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 1);
    ctx.lineTo(x + w - cut, y + 1);
    ctx.lineTo(x + w - 1, y + cut);
    ctx.lineTo(x + w - 1, y + h - 1);
    ctx.lineTo(x + cut, y + h - 1);
    ctx.lineTo(x + 1, y + h - cut);
    ctx.closePath();
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, p.top); g.addColorStop(1, p.bottom);
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = p.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = p.line.replace(/\.[0-9]+\)/, '.72)');
    ctx.beginPath(); ctx.moveTo(x + 8, y + 1.5); ctx.lineTo(x + Math.min(w * .42, 72), y + 1.5); ctx.stroke();
    ctx.restore();
  }

  function place(id, x, y, w, h, label, scheme = 'cyan', size = 13) {
    const c = buttons[id];
    if (!c) return null;
    buttonPlate(x, y, w, h, scheme);
    c.moveTo(Math.round(x), Math.round(y));
    c.w = Math.max(8, Math.round(w));
    c.h = Math.max(8, Math.round(h));
    c.text(label).scheme(canvasScheme(scheme)).textSize(size).corners(Math.min(6, h / 4)).transparent().show().enable();
    return c;
  }

  function placeControl(c, x, y, w, h) {
    c.moveTo(Math.round(x), Math.round(y));
    c.w = Math.round(w);
    c.h = Math.round(h);
    c.show().enable();
  }

  function font(size, weight = 500, display = false) {
    return `${weight} ${size}px ${display ? FONT_DISPLAY : FONT_UI}`;
  }

  function text(value, x, y, size = 14, color = '#dfe7ef', align = 'left', weight = 500, display = false) {
    ctx.save();
    ctx.font = font(size, weight, display);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(String(value ?? ''), x, y);
    ctx.restore();
  }

  function wrap(value, x, y, maxWidth, lineHeight = 20, color = '#aebccc', size = 13, maxLines = 99) {
    const chars = Array.from(String(value ?? ''));
    ctx.save(); ctx.font = font(size); ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let line = '', row = 0;
    for (let i = 0; i < chars.length && row < maxLines; i++) {
      const ch = chars[i];
      if (ch === '\n' || ctx.measureText(line + ch).width > maxWidth) {
        ctx.fillText(line, x, y + row * lineHeight); row++; line = ch === '\n' ? '' : ch;
      } else line += ch;
    }
    if (line && row < maxLines) { ctx.fillText(line, x, y + row * lineHeight); row++; }
    ctx.restore(); return row;
  }

  function fadeColor(color, alpha) {
    const value = String(color || '').trim();
    const shortHex = value.match(/^#([\da-f])([\da-f])([\da-f])$/i);
    const hex = value.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})(?:[\da-f]{2})?$/i);
    const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (shortHex) return `rgba(${parseInt(shortHex[1] + shortHex[1], 16)},${parseInt(shortHex[2] + shortHex[2], 16)},${parseInt(shortHex[3] + shortHex[3], 16)},${alpha})`;
    if (hex) return `rgba(${parseInt(hex[1], 16)},${parseInt(hex[2], 16)},${parseInt(hex[3], 16)},${alpha})`;
    if (rgb) return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${alpha})`;
    return `rgba(82,200,239,${alpha})`;
  }

  function panel(x, y, w, h, accent = '#52c8ef', alpha = .68) {
    ctx.save();
    const glassAlpha = Math.min(.66, .16 + alpha * .50);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, `rgba(9,21,32,${glassAlpha})`);
    g.addColorStop(.46, `rgba(6,14,23,${Math.max(.22, glassAlpha - .10)})`);
    g.addColorStop(1, `rgba(2,7,13,${Math.max(.18, glassAlpha - .17)})`);
    ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = 18;
    ctx.fillStyle = g; ctx.strokeStyle = fadeColor(accent, .28); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    const sheen = ctx.createLinearGradient(x, y, x + w, y);
    sheen.addColorStop(0, fadeColor(accent, .40)); sheen.addColorStop(.34, fadeColor(accent, .08)); sheen.addColorStop(1, fadeColor(accent, 0));
    ctx.fillStyle = sheen; ctx.fillRect(x + 7, y + 1, Math.max(0, w - 14), 1);
    ctx.fillStyle = accent; ctx.globalAlpha = .72; ctx.fillRect(x, y + 7, 3, Math.min(31, h - 10));
    ctx.restore();
  }

  function bar(x, y, w, h, ratio, colors, label) {
    ratio = Math.max(0, Math.min(1, ratio || 0));
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(x, y, w, h);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
    ctx.fillStyle = g; ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * ratio), h - 2);
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    if (label) text(label, x + w / 2, y + 1, Math.max(9, h - 4), '#fff', 'center', 700);
    ctx.restore();
  }

  function backdrop(kind = 'blue') {
    const colors = kind === 'red' ? ['rgba(55,4,9,.57)', 'rgba(2,2,5,.82)']
      : kind === 'green' ? ['rgba(4,46,48,.57)', 'rgba(1,4,8,.82)']
      : ['rgba(7,24,38,.55)', 'rgba(1,3,7,.80)'];
    const g = ctx.createRadialGradient(width / 2, height * .38, 10, width / 2, height * .45, Math.max(width, height) * .65);
    g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(90,210,255,.06)';
    for (let y = 0; y < height; y += 4) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(width, y + .5); ctx.stroke(); }
  }

  function titleBlock(kicker, title, subtitle, y = 36) {
    text(kicker, width / 2, y, 12, '#ff6b72', 'center', 700, true);
    text(title, width / 2, y + 20, Math.min(72, Math.max(42, height * .095)), '#dff7ff', 'center', 900, true);
    if (subtitle) text(subtitle, width / 2, y + Math.min(96, height * .13), 18, '#ff9b9f', 'center', 700, true);
  }

  function drawOrientation() {
    backdrop('blue');
    const w = Math.min(470, width - 36), h = 260, x = (width - w) / 2, y = (height - h) / 2;
    panel(x, y, w, h, '#76e6ff', .92);
    text('↻', width / 2, y + 24, 52, '#ffd36a', 'center', 700);
    text('请横屏游玩', width / 2, y + 88, 29, '#dff9ff', 'center', 800, true);
    wrap('本游戏仅支持横屏。请横放安卓平板或手机，也可以尝试进入全屏横屏。', x + 38, y + 130, w - 76, 22, '#b9c9d7', 14, 3);
    place('rotate', width / 2 - 76, y + 202, 152, 42, '进入横屏', 'cyan', 15);
  }

  function drawAccount() {
    backdrop('blue');
    const w = Math.min(820, width - 36), h = Math.min(500, height - 36), x = (width - w) / 2, y = (height - h) / 2;
    const compact = height < 500;
    panel(x, y, w, h, '#63d8ff', .88);
    text('SURVIVOR DATABASE', x + 28, y + 22, 11, '#73e6ff', 'left', 700, true);
    text('幸存者档案', x + 28, y + 42, 30, '#fff', 'left', 800, true);
    wrap('档案、养成与战绩独立保存在本机浏览器，不需要密码。选择已有档案，或输入新的幸存者 ID。', x + 28, y + 84, w - 56, 20, '#8fa4b7', 13, 2);
    const gap = 26, colW = (w - gap * 3) / 2, top = y + (compact ? 108 : 140);
    text('已有档案', x + gap, top, 11, '#8396aa', 'left', 700, true);
    const list = SAVE.profiles.slice().sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 5);
    if (!list.length) text('暂无档案，可随机创建一个。', x + gap, top + 42, 13, '#687989');
    list.forEach((p, i) => place(`profile${i}`, x + gap, top + 24 + i * 48, colW, 40,
      `🧑‍🚀 ${p.name}   LV.${p.level} · 最高 ${p.bestWave} 波`, p.id === selectedAccountId ? 'cyan' : 'dark', 12));
    const rx = x + gap * 2 + colW;
    text('幸存者 ID', rx, top, 11, '#8396aa', 'left', 700, true);
    const hiddenValue = document.getElementById('accountIdInput').value;
    if (!accountField.isEnabled && hiddenValue && !accountField.text()) accountField.text(hiddenValue);
    placeControl(accountField, rx, top + 26, colW, 44);
    wrap('允许中英文、数字、短横线和下划线；输入新 ID 会自动创建独立档案。', rx, top + 82, colW, 19, '#657687', 12, 3);
    const msg = document.getElementById('accountMsg').textContent;
    if (msg) wrap(msg, rx, top + 138, colW, 18, '#ffbd69', 12, 2);
    if (compact) {
      place('accountUse', rx, top + 160, (colW - 8) / 2, 40, '使用此 ID', 'cyan', 12);
      place('accountRandom', rx + (colW + 8) / 2, top + 160, (colW - 8) / 2, 40, '随机 ID', 'green', 12);
    } else {
      place('accountUse', rx, top + 190, colW, 44, '使用此 ID 开始', 'cyan', 14);
      place('accountRandom', rx, top + 242, colW, 44, '随机 ID 快捷开始', 'green', 14);
    }
  }

  function drawStart() {
    backdrop('blue');
    const compact = height < 620;
    const top = compact ? 16 : 26;
    titleBlock('SURVIVAL PROTOCOL · 2087', 'LAST Z', '末 日 幸 存 者 射 击', top);
    if (PROFILE) {
      panel(18, 16, Math.min(310, width * .27), 58, '#57d8ff', .70);
      text('当前档案', 30, 25, 9, '#67d8ee', 'left', 700, true);
      text(`${PROFILE.name}  LV.${PROFILE.level}`, 30, 40, 14, '#fff', 'left', 700, true);
      text(`物资 ${PROFILE.credits} · 核心 ${PROFILE.cores}`, 30, 58, 10, '#79efac');
      place('switchAccount', Math.min(240, width * .20), 28, 66, 34, '切换', 'dark', 11);
    }
    place('soundSfx', width - 222, 22, 98, 34, SOUND.sfxOn ? '🔊 音效：开' : '🔇 音效：关', SOUND.sfxOn ? 'cyan' : 'dark', 11);
    place('soundBgm', width - 116, 22, 98, 34, SOUND.bgmOn ? '♫ BGM：开' : '♫ BGM：关', SOUND.bgmOn ? 'cyan' : 'dark', 11);

    const modeY = compact ? 170 : 205, cardW = Math.min(390, (width - 60) / 2), gap = 12, startX = (width - cardW * 2 - gap) / 2;
    place('modeStage', startX, modeY, cardW, compact ? 62 : 78,
      `关卡模式\n有限波次 · 首通奖励 · 进度 ${PROFILE?.clearedStages.length || 0}/${STAGES.length}`,
      selectedMode === 'stage' ? 'orange' : 'dark', 13);
    place('modeEndless', startX + cardW + gap, modeY, cardW, compact ? 62 : 78,
      `无限流模式\n持续增强 · 最高 ${PROFILE?.bestWave || 0} 波 · ${PROFILE?.bestScore || 0} 分`,
      selectedMode === 'endless' ? 'cyan' : 'dark', 13);

    let actionY;
    if (selectedMode === 'stage' && PROFILE) {
      const stageY = modeY + (compact ? 72 : 90), sw = Math.min(120, (width - 54) / 6), total = sw * 6 + 5 * 6, sx = (width - total) / 2;
      STAGES.forEach((s, i) => {
        const locked = s.id > PROFILE.unlockedStage;
        const mark = locked ? '🔒' : PROFILE.clearedStages.includes(s.id) ? '✓' : String(s.id).padStart(2, '0');
        place(`stage${i}`, sx + i * (sw + 6), stageY, sw, 46,
          `${mark} ${s.n.split('·')[1]?.trim() || s.n}\n${s.waves} 波 · LV.${s.rec}`,
          locked ? 'dark' : selectedStage === s.id ? 'orange' : 'blue', 10);
      });
      const stage = STAGES[selectedStage - 1];
      if (!compact) wrap(stage.d, width / 2 - 380, stageY + 54, 760, 18, '#9dabb8', 12, 2);
      actionY = stageY + (compact ? 56 : 86);
    } else actionY = modeY + (compact ? 74 : 98);

    place('start', width / 2 - 210, actionY, 176, 52, selectedMode === 'stage' ? '开始任务' : '进入无限尸潮', 'cyan', 18);
    place('growth', width / 2 - 24, actionY, 132, 52, '基地养成', 'green', 15);
    place('how', width / 2 + 118, actionY, 120, 52, '玩法说明', 'dark', 15);
    if (PROFILE) text(`账号总击杀 ${PROFILE.totalKills.toLocaleString()} · 出击 ${PROFILE.totalRuns} · 通关 ${PROFILE.totalWins}`,
      width / 2, actionY + 62, 12, '#627383', 'center');
    text(`canvasGUI ${GUI.VERSION} · Three.js`, 14, height - 22, 10, '#4e7286', 'left', 600, true);
  }

  function drawGrowth() {
    backdrop('blue');
    const w = Math.min(1000, width - 32), h = Math.min(620, height - 24), x = (width - w) / 2, y = (height - h) / 2;
    panel(x, y, w, h, '#55e5a0', .90);
    text('BASE DEVELOPMENT', x + 24, y + 18, 11, '#6df0a8', 'left', 700, true);
    text('基地养成', x + 24, y + 38, 29, '#fff', 'left', 800, true);
    if (PROFILE) text(`账号 LV.${PROFILE.level} · 物资 ${PROFILE.credits} · 数据核心 ${PROFILE.cores} · 经验 ${PROFILE.xp}/${accountNeed(PROFILE.level)}`,
      x + 24, y + 78, 13, '#ffd989');
    place('growthClose', x + w - 96, y + 20, 72, 38, '返回', 'dark', 13);
    const cardGap = 10, cardW = (w - 48 - cardGap * 4) / 5, cardY = y + 122, cardH = Math.min(250, h * .43);
    TECHS.forEach((t, i) => {
      const cx = x + 24 + i * (cardW + cardGap), level = PROFILE?.tech[t.id] || 0, cost = PROFILE ? techCost(t.id) : { credits: 0, cores: 0 };
      panel(cx, cardY, cardW, cardH, '#65d8f5', .58);
      text(t.ico, cx + cardW / 2, cardY + 14, 28, '#fff', 'center');
      text(t.n, cx + cardW / 2, cardY + 51, 14, '#d9f7ff', 'center', 700, true);
      wrap(t.d, cx + 12, cardY + 78, cardW - 24, 18, '#91a1af', 11, 4);
      text(`LV.${level}/${t.max} · ${t.effect(level)}`, cx + cardW / 2, cardY + cardH - 66, 10, '#72e6a4', 'center');
      const max = level >= t.max;
      place(`tech${i}`, cx + 10, cardY + cardH - 42, cardW - 20, 32,
        max ? '已满级' : `升级 ${cost.credits}物资${cost.cores ? ` +${cost.cores}核心` : ''}`,
        max ? 'dark' : 'green', 10);
    });
    const arsenalY = cardY + cardH + 34;
    text('永久军械库', x + 24, arsenalY - 22, 11, '#65d8f5', 'left', 700, true);
    WEAPONS.forEach((weapon, i) => {
      const aw = (w - 48 - 8 * 6) / 9, ax = x + 24 + i * (aw + 6), owned = PROFILE?.weapons.includes(weapon.id);
      panel(ax, arsenalY, aw, 74, owned ? '#ffd16d' : '#52606d', owned ? .56 : .35);
      text(weapon.ico, ax + aw / 2, arsenalY + 9, 22, owned ? '#fff' : '#66717c', 'center');
      text(weapon.n.replace(/ .*/, ''), ax + aw / 2, arsenalY + 39, 10, owned ? '#ffe7a8' : '#66717c', 'center', 700);
      text(owned ? '永久解锁' : '关卡奖励', ax + aw / 2, arsenalY + 56, 9, owned ? '#83e8ac' : '#56616d', 'center');
    });
  }

  const howPages = [
    ['模式与养成', '关卡模式包含 6 个逐步解锁的任务，通关可获得首通物资、数据核心与永久武器。无限流模式没有终点，用于挑战最高波次和得分。两种模式都会保存结算资源、账号经验和战绩；基地科技会在每次出击时自动生效。',
      '操作', 'PC / Mac：WASD 或方向键移动，鼠标瞄准，按住左键持续射击，R 换弹，空格闪避，G 手雷，1-9 或滚轮换枪，P / Esc 暂停。移动端：左摇杆移动，右摇杆瞄准，推至外圈持续开火。'],
    ['武器库', '', '武器详情', ''],
    ['感染体图鉴', '', '生存要点', '每 5 波出现一只 BOSS。击杀敌人获得经验，升级时可三选一强化。红色油桶可被打爆造成范围伤害。保持移动，善用闪避与手雷。']
  ];

  function drawHow() {
    backdrop('blue');
    const w = Math.min(820, width - 32), h = Math.min(610, height - 28), x = (width - w) / 2, y = (height - h) / 2;
    panel(x, y, w, h, '#63d8ff', .92);
    text('生存手册', x + 24, y + 20, 28, '#c8f5ff', 'left', 800, true);
    text(`${howPage + 1} / 3`, x + w - 128, y + 29, 11, '#7794a8', 'center', 700, true);
    place('howClose', x + w - 92, y + 16, 68, 36, '返回', 'dark', 12);
    let cy = y + 72;
    if (howPage === 1) {
      text('武器库', x + 28, cy, 16, '#73e8ff', 'left', 700, true); cy += 34;
      WEAPONS.forEach(wpn => {
        text(`${wpn.ico} ${wpn.n}`, x + 30, cy, 13, '#ffd98a', 'left', 700);
        text(`${wpn.desc} · 伤害 ${wpn.dmg} · 弹匣 ${wpn.mag}`, x + 190, cy, 12, '#9cabba'); cy += 34;
      });
    } else if (howPage === 2) {
      text('感染体图鉴（13 种 + BOSS 变体）', x + 28, cy, 16, '#73e8ff', 'left', 700, true); cy += 32;
      ETKEYS.forEach((key, i) => {
        const e = ETYPES[key], col = i % 2, row = Math.floor(i / 2);
        const ex = x + 30 + col * (w / 2 - 22), ey = cy + row * 42;
        text(e.n, ex, ey, 13, '#ff9292', 'left', 700);
        text(`第 ${e.from} 波起 · HP ${e.hp} · 速度 ${e.spd}`, ex + 94, ey, 11, '#8fa2b3');
      });
      cy += Math.ceil(ETKEYS.length / 2) * 42 + 6;
      text('生存要点', x + 28, cy, 15, '#73e8ff', 'left', 700, true);
      wrap(howPages[2][3], x + 28, cy + 26, w - 56, 20, '#afbdc9', 13, 4);
    } else {
      text(howPages[0][0], x + 28, cy, 16, '#73e8ff', 'left', 700, true); cy += 30;
      cy += wrap(howPages[0][1], x + 28, cy, w - 56, 22, '#afbdc9', 13, 6) * 22 + 24;
      text(howPages[0][2], x + 28, cy, 16, '#73e8ff', 'left', 700, true); cy += 30;
      wrap(howPages[0][3], x + 28, cy, w - 56, 22, '#afbdc9', 13, 9);
    }
    place('howPrev', x + 24, y + h - 50, 90, 34, '上一页', howPage > 0 ? 'blue' : 'dark', 12);
    place('howNext', x + w - 114, y + h - 50, 90, 34, '下一页', howPage < 2 ? 'blue' : 'dark', 12);
  }

  function drawPause() {
    backdrop('blue');
    const w = 430, h = 300, x = (width - w) / 2, y = (height - h) / 2;
    panel(x, y, w, h, '#61d9ff', .90);
    text('已 暂 停', width / 2, y + 40, 38, '#c8f5ff', 'center', 800, true);
    text('声音设置', width / 2, y + 105, 10, '#6e8fa4', 'center', 700, true);
    place('pauseSfx', x + 95, y + 126, 112, 38, SOUND.sfxOn ? '🔊 音效：开' : '🔇 音效：关', SOUND.sfxOn ? 'cyan' : 'dark', 11);
    place('pauseBgm', x + 223, y + 126, 112, 38, SOUND.bgmOn ? '♫ BGM：开' : '♫ BGM：关', SOUND.bgmOn ? 'cyan' : 'dark', 11);
    const bx = IS_MOBILE ? x + 38 : x + 78;
    place('pauseResume', bx, y + 205, 104, 44, '继续', 'cyan', 15);
    if (IS_MOBILE) place('pauseFull', bx + 114, y + 205, 104, 44, fullscreenElement() ? '退出全屏' : '进入全屏', 'blue', 12);
    place('pauseQuit', IS_MOBILE ? bx + 228 : bx + 170, y + 205, 104, 44, '放弃', 'red', 15);
  }

  function statPairs() {
    const weapon = WEAPONS[P.wIdx], ammo = P.ammo[weapon.id], pellets = weapon.pel + (P.perks.multi || 0);
    return [
      ['角色 ID', PROFILE?.name || '-'], ['档案等级', `LV.${PROFILE?.level || 1}`], ['本局等级', `LV.${P.lvl}`], ['生命', `${Math.ceil(P.hp)} / ${Math.ceil(P.maxhp)}`],
      ['护甲', `${Math.ceil(P.armor)} / ${Math.ceil(P.maxarmor)}`], ['耐力', `${Math.ceil(P.st)} / ${Math.ceil(P.maxst)}`], ['移动速度', (P.speed * P.perks.spd).toFixed(1)], ['当前武器', `${weapon.ico} ${weapon.n}`],
      ['弹匣', `${ammo.mag} / ${weapon.mag}`], ['单次伤害', `${Math.round(weapon.dmg * P.perks.dmg)}${pellets > 1 ? ` × ${pellets}` : ''}`], ['射速', `${Math.round(weapon.rpm * P.perks.rof)} RPM`], ['总伤害加成', `${Math.round((P.perks.dmg - 1) * 100)}%`],
      ['暴击率', `${Math.round(P.perks.critC * 100)}%`], ['暴击伤害', `${Math.round(P.perks.critM * 100)}%`], ['吸血', `${P.perks.ls || 0}%`], ['生命恢复', `${(P.perks.regen || 0).toFixed(1)}/秒`]
    ];
  }

  function drawStats() {
    backdrop('blue');
    const w = Math.min(900, width - 30), h = Math.min(610, height - 24), x = (width - w) / 2, y = (height - h) / 2;
    panel(x, y, w, h, '#61dcff', .94);
    text('SURVIVOR STATUS', x + 22, y + 17, 10, '#69dcf5', 'left', 700, true);
    text('角色属性', x + 22, y + 34, 26, '#fff', 'left', 800, true);
    text(`${PROFILE?.name || ''} · ${G.mode === 'stage' ? STAGES[G.stageId - 1].n : '无限流模式'}`, x + 22, y + 68, 12, '#ffd37c');
    place('statsClose', x + w - 88, y + 17, 66, 36, '关闭', 'dark', 12);
    if (statsPage === 0) {
      const pairs = statPairs(), cols = 4, gap = 8, tileW = (w - 44 - gap * 3) / cols;
      pairs.forEach((pair, i) => {
        const px = x + 22 + (i % cols) * (tileW + gap), py = y + 104 + Math.floor(i / cols) * 72;
        panel(px, py, tileW, 62, '#47778f', .46);
        text(pair[0], px + 10, py + 9, 9, '#8194a6', 'left', 700, true);
        text(pair[1], px + 10, py + 29, 14, '#e6f8ff', 'left', 700, true);
      });
      text(`本局强化：${P.perkList.length} 项`, x + 24, y + h - 102, 13, '#74e8a9', 'left', 700, true);
      text('进入下一页查看每次获得的强化记录', x + 24, y + h - 77, 11, '#657989');
    } else {
      text(`本局强化 · ${P.perkList.length} 项`, x + 24, y + 106, 14, '#74e8a9', 'left', 700, true);
      if (!P.perkList.length) text('本局尚未获得强化', width / 2, y + 190, 14, '#758392', 'center');
      P.perkList.slice(0, 12).forEach((perk, i) => {
        const col = i % 2, row = Math.floor(i / 2), px = x + 24 + col * (w / 2 - 6), py = y + 142 + row * 58;
        panel(px, py, w / 2 - 36, 48, perk.c, .45);
        text(`${perk.ico} ${perk.n}`, px + 12, py + 8, 12, perk.c, 'left', 700, true);
        text(perk.d, px + 12, py + 27, 10, '#8e9eaa');
      });
    }
    place('statsPrev', x + w / 2 - 100, y + h - 48, 88, 32, '属性', statsPage === 0 ? 'cyan' : 'dark', 11);
    place('statsNext', x + w / 2 + 12, y + h - 48, 88, 32, '强化', statsPage === 1 ? 'green' : 'dark', 11);
  }

  function drawUpgrade() {
    backdrop('blue');
    text('LEVEL UP', width / 2, 38, 12, '#75f0aa', 'center', 700, true);
    text('选择强化', width / 2, 59, 38, '#fff', 'center', 800, true);
    const cards = Array.from(document.getElementById('cards')?.children || []);
    const cardW = Math.min(250, (width - 70) / 3), gap = 18, total = cardW * cards.length + gap * Math.max(0, cards.length - 1), sx = (width - total) / 2, cy = Math.max(122, (height - 330) / 2);
    cards.forEach((card, i) => {
      const raw = card.innerText.split('\n').filter(Boolean);
      place(`perk${i}`, sx + i * (cardW + gap), cy, cardW, Math.min(300, height - cy - 32), raw.join('\n'), i === 0 ? 'red' : i === 1 ? 'orange' : 'green', 14);
    });
  }

  function drawResult(victory) {
    backdrop(victory ? 'green' : 'red');
    const w = Math.min(660, width - 34), h = Math.min(520, height - 30), x = (width - w) / 2, y = (height - h) / 2;
    panel(x, y, w, h, victory ? '#63f0d0' : '#ff5e70', .90);
    text(victory ? 'MISSION COMPLETE' : (document.getElementById('overTitle').textContent || 'YOU DIED'), width / 2, y + 26, victory ? 15 : 43, victory ? '#6ff0ae' : '#ff5266', 'center', 900, true);
    text(victory ? '任务完成' : document.getElementById('overSubtitle').textContent, width / 2, y + (victory ? 52 : 84), victory ? 43 : 13, victory ? '#d7ffff' : '#9aa8b4', 'center', 800, true);
    if (victory) text(document.getElementById('victoryName').textContent, width / 2, y + 110, 14, '#ffd67e', 'center', 700, true);
    const raw = document.getElementById(victory ? 'victoryStats' : 'overStats').innerText.split('\n').map(s => s.trim()).filter(Boolean);
    const startY = y + (victory ? 150 : 126), colW = (w - 66) / 2;
    for (let i = 0; i < Math.min(raw.length, 12); i += 2) {
      const col = (i / 2) % 2, row = Math.floor((i / 2) / 2), px = x + 24 + col * (colW + 18), py = startY + row * 48;
      panel(px, py, colW, 40, victory ? '#3bb89b' : '#8c3e49', .42);
      text(raw[i], px + 10, py + 7, 10, '#8496a6', 'left', 700, true);
      text(raw[i + 1] || '', px + colW - 10, py + 7, 14, '#f1f8fb', 'right', 700);
    }
    const by = y + h - 62;
    if (victory) {
      if (!document.getElementById('btnNextStage').classList.contains('hide')) place('victoryNext', width / 2 - 142, by, 130, 42, '下一关', 'green', 14);
      place('victoryMenu', width / 2 + 12, by, 130, 42, '返回基地', 'cyan', 14);
    } else {
      place('retry', width / 2 - 142, by, 130, 42, '再来一次', 'red', 14);
      place('menu', width / 2 + 12, by, 130, 42, '主菜单', 'dark', 14);
    }
  }

  function drawHud() {
    // The world-space labels, minimap and crosshair remain on the lower 2D canvas;
    // all fixed HUD panels and controls are rendered here.
    const low = P.hp / P.maxhp < .3;
    const vg = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .28, width / 2, height / 2, Math.max(width, height) * .65);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, low ? `rgba(110,0,8,${.54 + Math.sin(G.time * 6) * .08})` : 'rgba(0,0,0,.44)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, width, height);

    const phW = IS_MOBILE ? 238 : 268, phX = 12, phY = 12;
    panel(phX, phY, phW, 112, '#66d8ff', .64);
    place('level', phX + 10, phY + 10, 38, 34, String(P.lvl), 'cyan', 13);
    text(PROFILE?.name || '未载入 ID', phX + 58, phY + 12, 11, '#9cdff1', 'left', 700, true);
    text(`LV.${P.lvl}`, phX + phW - 12, phY + 12, 11, '#9cdff1', 'right', 700, true);
    bar(phX + 58, phY + 30, phW - 70, 6, P.xp / P.xpNext, ['#a854ff', '#63ffd5']);
    text('HP', phX + 12, phY + 53, 10, '#ff8c99', 'left', 700, true);
    bar(phX + 42, phY + 51, phW - 54, 15, P.hp / P.maxhp, ['#ff2e4d', '#ff7a3d'], `${Math.ceil(P.hp)}/${Math.ceil(P.maxhp)}`);
    text('AR', phX + 12, phY + 74, 10, '#78d6ff', 'left', 700, true);
    bar(phX + 42, phY + 72, phW - 54, 15, P.armor / P.maxarmor, ['#39b8ff', '#7ce7ff'], `${Math.ceil(P.armor)}/${Math.ceil(P.maxarmor)}`);
    text('ST', phX + 12, phY + 96, 10, '#ffd96b', 'left', 700, true);
    bar(phX + 42, phY + 96, phW - 54, 6, P.st / P.maxst, ['#ffd23f', '#fff59a']);

    const centerW = Math.min(520, Math.max(300, width - (IS_MOBILE ? 470 : 530))), centerX = (width - centerW) / 2;
    panel(centerX, 12, centerW, G.boss ? 82 : 56, G.boss ? '#ff5865' : '#63d8ff', .58);
    const mode = G.mode === 'stage' ? `关卡 · ${STAGES[G.stageId - 1].n}` : '无限流';
    text(mode, width / 2 - 60, 20, 10, '#e9c780', 'right', 700, true);
    text(`${G.wave}/${G.mode === 'stage' ? G.stageTarget : '∞'}`, width / 2, 18, 19, '#fff', 'center', 800, true);
    text(G.waveState === 'rest' ? `休整 ${Math.ceil(G.waveTimer)}s` : G.waveState === 'complete' ? '完成' : '战斗', width / 2 + 60, 20, 10, '#8bdff0', 'left', 700, true);
    text(`敌 ${G.enemies.length + G.spawnQueue.length}  ·  击杀 ${G.kills}  ·  分 ${G.score.toLocaleString()}  ·  ${fmtT(G.time)}  ·  连杀 x${G.combo}  ·  💰 ${G.coins}  ·  💣 ${P.nades}`,
      width / 2, 41, 10, '#a6b8c5', 'center');
    if (G.boss) {
      text(document.getElementById('bossName').textContent || 'BOSS', centerX + 16, 61, 10, '#ff8992', 'left', 700, true);
      bar(centerX + 92, 62, centerW - 108, 10, G.boss.hp / G.boss.maxhp, ['#8b0000', '#ffb300']);
    }

    const weapon = WEAPONS[P.wIdx], ammo = P.ammo[weapon.id], whW = IS_MOBILE ? 250 : 210, whH = IS_MOBILE ? 132 : 104;
    const whX = IS_MOBILE ? 10 : width - whW - 12, whY = IS_MOBILE ? height - 270 : height - 116;
    panel(whX, whY, whW, whH, '#65d9ff', .60);
    text(`${weapon.ico} ${weapon.n}`, whX + 12, whY + 10, 13, '#c7f3ff', 'left', 700, true);
    text(`${ammo.mag}`, whX + whW - 60, whY + 7, 28, ammo.mag <= weapon.mag * .25 ? '#ff6868' : '#fff', 'right', 800, true);
    text(`/ ${ammo.res > 1e8 ? '∞' : ammo.res}`, whX + whW - 12, whY + 15, 15, '#687887', 'right', 700, true);
    bar(whX + 12, whY + 48, whW - 24, 5, ammo.mag / weapon.mag, ['#ffd23f', '#fff59a']);
    text(`伤害 ${Math.round(weapon.dmg * P.perks.dmg)} · 射速 ${Math.round(weapon.rpm * P.perks.rof)}${weapon.pel > 1 ? ` · ${weapon.pel}弹丸` : ''}`, whX + 12, whY + 62, 10, '#8292a0');
    if (IS_MOBILE) {
      const owned = ownedWeaponIndices(), position = Math.max(0, owned.indexOf(P.wIdx)), maxPosition = Math.max(0, owned.length - 1);
      text(`滑动切换已获取武器  ${position + 1}/${owned.length}`, whX + 12, whY + 78, 9, '#73cfe8', 'left', 700, true);
      mobileWeaponSlider.limits(0, Math.max(1, maxPosition)).ticks(Math.max(1, maxPosition), 1, true).value(position);
      placeControl(mobileWeaponSlider, whX + 8, whY + 91, whW - 16, 34);
      mobileWeaponSlider.scheme(canvasScheme('cyan')).opaque(70);
      if (owned.length < 2) mobileWeaponSlider.disable();
      const joySize = Math.min(136, height * .24), joyY = height - joySize - 20;
      placeControl(moveJoy, 22, joyY, joySize, joySize);
      placeControl(aimJoy, width - joySize - 22, joyY, joySize, joySize);
      place('mobileNade', width - joySize - 80, joyY - 56, 50, 48, P.nadeT > 0 ? `${P.nadeT.toFixed(1)}` : '💣', P.nadeT > 0 ? 'dark' : 'orange', 17);
      place('mobileReload', width - 62, joyY - 56, 50, 48, '⟳', 'blue', 20);
      place('mobileDash', width - joySize - 80, height - 58, 50, 46, '»', 'cyan', 20);
      place('mobileFull', width - 184, 158, 82, 34, fullscreenElement() ? '退出全屏' : '进入全屏', 'dark', 10);
      place('mobilePause', width - 94, 158, 82, 34, 'Ⅱ 暂停', 'dark', 10);
    } else {
      const slotW = 43, y = height - 58;
      WEAPONS.forEach((wpn, i) => place(`weapon${i}`, 12 + i * (slotW + 5), y, slotW, 44,
        `${wpn.ico}\n${i + 1}`, !P.owned.includes(wpn.id) ? 'dark' : i === P.wIdx ? 'cyan' : 'blue', 11));
      text('WASD移动 · 鼠标瞄准/射击 · R换弹 · 空格闪避 · G手雷 · 1-9换枪 · P暂停', width / 2, height - 19, 10, '#566879', 'center', 600, true);
    }
    drawToasts();
  }

  function drawToasts() {
    const nodes = Array.from(document.getElementById('toast')?.children || []).slice(-4);
    nodes.forEach((node, i) => {
      const opacity = node.style.opacity === '0' ? 0 : 1;
      if (!opacity) return;
      const msg = node.textContent, tw = Math.min(width - 30, Math.max(170, ctx.measureText(msg).width + 40)), x = (width - tw) / 2, y = height * .22 + i * 34;
      panel(x, y, tw, 28, node.style.borderColor || '#66ccee', .72);
      text(msg, width / 2, y + 6, 12, node.style.color || '#dff7ff', 'center', 700, true);
    });
  }

  function activeScreen() {
    if (ORIENTATION_BLOCKED) return 'orientation';
    if (shown('accountScreen')) return 'account';
    if (shown('statsScreen')) return 'stats';
    if (shown('upScreen')) return 'upgrade';
    if (shown('pauseScreen')) return 'pause';
    if (shown('overScreen')) return 'over';
    if (shown('victoryScreen')) return 'victory';
    if (shown('growthScreen')) return 'growth';
    if (shown('howScreen')) return 'how';
    if (G.running) return 'hud';
    return 'start';
  }

  function draw() {
    if (canvas.width !== innerWidth || canvas.height !== innerHeight) resize();
    ctx.clearRect(0, 0, width, height);
    hideAll();
    const screen = activeScreen();
    switch (screen) {
      case 'orientation': drawOrientation(); break;
      case 'account': drawAccount(); break;
      case 'stats': drawStats(); break;
      case 'upgrade': drawUpgrade(); break;
      case 'pause': drawPause(); break;
      case 'over': drawResult(false); break;
      case 'victory': drawResult(true); break;
      case 'growth': drawGrowth(); break;
      case 'how': drawHow(); break;
      case 'hud': drawHud(); break;
      default: drawStart();
    }
    gui.draw();
  }

  resize();
  accountField.text(document.getElementById('accountIdInput').value || '');
  globalThis.CANVAS_UI = {
    draw,
    resize,
    busy: () => gui.isBusy,
    gui,
    version: GUI.VERSION
  };
  console.info(`[LAST Z] CanvasGUI ${GUI.VERSION} interface ready`);
})();
