/* ===========================================================
   render.js — 渲染层：首页 / 单元列表 / 单元详情(知识点+练习)
   纯前端，无框架依赖。
   =========================================================== */

const SUBJECTS = {
  yuwen:  { name: '语文', icon: '📖', color: '#FF6B4A' },
  shuxue: { name: '数学', icon: '🔢', color: '#2B8CFF' },
  yingyu: { name: '英语', icon: '🔤', color: '#FFC53D' }
};

const GRADES = { 1: '一年级', 2: '二年级', 3: '三年级' };

/* 错题本：localStorage 持久化，按 key 去重 */
const WrongBook = {
  KEY: 'psktc_wrong',
  get() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { return []; } },
  add(item) {
    const list = this.get();
    if (!list.find(x => x.key === item.key)) {
      list.push(item);
      localStorage.setItem(this.KEY, JSON.stringify(list));
    }
  },
  count() { return this.get().length; }
};

/* 答案规整：去空格、转小写，提升判分容错 */
function norm(s) {
  return (s == null ? '' : String(s)).trim().replace(/\s+/g, '').toLowerCase();
}

/* ============ 声音互动 ============ */
let currentSubject = 'yuwen';
let soundOn = true;
try { soundOn = localStorage.getItem('psktc_sound') !== 'off'; } catch (e) {}

/* 文本朗读：语文/数学用中文，英语用美式英语；离线可用（浏览器内置语音合成） */
function speak(text) {
  if (!('speechSynthesis' in window)) { alert('当前浏览器不支持语音朗读哦～'); return; }
  const lang = currentSubject === 'yingyu' ? 'en-US' : 'zh-CN';
  try { window.speechSynthesis.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(String(text || '').replace(/\n/g, ' '));
  u.lang = lang; u.rate = 0.95; u.pitch = 1;
  window.speechSynthesis.speak(u);
}

/* 答题提示音：用 Web Audio 实时合成，无需音频文件 */
let _audioCtx = null;
function tone(freq, dur, type, delay) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    const t0 = _audioCtx.currentTime + (delay || 0);
    const o = _audioCtx.createOscillator();
    const g = _audioCtx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(_audioCtx.destination);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.03);
  } catch (e) {}
}
function playCorrect() { tone(660, 0.14, 'sine', 0); tone(880, 0.18, 'sine', 0.12); }
function playWrong()   { tone(196, 0.32, 'sawtooth', 0); }

/* 生成一个朗读按钮 */
function spk(text) {
  return `<button class="spk" data-spk="${encodeURIComponent(text)}" title="朗读" aria-label="朗读">🔊</button>`;
}

/* 全局声音开关 */
function toggleSound() {
  soundOn = !soundOn;
  localStorage.setItem('psktc_sound', soundOn ? 'on' : 'off');
  document.body.classList.toggle('no-sound', !soundOn);
  const fab = document.getElementById('soundFab');
  if (fab) fab.textContent = soundOn ? '🔊' : '🔇';
}
function ensureSoundFab() {
  if (document.getElementById('soundFab')) return;
  const b = document.createElement('button');
  b.id = 'soundFab'; b.className = 'sound-fab'; b.title = '声音开关';
  b.textContent = soundOn ? '🔊' : '🔇';
  b.onclick = toggleSound;
  document.body.appendChild(b);
}
document.body.classList.toggle('no-sound', !soundOn);

/* 全局点击委托：朗读按钮 */
document.addEventListener('click', (ev) => {
  const s = ev.target.closest('.spk');
  if (s) { ev.preventDefault(); speak(decodeURIComponent(s.dataset.spk)); }
});

