/* ===========================================================
   auth.js — 用户管理 / 登录门禁 / 进度上报 / 报表
   依赖：PSK_DATA、GRADES、SUBJECTS、DATA_KEYS（来自 render.js / app.js）
   提供全局对象 Auth。
   =========================================================== */
const Auth = {
  KEY: 'psktc_auth',
  token: null,
  user: null,       // { username, role }
  _unit: null,      // 当前正在学习的单元计时

  load() {
    try {
      const a = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      if (a && a.token) { this.token = a.token; this.user = { username: a.username, role: a.role }; }
    } catch (e) {}
  },

  gate() { return !!this.token; },

  async api(path, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    try {
      const r = await fetch(path, {
        method: opts.method || 'GET',
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
      if (r.status === 401 && path !== '/api/login') { this.logout(); return null; }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || ('错误 ' + r.status));
      return data;
    } catch (e) {
      console.warn('API 失败', path, e.message);
      return null;
    }
  },

  async login(username, password) {
    const data = await this.api('/api/login', { method: 'POST', body: { username, password } });
    if (!data || !data.token) { alert('登录失败：' + (data ? (data.error || '未知错误') : '网络异常')); return false; }
    this.token = data.token;
    this.user = { username: data.username, role: data.role };
    localStorage.setItem(this.KEY, JSON.stringify(this.user && this.token ? { token: this.token, username: data.username, role: data.role } : {}));
    this.hideLogin();
    this.renderHeader();
    if (window.router) window.router();
    return true;
  },

  logout() {
    this.token = null; this.user = null;
    localStorage.removeItem(this.KEY);
    this.removeHeader();
    this.showLogin();
    const app = document.getElementById('app'); if (app) app.innerHTML = '';
  },

  /* ---- 登录界面 ---- */
  showLogin() {
    if (document.getElementById('loginOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'loginOverlay';
    ov.className = 'login-overlay';
    ov.innerHTML = `
      <div class="login-card">
        <h2>🌺 小学知识训练营</h2>
        <p class="login-sub">广州 · 人教版 · 一至三年级上学期</p>
        <input id="lgUser" class="login-input" type="text" placeholder="用户名" autocomplete="username" />
        <input id="lgPwd" class="login-input" type="password" placeholder="密码" autocomplete="current-password" />
        <button id="lgBtn" class="login-btn">登 录</button>
        <p class="login-hint">管理员初始账号：admin / admin3344139</p>
      </div>`;
    document.body.appendChild(ov);
    const go = () => this.login(document.getElementById('lgUser').value.trim(), document.getElementById('lgPwd').value);
    document.getElementById('lgBtn').onclick = go;
    document.getElementById('lgPwd').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  },
  hideLogin() { const o = document.getElementById('loginOverlay'); if (o) o.remove(); },

  /* ---- 顶部栏 ---- */
  renderHeader() {
    let h = document.getElementById('pskHeader');
    if (!h) {
      h = document.createElement('header');
      h.id = 'pskHeader';
      h.className = 'psk-header';
      document.body.insertBefore(h, document.body.firstChild);
    }
    const isAdmin = this.user && this.user.role === 'admin';
    h.innerHTML = `
      <div class="psk-brand" data-home>🌺 小学知识训练营</div>
      <nav class="psk-nav">
        <a data-route="home">首页</a>
        <a data-route="report">我的学习报表</a>
        ${isAdmin ? '<a data-route="admin">用户管理</a>' : ''}
      </nav>
      <div class="psk-user">
        <span>👤 ${this.user.username}${isAdmin ? '（管理员）' : ''}</span>
        <button class="psk-logout" data-logout>退出</button>
      </div>`;
    h.querySelector('[data-home]').onclick = () => { location.hash = ''; };
    h.querySelectorAll('.psk-nav a').forEach(a => a.onclick = () => {
      const r = a.dataset.route;
      if (r === 'home') location.hash = '';
      else if (r === 'report') this.showReport();
      else if (r === 'admin') this.showAdmin();
    });
    h.querySelector('[data-logout]').onclick = () => this.logout();
  },
  removeHeader() { const h = document.getElementById('pskHeader'); if (h) h.remove(); },
  ensureHeader() { if (this.gate()) this.renderHeader(); },

  /* ---- 进度上报 ---- */
  trackUnit(key, grade, subject, unitId) {
    if (!this.gate()) return;
    this._unit = { key, grade, subject, unit: unitId, start: Date.now() };
  },
  endUnit() {
    if (!this._unit) return;
    const el = Math.round((Date.now() - this._unit.start) / 1000);
    const u = this._unit; this._unit = null;
    if (el > 0) this.api('/api/progress', { method: 'POST', body: { key: u.key, grade: u.grade, subject: u.subject, unit: u.unit, seconds: el } });
  },
  markComplete(key, grade, subject, unitId, score, total) {
    if (!this.gate()) return;
    this.api('/api/progress', { method: 'POST', body: { key, grade, subject, unit: unitId, score, total, completed: true } });
  },

  /* ---- 报表 ---- */
  fmtTime(sec) {
    sec = sec || 0;
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return `${h} 小时 ${m} 分`;
    if (m) return `${m} 分 ${s} 秒`;
    return `${s} 秒`;
  },

  async showReport() {
    const app = document.getElementById('app');
    if (!this.gate()) { this.showLogin(); return; }
    app.innerHTML = `<div class="loading">正在加载学习报表…</div>`;
    const rep = await this.api('/api/report');
    if (!rep) return;
    app.innerHTML = this.renderReport(rep, false);
    app.querySelector('[data-back]').onclick = () => { location.hash = ''; };
  },

  async showUserReport(name) {
    const app = document.getElementById('app');
    app.innerHTML = `<div class="loading">正在加载 ${name} 的报表…</div>`;
    const rep = await this.api('/api/report?user=' + encodeURIComponent(name));
    if (!rep) { this.showAdmin(); return; }
    app.innerHTML = this.renderReport(rep, true);
    app.querySelector('[data-back]').onclick = () => this.showAdmin();
  },

  renderReport(rep, isAdmin) {
    const byGS = {};
    DATA_KEYS.forEach(k => {
      const d = PSK_DATA[k];
      byGS[k] = { name: GRADES[d.grade] + ' · ' + SUBJECTS[d.subject].name, total: d.units.length, done: 0, sec: 0, accSum: 0, accTot: 0 };
    });
    let totalUnits = 0, doneAll = 0, secAll = 0, accSum = 0, accTot = 0;
    Object.entries(byGS).forEach(([k, v]) => { totalUnits += v.total; });
    Object.entries(rep.units || {}).forEach(([key, u]) => {
      const gs = key.split('/').slice(0, 2).join('/');
      const v = byGS[gs];
      if (v) {
        if (u.completed) v.done++;
        v.sec += (u.seconds || 0);
        if (typeof u.score === 'number' && typeof u.total === 'number') { v.accSum += u.score; v.accTot += u.total; }
      }
      if (u.completed) doneAll++;
      secAll += (u.seconds || 0);
      if (typeof u.score === 'number' && typeof u.total === 'number') { accSum += u.score; accTot += u.total; }
    });

    const cards = Object.entries(byGS).map(([k, v]) => {
      const pct = v.total ? Math.round(v.done / v.total * 100) : 0;
      const acc = v.accTot ? Math.round(v.accSum / v.accTot * 100) : '—';
      return `
        <div class="rep-card">
          <div class="rep-card-name">${v.name}</div>
          <div class="rep-bar"><div class="rep-fill" style="width:${pct}%"></div></div>
          <div class="rep-stat">完成 ${v.done}/${v.total} 单元 · 正确率 ${acc}%</div>
          <div class="rep-time">⏱ ${this.fmtTime(v.sec)}</div>
        </div>`;
    }).join('');

    return `
      <nav class="topbar"><button class="back" data-back>← ${isAdmin ? '返回管理' : '首页'}</button>
        <div class="crumb">${isAdmin ? (rep.username + ' 的') : '我的'}学习报表</div></nav>
      <div class="rep-overview">
        <div class="rep-ov"><b>${this.fmtTime(secAll)}</b><span>总学习时长</span></div>
        <div class="rep-ov"><b>${doneAll}/${totalUnits}</b><span>完成单元</span></div>
        <div class="rep-ov"><b>${rep.accuracy}%</b><span>平均正确率</span></div>
      </div>
      <div class="rep-grid">${cards}</div>`;
  },

  /* ---- 管理员面板 ---- */
  async showAdmin() {
    const app = document.getElementById('app');
    if (!this.gate()) { this.showLogin(); return; }
    if (!this.user || this.user.role !== 'admin') { alert('无权限'); return; }
    app.innerHTML = `<div class="loading">正在加载用户列表…</div>`;
    const data = await this.api('/api/users');
    if (!data) return;
    const rows = data.users.map(u => `
      <tr>
        <td>${u.username}${u.role === 'admin' ? ' 👑' : ''}</td>
        <td>${u.role === 'admin' ? '管理员' : '普通用户'}</td>
        <td>${this.fmtTime(u.totalSeconds)}</td>
        <td>${u.completed || 0}</td>
        <td>${u.lastActive ? new Date(u.lastActive).toLocaleString() : '—'}</td>
        <td class="rep-actions">
          <button class="mini-btn" data-view="${u.username}">报表</button>
          <button class="mini-btn danger" data-del="${u.username}">删除</button>
        </td>
      </tr>`).join('');
    app.innerHTML = `
      <nav class="topbar"><button class="back" data-back>← 首页</button><div class="crumb">用户管理</div></nav>
      <div class="admin-add">
        <h3>新增用户</h3>
        <input id="nuName" placeholder="用户名" />
        <input id="nuPwd" placeholder="密码" type="password" />
        <select id="nuRole"><option value="user">普通用户</option><option value="admin">管理员</option></select>
        <button id="nuBtn" class="mini-btn">创建</button>
      </div>
      <table class="admin-table">
        <thead><tr><th>用户名</th><th>角色</th><th>学习时长</th><th>完成单元</th><th>最后活跃</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    app.querySelector('[data-back]').onclick = () => { location.hash = ''; };
    app.querySelector('#nuBtn').onclick = async () => {
      const name = app.querySelector('#nuName').value.trim();
      const pwd = app.querySelector('#nuPwd').value;
      const role = app.querySelector('#nuRole').value;
      if (!name || !pwd) { alert('请填写用户名和密码'); return; }
      const r = await this.api('/api/register', { method: 'POST', body: { username: name, password: pwd, role } });
      if (r && r.ok) { alert('创建成功'); this.showAdmin(); }
      else alert('创建失败');
    };
    app.querySelectorAll('[data-view]').forEach(b => b.onclick = () => this.showUserReport(b.dataset.view));
    app.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('确定删除用户 ' + b.dataset.del + ' 及其学习记录？')) return;
      const r = await this.api('/api/users/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
      if (r && r.ok) this.showAdmin(); else alert('删除失败');
    });
  }
};

/* 挂到 window：const 声明不会自动成为 window 属性，
   而 app.js 路由通过 window.Auth 判断登录门禁 */
window.Auth = Auth;

/* 初始化 */
Auth.load();
Auth.ensureHeader();
// 若已有登录态，异步校验 token 是否仍有效（服务器重启后 token 失效）
if (Auth.gate()) {
  Auth.api('/api/me').then(d => { if (!d) Auth.logout(); });
}
