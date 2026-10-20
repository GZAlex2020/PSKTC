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

/* 广州塔(小蛮腰)简笔 SVG */
const TOWER_SVG = `
<svg class="tower" viewBox="0 0 80 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="广州塔">
  <path d="M40 4 C30 50 22 90 28 120 C32 140 32 165 40 196 C48 165 48 140 52 120 C58 90 50 50 40 4 Z"
        fill="url(#tg)" stroke="#2B8CFF" stroke-width="2"/>
  <ellipse cx="40" cy="118" rx="22" ry="6" fill="none" stroke="#FF6B4A" stroke-width="2"/>
  <ellipse cx="40" cy="150" rx="14" ry="4" fill="none" stroke="#FFC53D" stroke-width="2"/>
  <circle cx="40" cy="6" r="4" fill="#FF6B4A"/>
  <defs>
    <linearGradient id="tg" x1="40" y1="4" x2="40" y2="196" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FF6B4A"/><stop offset="1" stop-color="#2B8CFF"/>
    </linearGradient>
  </defs>
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
    const unit = data.units.find(u => u.id === unitId) || data.units[0];
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
      <div class="know-title">${k.title}</div>
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
          <div class="ex-q">${e.question}</div>
          ${e.type === 'choice'
            ? `<div class="ex-opts">${e.options.map((o, oi) => `<button class="opt" data-oi="${oi}">${o}</button>`).join('')}</div>`
            : `<input class="ex-input" type="text" placeholder="请输入答案（可用拼音/中文）" />`}
          <button class="ex-submit">提交</button>
          <div class="ex-feedback hidden"></div>
        </div>`).join('')}
    </div>`;
}

function initPractice(el, unit, data) {
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

      const fb = card.querySelector('.ex-feedback');
      fb.classList.remove('hidden');
      if (correct) {
        card.classList.add('correct');
        fb.innerHTML = `<div class="fb-ok">✅ 答对啦，你真棒！</div>`;
      } else {
        card.classList.add('wrong');
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
