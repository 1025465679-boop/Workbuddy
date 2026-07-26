const Store = {
  get(key, def = []) {
    try {
      const v = localStorage.getItem('wb_' + key);
      return v ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(key, val) {
    localStorage.setItem('wb_' + key, JSON.stringify(val));
  }
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(d) {
  const days = ['周日','周一','周二','周三','周四','周五','周六'];
  return `${d.getMonth()+1}月${d.getDate()}日 ${days[d.getDay()]}`;
}

function toast(msg) {
  let t = $('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function speak(text, lang = 'en-US', rate = 0.9) {
  if (!('speechSynthesis' in window)) {
    toast('当前浏览器不支持语音播放');
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

const PAGES = {
  daily:   { title: '每日计划',     render: renderDaily,   showFab: true  },
  log:     { title: '每日工作日志提醒', render: renderLog,     showFab: false },
  travel:  { title: '旅游助手',     render: renderTravel,  showFab: true  },
  review:  { title: '每日/周复盘',  render: renderReview,  showFab: false },
  english: { title: '英语口语学习', render: renderEnglish, showFab: false },
};

let currentPage = 'daily';

function initNav() {
  $('#menuBtn').addEventListener('click', () => {
    $('#sidebar').classList.add('open');
    $('#overlay').classList.add('show');
  });
  $('#overlay').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#overlay').classList.remove('show');
  });
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      switchPage(page);
      $('#sidebar').classList.remove('open');
      $('#overlay').classList.remove('show');
    });
  });
  $('#fab').addEventListener('click', () => {
    if (currentPage === 'daily') {
      const input = $('#taskInput');
      if (input) { input.focus(); }
    } else if (currentPage === 'travel') {
      const input = $('#travelInput');
      if (input) { input.focus(); }
    }
  });
}

function switchPage(page) {
  currentPage = page;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#pageTitle').textContent = PAGES[page].title;
  $('#fab').classList.toggle('hidden', !PAGES[page].showFab);
  PAGES[page].render();
}

function renderDaily() {
  const tasks = Store.get('tasks', []);
  const today = todayStr();
  const todayTasks = tasks.filter(t => t.date === today);
  const done = todayTasks.filter(t => t.done).length;
  const total = todayTasks.length;
  const percent = total ? Math.round(done/total*100) : 0;

  $('#content').innerHTML = `
    <div class="task-stats">
      <div class="stat-box"><div class="stat-num">${done}</div><div class="stat-label">已完成</div></div>
      <div class="stat-box"><div class="stat-num">${total-done}</div><div class="stat-label">待办</div></div>
      <div class="stat-box"><div class="stat-num">${percent}%</div><div class="stat-label">完成率</div></div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
    <div class="card">
      <h3 class="card-title"><span class="emoji">➕</span>添加今日任务</h3>
      <div class="task-input-wrap">
        <input type="text" id="taskInput" class="task-input" placeholder="输入任务后点+或回车..." />
        <button class="add-btn" id="addTaskBtn">+</button>
      </div>
    </div>
    <div class="card">
      <h3 class="card-title"><span class="emoji">📋</span>今日任务 (${done}/${total})</h3>
      <ul class="task-list" id="taskList">
        ${todayTasks.length === 0
          ? '<div class="empty-tip"><span class="emoji">🎯</span>暂无任务，开始规划你的一天吧！</div>'
          : todayTasks.map(t => `
            <li class="task-item ${t.done?'done':''}" data-id="${t.id}">
              <div class="task-check ${t.done?'checked':''}" onclick="toggleTask('${t.id}')"></div>
              <div class="task-text">${escapeHtml(t.text)}</div>
              <button class="task-delete" onclick="deleteTask('${t.id}')">✕</button>
            </li>
          `).join('')
        }
      </ul>
    </div>
  `;

  const input = $('#taskInput');
  $('#addTaskBtn').addEventListener('click', addTask);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
}

