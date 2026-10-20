/* ===========================================================
   app.js — 前端 hash 路由与数据调度
   路由规则：
     #                     -> 首页
     #1/yuwen              -> 一年级语文 单元列表
     #1/yuwen/u1           -> 一年级语文 第一单元 详情
   数据来自全局对象 PSK_DATA（由 data/*.js 注入，离线可用）。
   =========================================================== */

const DATA_KEYS = [
  '1/yuwen', '1/shuxue', '1/yingyu',
  '2/yuwen', '2/shuxue', '2/yingyu',
  '3/yuwen', '3/shuxue', '3/yingyu'
];

function router() {
  const app = document.getElementById('app');
  /* 登录门禁：未登录只显示登录界面 */
  if (!window.Auth || !Auth.gate()) { if (window.Auth) Auth.showLogin(); return; }
  Auth.ensureHeader();
  /* 离开上一个单元前，结算学习时长 */
  Auth.endUnit();

  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);

  /* 报表 / 管理路由 */
  if (parts[0] === 'report') { Auth.showReport(); return; }
  if (parts[0] === 'admin') { Auth.showAdmin(); return; }

  if (parts.length === 0) {
    Render.home(app);
    return;
  }

  if (parts.length >= 2) {
    const key = parts[0] + '/' + parts[1];
    const data = (typeof PSK_DATA !== 'undefined' && PSK_DATA[key]) || null;
    if (!data) { Render.home(app); return; }
    if (parts.length === 2) {
      Render.unitList(app, data);
    } else {
      Render.unitDetail(app, data, parts[2]);
    }
    window.scrollTo(0, 0);
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