/* 初始化声音悬浮按钮 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureSoundFab);
} else {
  ensureSoundFab();
}

/* 广州塔(小蛮腰)场景插画 */
const TOWER_SVG = `
<svg class="tower" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="广州塔">
  <defs>
    <linearGradient id="tgBody" x1="120" y1="58" x2="120" y2="210" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7CD0FF"/>
      <stop offset="1" stop-color="#2B7FE8"/>
    </linearGradient>
    <clipPath id="tgClip">
      <path d="M94,210 C104,178 110,152 112,130 C113,106 104,80 100,58 Q120,50 140,58 C136,80 127,106 128,130 C130,152 136,178 146,210 Z"/>
    </clipPath>
  </defs>

  <circle cx="50" cy="52" r="30" fill="#FFC53D" opacity=".18"/>
  <circle cx="50" cy="52" r="20" fill="#FFC53D" opacity=".85"/>

  <g fill="#FFFFFF" opacity=".9">
    <ellipse cx="188" cy="66" rx="16" ry="7"/>
    <ellipse cx="201" cy="59" rx="11" ry="6"/>
    <ellipse cx="36" cy="124" rx="13" ry="6"/>
    <ellipse cx="47" cy="118" rx="9" ry="5"/>
  </g>

  <ellipse cx="120" cy="219" rx="50" ry="8" fill="#2B8CFF" opacity=".12"/>

  <path d="M94,210 C104,178 110,152 112,130 C113,106 104,80 100,58 Q120,50 140,58 C136,80 127,106 128,130 C130,152 136,178 146,210 Z"
        fill="url(#tgBody)"/>
  <g clip-path="url(#tgClip)" stroke="#FFFFFF" stroke-opacity=".38" stroke-width="2">
    <line x1="88" y1="72" x2="152" y2="72"/>
    <line x1="88" y1="92" x2="152" y2="92"/>
    <line x1="88" y1="112" x2="152" y2="112"/>
    <line x1="88" y1="130" x2="152" y2="130"/>
    <line x1="88" y1="150" x2="152" y2="150"/>
    <line x1="88" y1="172" x2="152" y2="172"/>
    <line x1="88" y1="194" x2="152" y2="194"/>
  </g>
  <line x1="120" y1="56" x2="120" y2="24" stroke="#2B8CFF" stroke-width="3" stroke-linecap="round"/>
  <circle cx="120" cy="20" r="4" fill="#FF6B4A"/>
</svg>`;

/* ============ 渲染入口 ============ */
const Render = {
  /* 首页 */
  home(el) {
    el.innerHTML = `
      <header class="hero">
        ${TOWER_SVG}
        <h1>小学知识训练营</h1>
        <p>广州 · 人教版 · 一至三年级上学期</p>
        <span class="kapok-badge">🌺 木棉花开，快乐学习</span>
      </header>
      <section class="picker">
        <h2>① 选择年级</h2>
        <div class="cards" id="gradeCards">
          ${[1, 2, 3].map(g => `
            <button class="pick-card" data-grade="${g}">
              <span class="big">${g}</span><span>${GRADES[g]}</span>
            </button>`).join('')}
        </div>
        <h2>② 选择科目</h2>
        <div class="cards" id="subjCards">
          ${Object.entries(SUBJECTS).map(([k, v]) => `
            <button class="pick-card" data-subject="${k}" style="--c:${v.color}">
              <span class="ico">${v.icon}</span><span>${v.name}</span>
            </button>`).join('')}
        </div>
      </section>`;

    let selGrade = null, selSubject = null;
    const mark = (sel, btn) => {
      el.querySelectorAll(sel + ' .pick-card').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
    };
    const go = () => { if (selGrade && selSubject) location.hash = `${selGrade}/${selSubject}`; };

    el.querySelectorAll('[data-grade]').forEach(b => b.onclick = () => { selGrade = b.dataset.grade; mark('#gradeCards', b); go(); });
    el.querySelectorAll('[data-subject]').forEach(b => b.onclick = () => { selSubject = b.dataset.subject; mark('#subjCards', b); go(); });
  },

  /* 单元列表 */
  unitList(el, data) {
    el.innerHTML = `
      <nav class="topbar">
        <button class="back" data-back>← 首页</button>
        <div class="crumb">${GRADES[data.grade]} · ${SUBJECTS[data.subject].name}
          <span class="edition">${data.edition}</span></div>
      </nav>
      <h2 class="page-title">${data.title}</h2>
      <div class="unit-list">
        ${data.units.map(u => `
          <a class="unit-card ${u.placeholder ? 'placeholder' : ''}" href="#${data.grade}/${data.subject}/${u.id}">
            <span class="unit-no">${u.id.toUpperCase()}</span>
            <span class="unit-name">${u.name}</span>
            ${u.placeholder
              ? '<span class="placeholder-tag">敬请期待</span>'
              : `<span class="unit-meta">${u.knowledge.length} 知识点 · ${u.exercises.length} 练习</span>`}
          </a>`).join('')}
      </div>`;
    el.querySelector('[data-back]').onclick = () => { location.hash = ''; };
  },

  /* 单元详情（知识点 + 练习闯关） */
  unitDetail(el, data, unitId) {
    currentSubject = data.subject;
    const unit = data.units.find(u => u.id === unitId) || data.units[0];
    /* 开始记录本单元学习时长 */
    if (window.Auth && Auth.gate()) Auth.trackUnit(`${data.grade}/${data.subject}/${unit.id}`, data.grade, data.subject, unit.id);
    el.innerHTML = `
      <nav class="topbar">
        <button class="back" data-back>← 返回</button>
        <div class="crumb">${GRADES[data.grade]} · ${SUBJECTS[data.subject].name}</div>
        <span class="wrong-badge">错题 ${WrongBook.count()}</span>
      </nav>
      <h2 class="page-title">${unit.name}</h2>
      ${unit.placeholder
        ? '<div class="placeholder-box">本单元内容正在整理中，敬请期待～🌿</div>'
        : `
        <div class="tabs">
          <button class="tab active" data-tab="know">📚 知识点</button>
          <button class="tab" data-tab="prac">🎯 练习闯关</button>
        </div>
        <div id="tab-know" class="tab-panel">${renderKnowledge(unit)}</div>
        <div id="tab-prac" class="tab-panel hidden">${renderPractice(unit)}</div>`}`;

    el.querySelector('[data-back]').onclick = () => { location.hash = `${data.grade}/${data.subject}`; };

    if (!unit.placeholder) {
      el.querySelectorAll('.tab').forEach(t => t.onclick = () => {
        el.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        el.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
        el.querySelector('#tab-' + t.dataset.tab).classList.remove('hidden');
      });
      initPractice(el, unit, data);
    }
  }
};