function addTask() {
  const input = $('#taskInput');
  const text = input.value.trim();
  if (!text) { toast('请输入任务内容'); return; }
  const tasks = Store.get('tasks', []);
  tasks.push({ id: 't_' + Date.now(), text, done: false, date: todayStr(), createdAt: Date.now() });
  Store.set('tasks', tasks);
  input.value = '';
  renderDaily();
  toast('任务已添加 ✓');
}

function toggleTask(id) {
  const tasks = Store.get('tasks', []);
  const t = tasks.find(x => x.id === id);
  if (t) {
    t.done = !t.done;
    Store.set('tasks', tasks);
    renderDaily();
    if (t.done) toast('完成一项，真棒！🎉');
  }
}

function deleteTask(id) {
  let tasks = Store.get('tasks', []);
  tasks = tasks.filter(x => x.id !== id);
  Store.set('tasks', tasks);
  renderDaily();
  toast('已删除');
}

const DEFAULT_REMINDER_TIME = '21:00';

function renderLog() {
  const today = todayStr();
  const logs = Store.get('logs', []);
  const todayLog = logs.find(l => l.date === today);
  const content = todayLog ? todayLog.content : '';
  const streak = calcLogStreak(logs);
  const totalLogs = logs.length;
  const reminder = Store.get('log_reminder', { enabled: true, time: DEFAULT_REMINDER_TIME });
  const writtenToday = !!todayLog && content.length > 0;

  const history = logs.filter(l => l.date !== today).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10);

  $('#content').innerHTML = `
    <div class="card ${writtenToday ? 'reminder-done' : 'reminder-pending'}">
      <div class="reminder-banner">
        <div class="reminder-icon">${writtenToday ? '✅' : '⏰'}</div>
        <div class="reminder-info">
          <div class="reminder-title">${writtenToday ? '今日日志已完成' : '今日日志待填写'}</div>
          <div class="reminder-subtitle">${writtenToday ? '继续保持，已连续打卡 '+streak+' 天 🔥' : '今天还没写日志，点下方开始记录'}</div>
        </div>
      </div>
    </div>
    <div class="task-stats">
      <div class="stat-box"><div class="stat-num">${streak}</div><div class="stat-label">连续打卡</div></div>
      <div class="stat-box"><div class="stat-num">${totalLogs}</div><div class="stat-label">累计日志</div></div>
      <div class="stat-box"><div class="stat-num">${writtenToday ? '1' : '0'}</div><div class="stat-label">今日</div></div>
    </div>
    <div class="card deepseek-card">
      <div class="deepseek-banner">
        <div class="deepseek-logo">🤖</div>
        <div class="deepseek-info">
          <div class="deepseek-title">打开 DeepSeek 写日志</div>
          <div class="deepseek-subtitle">点击一键跳转到 DeepSeek 写工作日志</div>
        </div>
        <button class="deepseek-btn" id="openDeepSeekBtn">前往<br>DeepSeek</button>
      </div>
      <div class="deepseek-setting">
        <button class="deepseek-toggle" id="deepseekSettingToggle">⚙️ 自定义跳转地址</button>
        <div class="deepseek-setting-panel" id="deepseekSettingPanel" style="display:none;">
          <input type="text" id="deepseekUrl" class="time-input" value="${Store.get('deepseek_url', 'https://chat.deepseek.com/share/rvqstjfc3ypjkcgy2i')}" />
          <div class="reminder-hint">点击按钮会直接跳转到 DeepSeek 网页版</div>
          <button class="log-save-btn ghost-btn" id="saveDeepSeekUrl" style="margin-top:8px;">保存地址</button>
        </div>
      </div>
    </div>
    <div class="card">
      <h3 class="card-title"><span class="emoji">🔔</span>每日提醒设置</h3>
      <div class="reminder-setting">
        <label class="switch-wrap">
          <span>开启每日提醒</span>
          <span class="switch ${reminder.enabled ? 'on' : ''}" id="reminderSwitch"></span>
        </label>
        <div class="time-setting" style="${reminder.enabled ? '' : 'opacity:0.4;pointer-events:none;'}">
          <label class="time-label">⏰ 提醒时间</label>
          <input type="time" id="reminderTime" class="time-input" value="${reminder.time}" />
          <div class="reminder-hint">每天 ${reminder.time} 若未写日志，将自动弹出提醒</div>
        </div>
        <button class="log-save-btn ghost-btn" id="testReminderBtn">🔔 测试提醒</button>
      </div>
    </div>
    <div class="card">
      <h3 class="card-title"><span class="emoji">📝</span>今日工作日志 · ${today}</h3>
      <textarea id="logArea" class="log-textarea" placeholder="今天做了什么？遇到什么问题？有什么收获？

建议结构：
1. 今日完成事项
2. 进行中事项
3. 遇到的问题
4. 明日计划"></textarea>
      <button class="log-save-btn" id="logSaveBtn">💾 保存日志</button>
    </div>
    <div class="card">
      <h3 class="card-title"><span class="emoji">📚</span>历史日志</h3>
      ${history.length === 0
        ? '<div class="empty-tip"><span class="emoji">📖</span>暂无历史日志</div>'
        : history.map(l => `<div class="log-history-item"><div class="log-history-date">📅 ${l.date}</div><div class="log-history-content">${escapeHtml(l.content)}</div></div>`).join('')
      }
    </div>
  `;

  $('#logArea').value = content;
  $('#logSaveBtn').addEventListener('click', saveLog);
  $('#openDeepSeekBtn').addEventListener('click', openDeepSeek);
  $('#deepseekSettingToggle').addEventListener('click', () => {
    const panel = $('#deepseekSettingPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  $('#saveDeepSeekUrl').addEventListener('click', () => {
    const url = $('#deepseekUrl').value.trim();
    Store.set('deepseek_url', url || 'https://chat.deepseek.com/share/rvqstjfc3ypjkcgy2i');
    toast('跳转地址已保存');
    $('#deepseekSettingPanel').style.display = 'none';
  });
  $('#reminderSwitch').addEventListener('click', () => {
    reminder.enabled = !reminder.enabled;
    Store.set('log_reminder', reminder);
    renderLog();
    toast(reminder.enabled ? '提醒已开启 🔔' : '提醒已关闭');
  });
  $('#reminderTime').addEventListener('change', (e) => {
    reminder.time = e.target.value;
    Store.set('log_reminder', reminder);
    Store.set('log_last_notified', '');
    toast('提醒时间已设为 ' + reminder.time);
  });
  $('#testReminderBtn').addEventListener('click', () => { showLogReminder(true); });
}

