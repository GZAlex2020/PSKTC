/* ============================================================
   server.js — 零依赖 Node 后端
   功能：
     - 静态文件服务（项目根目录）
     - 用户账号 + token 鉴权 + 进度持久化（data/store.json）
     - 首次启动自动创建管理员 admin / admin3344139
   运行：node server.js   （默认端口 8000）
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const STORE = path.join(ROOT, 'data', 'store.json');
const TOKENS = new Map(); // token -> username

/* ---------- 存储 ---------- */
function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch (e) { return null; }
}
function saveStore(s) {
  fs.writeFileSync(STORE, JSON.stringify(s, null, 2));
}
let store = loadStore() || { users: [], progress: {} };

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return { salt, hash };
}
function verify(pw, salt, hash) {
  const h = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
}

/* 首次启动确保管理员存在 */
if (!store.users.some(u => u.username === 'admin')) {
  const { salt, hash } = hashPassword('admin3344139');
  store.users.push({ username: 'admin', role: 'admin', salt, hash, createdAt: new Date().toISOString() });
  saveStore(store);
}

/* ---------- 工具 ---------- */
function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '', size = 0;
    req.on('data', c => { data += c; size += c.length; if (size > 1e6) { req.destroy(); reject(new Error('body too large')); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function authUser(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const u = TOKENS.get(m[1]);
  if (!u) return null;
  return store.users.find(x => x.username === u) || null;
}
function nowISO() { return new Date().toISOString(); }

function buildReport(username) {
  const p = store.progress[username] || { units: {} };
  const units = p.units || {};
  let totalSeconds = 0, completed = 0, scoreSum = 0, totalSum = 0;
  Object.values(units).forEach(u => {
    totalSeconds += (u.seconds || 0);
    if (u.completed) completed++;
    if (typeof u.score === 'number' && typeof u.total === 'number') { scoreSum += u.score; totalSum += u.total; }
  });
  return {
    username,
    totalSeconds,
    completed,
    attempted: Object.keys(units).length,
    accuracy: totalSum ? Math.round(scoreSum / totalSum * 100) : 0,
    units
  };
}

/* ---------- API ---------- */
async function api(req, res, p, u) {
  /* 登录（公开） */
  if (p === '/api/login' && req.method === 'POST') {
    const b = await readBody(req);
    const user = store.users.find(x => x.username === b.username);
    if (!user || !verify(b.password || '', user.salt, user.hash)) return sendJSON(res, 401, { error: '用户名或密码错误' });
    const token = crypto.randomBytes(24).toString('hex');
    TOKENS.set(token, user.username);
    return sendJSON(res, 200, { token, username: user.username, role: user.role });
  }

  if (p === '/api/me' && req.method === 'GET') {
    const me = authUser(req); if (!me) return sendJSON(res, 401, { error: '未登录' });
    if (store.progress[me.username]) store.progress[me.username].lastActive = nowISO();
    return sendJSON(res, 200, { username: me.username, role: me.role, report: buildReport(me.username) });
  }

  /* 以下均需登录 */
  if (p === '/api/register' && req.method === 'POST') {
    const me = authUser(req); if (!me || me.role !== 'admin') return sendJSON(res, 403, { error: '无权限' });
    const b = await readBody(req);
    if (!b.username || !b.password) return sendJSON(res, 400, { error: '用户名和密码必填' });
    if (store.users.find(x => x.username === b.username)) return sendJSON(res, 409, { error: '用户已存在' });
    const { salt, hash } = hashPassword(b.password);
    store.users.push({ username: b.username, role: b.role === 'admin' ? 'admin' : 'user', salt, hash, createdAt: nowISO() });
    saveStore(store);
    return sendJSON(res, 200, { ok: true });
  }

  if (p === '/api/users' && req.method === 'GET') {
    const me = authUser(req); if (!me || me.role !== 'admin') return sendJSON(res, 403, { error: '无权限' });
    const list = store.users.map(u => {
      const pr = store.progress[u.username];
      let totalSeconds = 0, completed = 0;
      if (pr && pr.units) Object.values(pr.units).forEach(x => { totalSeconds += (x.seconds || 0); if (x.completed) completed++; });
      return { username: u.username, role: u.role, createdAt: u.createdAt, lastActive: pr ? pr.lastActive : null, totalSeconds, completed };
    });
    return sendJSON(res, 200, { users: list });
  }

  if (p.startsWith('/api/users/') && req.method === 'DELETE') {
    const me = authUser(req); if (!me || me.role !== 'admin') return sendJSON(res, 403, { error: '无权限' });
    const name = decodeURIComponent(p.slice('/api/users/'.length));
    if (name === me.username) return sendJSON(res, 400, { error: '不能删除自己' });
    const idx = store.users.findIndex(x => x.username === name);
    if (idx < 0) return sendJSON(res, 404, { error: '用户不存在' });
    store.users.splice(idx, 1);
    delete store.progress[name];
    saveStore(store);
    TOKENS.forEach((v, k) => { if (v === name) TOKENS.delete(k); });
    return sendJSON(res, 200, { ok: true });
  }

  if (p === '/api/progress' && req.method === 'POST') {
    const me = authUser(req); if (!me) return sendJSON(res, 401, { error: '未登录' });
    const b = await readBody(req);
    if (!b.key) return sendJSON(res, 400, { error: '缺少 key' });
    if (!store.progress[me.username]) store.progress[me.username] = { units: {} };
    const units = store.progress[me.username].units;
    const cur = units[b.key] || { score: null, total: null, completed: false, seconds: 0 };
    if (typeof b.seconds === 'number') cur.seconds = (cur.seconds || 0) + b.seconds;
    if (typeof b.score === 'number') cur.score = b.score;
    if (typeof b.total === 'number') cur.total = b.total;
    if (b.completed === true) cur.completed = true;
    if (b.grade) cur.grade = b.grade;
    if (b.subject) cur.subject = b.subject;
    if (b.unit) cur.unit = b.unit;
    cur.updatedAt = nowISO();
    units[b.key] = cur;
    store.progress[me.username].lastActive = nowISO();
    saveStore(store);
    return sendJSON(res, 200, { ok: true, unit: cur });
  }

  if (p === '/api/report' && req.method === 'GET') {
    const me = authUser(req); if (!me) return sendJSON(res, 401, { error: '未登录' });
    let target = me.username;
    if (u.searchParams.get('user')) {
      if (me.role !== 'admin') return sendJSON(res, 403, { error: '无权限' });
      target = u.searchParams.get('user');
    }
    return sendJSON(res, 200, buildReport(target));
  }

  return sendJSON(res, 404, { error: '接口不存在' });
}

/* ---------- 静态服务 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};
function serveStatic(req, res, pathname) {
  let f = decodeURIComponent(pathname);
  if (f === '/') f = '/index.html';
  if (f.includes('..')) { res.writeHead(403); res.end('forbidden'); return; }
  const fp = path.join(ROOT, path.normalize(f));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  if (p.startsWith('/api/')) {
    try { await api(req, res, p, u); }
    catch (e) { sendJSON(res, 500, { error: '服务器错误' }); }
    return;
  }
  serveStatic(req, res, p);
});

server.listen(PORT, () => console.log('小学知识训练营 运行中： http://localhost:' + PORT));