/* ============ 知识点渲染 ============ */
function renderKnowledge(unit) {
  if (!unit.knowledge.length) return '<p class="empty">本单元暂无知识点</p>';
  return unit.knowledge.map(k => `
    <div class="know-card">
      <div class="know-title">${k.title} ${spk(k.title + '。' + k.content)}</div>
      <div class="know-body">${k.content.replace(/\n/g, '<br>')}</div>
    </div>`).join('');
}

/* ============ 练习渲染 ============ */
function renderPractice(unit) {
  if (!unit.exercises.length) return '<p class="empty">本单元暂无练习</p>';
  return `
    <div class="progress-wrap">
      <div class="progress-bar"><div class="progress-fill" id="prog"></div></div>
      <span class="prog-text" id="progText">0/${unit.exercises.length}</span>
    </div>
    <div class="ex-list">
      ${unit.exercises.map((e, i) => `
        <div class="ex-card" data-eid="${e.id}">
          <div class="ex-no">第 ${i + 1} 题</div>
          <div class="ex-q">${e.question} ${spk(e.question)}</div>
          ${e.type === 'choice'
            ? `<div class="ex-opts">${e.options.map((o, oi) => `<div class="opt-row"><button class="opt" data-oi="${oi}">${o}</button>${spk(o)}</div>`).join('')}</div>`
            : `<input class="ex-input" type="text" placeholder="请输入答案（可用拼音/中文）" />`}
          <button class="ex-submit">提交</button>
          <div class="ex-feedback hidden"></div>
        </div>`).join('')}
    </div>`;
}

function initPractice(el, unit, data) {
  currentSubject = data.subject;
  const fill = el.querySelector('#prog');
  const text = el.querySelector('#progText');
  let answered = 0;
  const updateProg = () => {
    fill.style.width = Math.round(answered / unit.exercises.length * 100) + '%';
    text.textContent = `${answered}/${unit.exercises.length}`;
  };
  updateProg();

  el.querySelectorAll('.ex-card').forEach(card => {
    const e = unit.exercises.find(x => x.id === card.dataset.eid);
    const opts = card.querySelectorAll('.opt');
    let chosen = null;
    opts.forEach(o => o.onclick = () => {
      if (card.dataset.done) return;
      opts.forEach(x => x.classList.remove('chosen'));
      o.classList.add('chosen');
      chosen = o.dataset.oi;
    });

    card.querySelector('.ex-submit').onclick = () => {
      if (card.dataset.done) return;
      let userAns;
      if (e.type === 'choice') {
        if (chosen === null) { alert('请先选择一个答案哦～'); return; }
        userAns = e.options[chosen];
      } else {
        const inp = card.querySelector('.ex-input');
        userAns = inp.value.trim();
        if (!userAns) { alert('请输入答案哦～'); return; }
      }

      const correct = norm(userAns) === norm(e.answer);
      card.dataset.done = '1';
      answered++;
      updateProg();

      /* 全部完成后，上报完成度与得分 */
      if (answered === unit.exercises.length && window.Auth && Auth.gate()) {
        const score = el.querySelectorAll('.ex-card.correct').length;
        Auth.markComplete(`${data.grade}/${data.subject}/${unit.id}`, data.grade, data.subject, unit.id, score, unit.exercises.length);
      }

      const fb = card.querySelector('.ex-feedback');
      fb.classList.remove('hidden');
      if (correct) {
        card.classList.add('correct');
        fb.innerHTML = `<div class="fb-ok">✅ 答对啦，你真棒！</div>`;
        playCorrect();
      } else {
        card.classList.add('wrong');
        playWrong();
        fb.innerHTML = `<div class="fb-no">❌ 正确答案：${e.answer}</div>
                        <div class="fb-exp">💡 ${e.explain || '再想一想，下次一定行！'}</div>`;
        WrongBook.add({
          key: `${data.grade}/${data.subject}/${unit.id}/${e.id}`,
          grade: data.grade, subject: data.subject, unit: unit.name,
          question: e.question, answer: e.answer, explain: e.explain || ''
        });
      }
    };
  });
}