function calcLogStreak(logs) {
  if (!logs.length) return 0;
  const dates = new Set(logs.map(l => l.date));
  let streak = 0;
  const d = new Date();
  const today = todayStr();
  if (!dates.has(today)) d.setDate(d.getDate() - 1);
  while (true) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (dates.has(ds)) { streak++; d.setDate(d.getDate() - 1); } else break;
  }
  return streak;
}

function saveLog() {
  const content = $('#logArea').value.trim();
  if (!content) { toast('日志内容不能为空'); return; }
  const today = todayStr();
  const logs = Store.get('logs', []);
  const idx = logs.findIndex(l => l.date === today);
  if (idx >= 0) { logs[idx].content = content; logs[idx].updatedAt = Date.now(); }
  else { logs.push({ id: 'l_' + Date.now(), date: today, content, createdAt: Date.now() }); }
  Store.set('logs', logs);
  toast('日志已保存，打卡成功！🎉');
  renderLog();
}

function openDeepSeek() {
  const url = Store.get('deepseek_url', 'https://chat.deepseek.com/share/rvqstjfc3ypjkcgy2i');
  toast('正在打开 DeepSeek...');
  window.location.href = url;
}

function showLogReminder(isTest = false) {
  const today = todayStr();
  const logs = Store.get('logs', []);
  const todayLog = logs.find(l => l.date === today);
  if (!isTest && todayLog && todayLog.content.trim()) return;
  const reminder = Store.get('log_reminder', { enabled: true, time: DEFAULT_REMINDER_TIME });
  if (!isTest && !reminder.enabled) return;
  if (!isTest) {
    const lastNotified = Store.get('log_last_notified', '');
    if (lastNotified === today) return;
    Store.set('log_last_notified', today);
  }
  const msg = isTest ? '🔔 测试提醒：该写今日工作日志了！' : `⏰ ${reminder.time} 提醒：今天还没写工作日志，花 5 分钟记录一下吧！`;
  showReminderModal(msg);
}

function showReminderModal(msg) {
  const old = $('#reminderModal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'reminderModal';
  modal.className = 'reminder-modal';
  modal.innerHTML = `
    <div class="reminder-modal-mask"></div>
    <div class="reminder-modal-box">
      <div class="reminder-modal-icon">📝</div>
      <div class="reminder-modal-title">每日工作日志提醒</div>
      <div class="reminder-modal-text">${msg}</div>
      <div class="reminder-modal-actions">
        <button class="reminder-btn-primary deepseek-modal-btn" id="reminderGoBtn">🤖 立即去写</button>
        <button class="reminder-btn-ghost" id="reminderLaterBtn">稍后提醒</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  $('#reminderGoBtn').addEventListener('click', () => { modal.remove(); openDeepSeek(); });
  $('#reminderLaterBtn').addEventListener('click', () => {
    modal.remove();
    setTimeout(() => showLogReminder(true), 10 * 60 * 1000);
  });
}

function startReminderChecker() {
  setInterval(() => { checkReminder(); }, 60 * 1000);
  setTimeout(checkReminder, 2000);
}

function checkReminder() {
  const reminder = Store.get('log_reminder', { enabled: true, time: DEFAULT_REMINDER_TIME });
  if (!reminder.enabled) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const nowTime = `${hh}:${mm}`;
  if (nowTime >= reminder.time) showLogReminder(false);
}

function renderTravel() {
  const plans = Store.get('travel', []).sort((a,b) => b.createdAt - a.createdAt);
  $('#content').innerHTML = `
    <div class="card">
      <h3 class="card-title"><span class="emoji">✈️</span>添加旅行计划</h3>
      <div class="travel-input-group"><input type="text" id="travelInput" class="travel-input" placeholder="目的地，如：日本京都" /></div>
      <div class="travel-input-group"><input type="date" id="travelDate" class="travel-input" /></div>
      <div class="travel-input-group"><input type="text" id="travelNote" class="travel-input" placeholder="备注：必去景点/预算/天数等" /></div>
      <button class="log-save-btn" id="travelAddBtn">📌 添加计划</button>
    </div>
    <div class="card">
      <h3 class="card-title"><span class="emoji">🗺️</span>我的旅行清单</h3>
      ${plans.length === 0
        ? '<div class="empty-tip"><span class="emoji">🌍</span>还没有旅行计划，添加一个吧！</div>'
        : plans.map(p => `
          <div class="travel-card">
            <div class="travel-card-header">
              <div class="travel-card-title">📍 ${escapeHtml(p.dest)}</div>
              <div class="travel-card-date">${p.date || '未定日期'}</div>
            </div>
            <div class="travel-card-content">${escapeHtml(p.note || '暂无备注')}</div>
            <div class="travel-card-actions">
              <button onclick="toggleTravelDone('${p.id}')">${p.done ? '↩️ 取消完成' : '✅ 标记完成'}</button>
              <button class="delete-btn" onclick="deleteTravel('${p.id}')">🗑 删除</button>
            </div>
          </div>
        `).join('')
      }
    </div>
    <div class="card">
      <h3 class="card-title"><span class="emoji">💡</span>旅行小贴士</h3>
      <div style="font-size:13px;color:var(--text-secondary);line-height:1.8;">
        • 提前 1 个月订机票酒店更便宜<br>• 重要证件拍照存云端备用<br>• 下载离线地图应对无网络<br>• 兑换少量当地货币应急<br>• 购买旅行保险更安心
      </div>
    </div>
  `;
  $('#travelAddBtn').addEventListener('click', addTravel);
}

function addTravel() {
  const dest = $('#travelInput').value.trim();
  if (!dest) { toast('请输入目的地'); return; }
  const plans = Store.get('travel', []);
  plans.push({ id: 'tr_' + Date.now(), dest, date: $('#travelDate').value, note: $('#travelNote').value.trim(), done: false, createdAt: Date.now() });
  Store.set('travel', plans);
  renderTravel();
  toast('旅行计划已添加 🗺️');
}

function toggleTravelDone(id) {
  const plans = Store.get('travel', []);
  const p = plans.find(x => x.id === id);
  if (p) { p.done = !p.done; Store.set('travel', plans); renderTravel(); }
}

function deleteTravel(id) {
  let plans = Store.get('travel', []);
  plans = plans.filter(x => x.id !== id);
  Store.set('travel', plans);
  renderTravel();
  toast('已删除');
}

let reviewMode = 'daily';

function renderReview() {
  const today = todayStr();
  const questions = reviewMode === 'daily' ? DAILY_REVIEW_QUESTIONS : WEEKLY_REVIEW_QUESTIONS;
  const key = reviewMode === 'daily' ? 'review_daily' : 'review_weekly';
  const saved = Store.get(key, []);
  const todayReview = saved.find(r => r.date === today);

  $('#content').innerHTML = `
    <div class="review-tabs">
      <button class="review-tab ${reviewMode==='daily'?'active':''}" onclick="switchReview('daily')">📅 每日复盘</button>
      <button class="review-tab ${reviewMode==='weekly'?'active':''}" onclick="switchReview('weekly')">📆 每周复盘</button>
    </div>
    <div class="card">
      <h3 class="card-title"><span class="emoji">🔄</span>${reviewMode==='daily'?'今日':'本周'}复盘 · ${today}</h3>
      ${questions.map((q, i) => `
        <div class="review-question">
          <div class="review-q-title">${q.icon} ${q.title}</div>
          <textarea class="review-q-input" data-idx="${i}" placeholder="${q.placeholder}">${todayReview ? escapeHtml(todayReview.answers[i] || '') : ''}</textarea>
        </div>
      `).join('')}
      <button class="log-save-btn" id="reviewSaveBtn">💾 保存复盘</button>
    </div>
    <div class="card">
      <h3 class="card-title"><span class="emoji">📖</span>历史复盘</h3>
      ${saved.filter(r => r.date !== today).length === 0
        ? '<div class="empty-tip"><span class="emoji">💭</span>暂无历史复盘记录</div>'
        : saved.filter(r => r.date !== today).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(r => `
          <div class="log-history-item">
            <div class="log-history-date">📅 ${r.date}</div>
            ${r.answers.map((a, i) => a ? `<div style="margin-bottom:6px;"><b style="color:var(--text);font-size:12px;">${questions[i].icon} ${questions[i].title}：</b><br><span style="font-size:12px;">${escapeHtml(a)}</span></div>` : '').join('')}
          </div>
        `).join('')
      }
    </div>
  `;
  $('#reviewSaveBtn').addEventListener('click', saveReview);
}

function switchReview(mode) { reviewMode = mode; renderReview(); }

function saveReview() {
  const today = todayStr();
  const key = reviewMode === 'daily' ? 'review_daily' : 'review_weekly';
  const saved = Store.get(key, []);
  const answers = [];
  $$('.review-q-input').forEach((el, i) => { answers[i] = el.value.trim(); });
  if (answers.every(a => !a)) { toast('请至少填写一项'); return; }
  const idx = saved.findIndex(r => r.date === today);
  if (idx >= 0) saved[idx].answers = answers;
  else saved.push({ id: 'r_' + Date.now(), date: today, answers });
  Store.set(key, saved);
  toast('复盘已保存 💾');
}

const DAILY_REVIEW_QUESTIONS = [
  { icon: '✅', title: '今日完成了什么？', placeholder: '列出今天完成的重要事项...' },
  { icon: '⚡', title: '哪些事做得好？', placeholder: '记录做得好的地方和原因...' },
  { icon: '🐛', title: '遇到什么问题？', placeholder: '遇到的问题和障碍...' },
  { icon: '💡', title: '学到了什么？', placeholder: '今天的收获和感悟...' },
  { icon: '🎯', title: '明天要做什么？', placeholder: '明天的重点任务...' },
];

const WEEKLY_REVIEW_QUESTIONS = [
  { icon: '📊', title: '本周目标完成情况？', placeholder: '回顾本周目标达成度...' },
  { icon: '🌟', title: '本周高光时刻？', placeholder: '本周最有成就感的事...' },
  { icon: '🤔', title: '本周有哪些不足？', placeholder: '需要改进的地方...' },
  { icon: '📈', title: '本周成长了什么？', placeholder: '技能/认知上的提升...' },
  { icon: '🚀', title: '下周重点计划？', placeholder: '下周要聚焦的事情...' },
];

let engMode = 'listen';

function renderEnglish() {
  $('#content').innerHTML = `
    <div class="eng-tabs">
      <button class="eng-tab ${engMode==='listen'?'active':''}" onclick="switchEng('listen')">👂 听力</button>
      <button class="eng-tab ${engMode==='speak'?'active':''}" onclick="switchEng('speak')">🗣️ 口语</button>
      <button class="eng-tab ${engMode==='read'?'active':''}" onclick="switchEng('read')">📖 阅读</button>
    </div>
    <div id="engContent"></div>
  `;
  renderEngContent();
}

function switchEng(mode) {
  engMode = mode;
  $$('.eng-tab').forEach(b => b.classList.remove('active'));
  const idx = mode === 'listen' ? 0 : mode === 'speak' ? 1 : 2;
  $$('.eng-tab')[idx].classList.add('active');
  renderEngContent();
}

function renderEngContent() {
  const data = engMode === 'listen' ? LISTENING_LESSONS : engMode === 'speak' ? SPEAKING_LESSONS : READING_LESSONS;
  const container = $('#engContent');
  container.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;">
      <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${engMode==='listen'?'👂 听力训练':engMode==='speak'?'🗣️ 口语训练':'📖 阅读训练'}</div>
      <div style="font-size:12px;opacity:0.9;line-height:1.5;">${engMode==='listen'?'先听不看字幕，听不懂再看原文，跟读模仿语调。':engMode==='speak'?'大声朗读，注意连读和重音，反复练习直到流畅。':'先通读理解大意，再细读查生词，最后复述内容。'}</div>
    </div>
    ${data.map((lesson, i) => `
      <div class="eng-lesson">
        <div class="eng-lesson-header">
          <div class="eng-lesson-title">第 ${i+1} 课 · ${lesson.title}</div>
          <span class="eng-lesson-level level-${lesson.level}">${lesson.levelText}</span>
        </div>
        ${lesson.sentences.map(s => `
          <div class="eng-sentence">${s.en}</div>
          <div class="eng-translation">${s.zh}</div>
          ${s.key ? `<div class="eng-key">${s.key}</div>` : ''}
          <button class="play-btn" onclick="speak('${s.en.replace(/'/g,"\\'")}')">🔊 朗读</button>
          ${s.tip ? `<div class="eng-tip">💡 ${s.tip}</div>` : ''}
          <hr style="border:none;border-top:1px dashed var(--border);margin:12px 0 8px;">
        `).join('')}
      </div>
    `).join('')}
    <div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:12px;">每天坚持 15 分钟，30 天看到明显进步 💪</div>
  `;
}

const LISTENING_LESSONS = [
  { title: '日常问候', level: 'easy', levelText: '入门', sentences: [
    { en: "How's it going?", zh: "最近怎么样？", key: "<b>How's it going?</b> 是比 How are you? 更口语化的问候。", tip: "going 的 g 弱读" },
    { en: "What have you been up to?", zh: "你最近在忙什么？", key: "<b>be up to</b> 表示「正在做某事」。", tip: "连读 what-have-you 听起来像 'whachya'" },
    { en: "Long time no see! How have you been?", zh: "好久不见！你过得怎么样？", key: "<b>Long time no see</b> 已广泛使用的地道表达。", tip: "注意 How have you been 问一段时间" },
    { en: "It's been a while. What's new?", zh: "好久不见了。有什么新鲜事？", key: "<b>What's new?</b> 询问对方最近动态。", tip: "连读成 'Wha-s-new'" }
  ]},
  { title: '餐厅点餐', level: 'mid', levelText: '进阶', sentences: [
    { en: "I'd like to make a reservation for two.", zh: "我想预订两人位。", key: "<b>I'd like to</b> 礼貌请求句型。", tip: "连读成 'I-like-ta'" },
    { en: "Could I see the menu, please?", zh: "请给我看一下菜单好吗？", key: "<b>Could I...</b> 委婉请求句型。", tip: "比 Can I 更礼貌" },
    { en: "What do you recommend?", zh: "你有什么推荐的？", key: "<b>recommend</b> 推荐。", tip: "重音在第二音节" },
    { en: "I'll have the steak, medium rare please.", zh: "我要一份牛排，三分熟。", key: "<b>medium rare</b> 三分熟，<b>well done</b> 全熟。", tip: "rare → medium rare → medium → well done" },
    { en: "Check, please.", zh: "买单。", key: "<b>Check, please</b> 美式用法。", tip: "简化表达" }
  ]},
  { title: '职场沟通', level: 'hard', levelText: '高级', sentences: [
    { en: "Let's circle back to this after the meeting.", zh: "我们会后回头再讨论。", key: "<b>circle back</b> 稍后再回到某话题。", tip: "职场高频短语" },
    { en: "I think we're on the same page.", zh: "我认为我们达成共识了。", key: "<b>on the same page</b> 意见一致。", tip: "确认双方理解一致" },
    { en: "Could you walk me through the proposal?", zh: "你能给我讲解一下这个方案吗？", key: "<b>walk someone through</b> 逐步讲解。", tip: "比 explain 更形象" },
    { en: "Let's table this for now and revisit it next week.", zh: "我们暂时搁置，下周再讨论。", key: "<b>table</b> 暂缓；<b>revisit</b> 重新讨论。", tip: "美式 table=搁置" }
  ]}
];

const SPEAKING_LESSONS = [
  { title: '自我介绍', level: 'easy', levelText: '入门', sentences: [
    { en: "Hi, I'm [name]. Nice to meet you!", zh: "嗨，我是[名字]。很高兴认识你！", key: "<b>Nice to meet you</b> 初次见面标准问候。", tip: "面带微笑，语气热情" },
    { en: "I'm from [city]. I work as a [job].", zh: "我来自[城市]，我的职业是[工作]。", key: "<b>work as</b> 担任...工作。", tip: "比 I'm a 更自然" },
    { en: "In my free time, I enjoy reading and traveling.", zh: "业余时间我喜欢阅读和旅行。", key: "<b>enjoy doing</b> 喜欢做某事。", tip: "enjoy 后接动名词" },
    { en: "I'm passionate about photography and learning new things.", zh: "我对摄影和学习新事物充满热情。", key: "<b>be passionate about</b> 对...有热情。", tip: "高级表达" }
  ]},
  { title: '表达观点', level: 'mid', levelText: '进阶', sentences: [
    { en: "In my opinion, we should focus on quality over quantity.", zh: "在我看来，我们应该重质量胜过数量。", key: "<b>quality over quantity</b> 质量优先。", tip: "标准开场" },
    { en: "I see what you mean, but I have a different take on this.", zh: "我明白你的意思，但我有不同的看法。", key: "<b>take</b> 名词，看法。", tip: "委婉表达不同意见" },
    { en: "That's a good point. However, we also need to consider the cost.", zh: "说得有道理。不过我们也要考虑成本。", key: "<b>However</b> 转折。", tip: "先肯定后转折" },
    { en: "I'm of the opinion that we should take a different approach.", zh: "我认为我们应该采取不同的方法。", key: "<b>be of the opinion that</b> 较正式。", tip: "适合商务场合" }
  ]},
  { title: '日常对话', level: 'mid', levelText: '进阶', sentences: [
    { en: "Sounds like a plan! Let's do it.", zh: "听起来不错！就这么办。", key: "<b>Sounds like a plan</b> 同意。", tip: "日常高频" },
    { en: "To be honest, I'm not really sure about that.", zh: "说实话，我不太确定。", key: "<b>To be honest</b> 诚实说。", tip: "委婉表达不确定" },
    { en: "It depends. Let me think about it and get back to you.", zh: "看情况。让我想想再回复你。", key: "<b>get back to you</b> 回头答复。", tip: "不立刻决定的标准回答" },
    { en: "No worries! I totally get it.", zh: "没关系！我完全理解。", key: "<b>No worries</b> 没关系。", tip: "轻松场合万能句" }
  ]},
  { title: '商务谈判', level: 'hard', levelText: '高级', sentences: [
    { en: "We're willing to negotiate, but we have our limits.", zh: "我们愿意协商，但有底线。", key: "<b>have our limits</b> 有底线。", tip: "表明立场" },
    { en: "Let's find a middle ground that works for both of us.", zh: "我们找个双方都能接受的折中方案。", key: "<b>middle ground</b> 折中方案。", tip: "促成双赢" },
    { en: "I appreciate your offer, but it's a bit beyond our budget.", zh: "感谢你的报价，但有点超出预算。", key: "<b>beyond our budget</b> 超出预算。", tip: "委婉拒绝" },
    { en: "Can we sleep on it and give you an answer tomorrow?", zh: "我们能考虑一晚，明天给你答复吗？", key: "<b>sleep on it</b> 考虑一晚。", tip: "争取思考时间" }
  ]}
];

const READING_LESSONS = [
  { title: '短篇故事', level: 'easy', levelText: '入门', sentences: [
    { en: "Every morning, Emma walks to the park near her house. She loves the fresh air and the singing of birds.", zh: "每天早上，艾玛走到家附近的公园。她喜欢新鲜空气和鸟儿的歌声。", key: "<b>singing of birds</b> 鸟鸣。", tip: "通读理解 → 跟读 → 复述" },
    { en: "The old man sat on the bench, watching children play. He smiled, remembering his own childhood.", zh: "老人坐在长椅上，看着孩子们玩耍。他微笑着，回忆起自己的童年。", key: "<b>remembering</b> 现在分词作伴随状语。", tip: "注意时态连贯" }
  ]},
  { title: '新闻片段', level: 'mid', levelText: '进阶', sentences: [
    { en: "A recent study shows that people who read regularly tend to have better memory and sharper thinking skills as they age.", zh: "最近一项研究表明，经常阅读的人随着年龄增长，往往有更好的记忆力和更敏锐的思维。", key: "<b>tend to</b> 倾向于；<b>as they age</b> 随年龄增长。", tip: "先抓主干：study shows that..." },
    { en: "The company announced a new policy allowing employees to work remotely up to three days a week.", zh: "公司宣布了一项新政策，允许员工每周最多远程工作三天。", key: "<b>allowing</b> 现在分词修饰 policy。", tip: "长句拆分理解" }
  ]},
  { title: 'TED 演讲节选', level: 'hard', levelText: '高级', sentences: [
    { en: "Success is not final, failure is not fatal: it is the courage to continue that counts.", zh: "成功不是终点，失败也不是末日：重要的是继续前行的勇气。", key: "<b>it is...that counts</b> 强调句型。", tip: "注意强调结构" },
    { en: "The greatest discovery of my generation is that human beings can alter their lives by altering their attitudes of mind.", zh: "我们这一代最伟大的发现是：人类可以通过改变心态来改变生活。", key: "<b>by altering</b> 通过改变。", tip: "威廉·詹姆斯名言" },
    { en: "In the middle of difficulty lies opportunity.", zh: "困难之中蕴藏着机遇。", key: "<b>lies</b> 蕴藏（倒装句）。", tip: "爱因斯坦名言" }
  ]}
];

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, ''');
}

function init() {
  const d = new Date();
  $('#todayDate').textContent = formatDate(d);
  initNav();
  switchPage('daily');
  startReminderChecker();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminder(); });
}

document.addEventListener('DOMContentLoaded', init);
