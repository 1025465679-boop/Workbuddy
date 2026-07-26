/* ============================================================
   WorkBuddy 手机工作台 - 核心逻辑
   ============================================================ */

// ============ 数据存储 ============
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

// ============ 工具函数 ============
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

// 语音朗读（英语口语用）
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

// ============ 页面配置 ============
const PAGES = {
  daily:   { title: '每日计划',     render: renderDaily,   showFab: true  },
  log:     { title: '每日工作日志提醒', render: renderLog,     showFab: false },
  review:  { title: '每日/周复盘',  render: renderReview,  showFab: false },
  english: { title: '英语口语学习', render: renderEnglish, showFab: false },
  account: { title: '记账本',       render: renderAccount, showFab: true  },
};

let currentPage = 'daily';

// ============ 导航 ============
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
    } else if (currentPage === 'account') {
      const input = $('#expenseAmount');
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

// ============ 1. 每日计划 ============
function renderDaily() {
  const tasks = Store.get('tasks', []);
  const today = todayStr();
  const todayTasks = tasks.filter(t => t.date === today);
  const done = todayTasks.filter(t => t.done).length;
  const total = todayTasks.length;
  const percent = total ? Math.round(done/total*100) : 0;

  $('#content').innerHTML = `
    <div class="task-stats">
      <div class="stat-box">
        <div class="stat-num">${done}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${total-done}</div>
        <div class="stat-label">待办</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${percent}%</div>
        <div class="stat-label">完成率</div>
      </div>
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
  tasks.push({
    id: 't_' + Date.now(),
    text,
    done: false,
    date: todayStr(),
    createdAt: Date.now()
  });
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

// ============ 2. 每日工作日志提醒 ============
const DEFAULT_REMINDER_TIME = '21:00'; // 默认提醒时间

function renderLog() {
  const today = todayStr();
  const logs = Store.get('logs', []);
  const todayLog = logs.find(l => l.date === today);
  const content = todayLog ? todayLog.content : '';

  // 连续打卡天数计算
  const streak = calcLogStreak(logs);
  const totalLogs = logs.length;

  // 提醒设置
  const reminder = Store.get('log_reminder', { enabled: true, time: DEFAULT_REMINDER_TIME });
  const lastNotified = Store.get('log_last_notified', '');

  // 今日是否已写
  const writtenToday = !!todayLog && content.length > 0;

  const history = logs
    .filter(l => l.date !== today)
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  $('#content').innerHTML = `
    <!-- 提醒状态卡片 -->
    <div class="card ${writtenToday ? 'reminder-done' : 'reminder-pending'}">
      <div class="reminder-banner">
        <div class="reminder-icon">${writtenToday ? '✅' : '⏰'}</div>
        <div class="reminder-info">
          <div class="reminder-title">${writtenToday ? '今日日志已完成' : '今日日志待填写'}</div>
          <div class="reminder-subtitle">${writtenToday ? '继续保持，已连续打卡 '+streak+' 天 🔥' : '今天还没写日志，点下方开始记录'}</div>
        </div>
      </div>
    </div>

    <!-- 打卡统计 -->
    <div class="task-stats">
      <div class="stat-box">
        <div class="stat-num">${streak}</div>
        <div class="stat-label">连续打卡</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${totalLogs}</div>
        <div class="stat-label">累计日志</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${writtenToday ? '1' : '0'}</div>
        <div class="stat-label">今日</div>
      </div>
    </div>

    <!-- 一键打开 DeepSeek -->
    <div class="card deepseek-card">
      <div class="deepseek-banner">
        <div class="deepseek-logo">🤖</div>
        <div class="deepseek-info">
          <div class="deepseek-title">打开 DeepSeek 写日志</div>
          <div class="deepseek-subtitle">点击一键跳转到 DeepSeek APP 写工作日志</div>
        </div>
        <button class="deepseek-btn" id="openDeepSeekBtn">前往<br>DeepSeek</button>
      </div>
      <div class="deepseek-setting">
        <button class="deepseek-toggle" id="deepseekSettingToggle">⚙️ 自定义跳转地址</button>
        <div class="deepseek-setting-panel" id="deepseekSettingPanel" style="display:none;">
          <input type="text" id="deepseekUrl" class="time-input" placeholder="DeepSeek 链接" value="${Store.get('deepseek_url', 'https://chat.deepseek.com/share/rvqstjfc3ypjkcgy2i')}" />
          <div class="reminder-hint">点击按钮会直接跳转到 DeepSeek 网页版，如已装 APP 会提示打开</div>
          <button class="log-save-btn ghost-btn" id="saveDeepSeekUrl" style="margin-top:8px;">保存地址</button>
        </div>
      </div>
    </div>

    <!-- 提醒设置 -->
    <div class="card">
      <h3 class="card-title"><span class="emoji">🔔</span>每日提醒设置</h3>
      <div class="reminder-setting">
        <label class="switch-wrap">
          <span>开启每日提醒</span>
          <span class="switch ${reminder.enabled ? 'on' : ''}" id="reminderSwitch"></span>
        </label>
        <div class="time-setting" id="timeSetting" style="${reminder.enabled ? '' : 'opacity:0.4;pointer-events:none;'}">
          <label class="time-label">⏰ 提醒时间</label>
          <input type="time" id="reminderTime" class="time-input" value="${reminder.time}" />
          <div class="reminder-hint">每天 ${reminder.time} 若未写日志，将自动弹出提醒</div>
        </div>
        <button class="log-save-btn ghost-btn" id="testReminderBtn">🔔 测试提醒</button>
      </div>
    </div>

    <!-- 日志编辑 -->
    <div class="card">
      <h3 class="card-title"><span class="emoji">📝</span>今日工作日志 · ${today}</h3>
      <textarea id="logArea" class="log-textarea" placeholder="今天做了什么？遇到什么问题？有什么收获？&#10;&#10;建议结构：&#10;1. 今日完成事项&#10;2. 进行中事项&#10;3. 遇到的问题&#10;4. 明日计划"></textarea>
      <button class="log-save-btn" id="logSaveBtn">💾 保存日志</button>
    </div>

    <!-- 历史日志 -->
    <div class="card">
      <h3 class="card-title"><span class="emoji">📚</span>历史日志</h3>
      ${history.length === 0
        ? '<div class="empty-tip"><span class="emoji">📖</span>暂无历史日志</div>'
        : history.map(l => `
          <div class="log-history-item">
            <div class="log-history-date">📅 ${l.date}</div>
            <div class="log-history-content">${escapeHtml(l.content)}</div>
          </div>
        `).join('')
      }
    </div>
  `;

  $('#logArea').value = content;
  $('#logSaveBtn').addEventListener('click', saveLog);

  // 打开 DeepSeek
  $('#openDeepSeekBtn').addEventListener('click', openDeepSeek);

  // 展开自定义地址设置
  $('#deepseekSettingToggle').addEventListener('click', () => {
    const panel = $('#deepseekSettingPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  // 保存自定义地址
  $('#saveDeepSeekUrl').addEventListener('click', () => {
    const url = $('#deepseekUrl').value.trim();
    Store.set('deepseek_url', url || 'deepseek://');
    toast('跳转地址已保存');
    $('#deepseekSettingPanel').style.display = 'none';
  });

  // 提醒开关
  $('#reminderSwitch').addEventListener('click', () => {
    reminder.enabled = !reminder.enabled;
    Store.set('log_reminder', reminder);
    renderLog();
    toast(reminder.enabled ? '提醒已开启 🔔' : '提醒已关闭');
  });

  // 时间修改
  $('#reminderTime').addEventListener('change', (e) => {
    reminder.time = e.target.value;
    Store.set('log_reminder', reminder);
    Store.set('log_last_notified', ''); // 重置通知状态
    toast('提醒时间已设为 ' + reminder.time);
  });

  // 测试提醒
  $('#testReminderBtn').addEventListener('click', () => {
    showLogReminder(true);
  });
}

// 打开学习通 APP
function openChaoxing() {
  const url = Store.get('chaoxing_url', 'chaoxing://');
  toast('正在唤醒学习通 APP...');
  // 通过隐藏 iframe 尝试唤起 APP（兼容 iOS Safari 和安卓）
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    // 1.5 秒后移除 iframe，并检测是否唤起成功
    setTimeout(() => {
      document.body.removeChild(iframe);
      // 如果用户还在当前页面，说明未成功唤起，提示手动打开
      if (!document.hidden) {
        showChaoxingFallback(url);
      }
    }, 1500);
  } catch (e) {
    // 直接 location 跳转兜底
    window.location.href = url;
    setTimeout(() => {
      if (!document.hidden) showChaoxingFallback(url);
    }, 1500);
  }
}

// 唤起失败的提示弹窗
function showChaoxingFallback(url) {
  const old = $('#chaoxingFallback');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'chaoxingFallback';
  modal.className = 'reminder-modal';
  modal.innerHTML = `
    <div class="reminder-modal-mask"></div>
    <div class="reminder-modal-box">
      <div class="reminder-modal-icon">📱</div>
      <div class="reminder-modal-title">未能自动打开学习通</div>
      <div class="reminder-modal-text">可能是手机里尚未安装学习通，或浏览器拦截了跳转。<br>请手动打开学习通 APP，或检查下方地址是否正确。</div>
      <div class="chaoxing-fallback-url">当前地址：<code>${escapeHtml(url)}</code></div>
      <div class="reminder-modal-actions">
        <button class="reminder-btn-primary" id="chaoxingRetryBtn">🔁 重新尝试</button>
        <button class="reminder-btn-ghost" id="chaoxingCloseBtn">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  $('#chaoxingRetryBtn').addEventListener('click', () => {
    modal.remove();
    openChaoxing();
  });
  $('#chaoxingCloseBtn').addEventListener('click', () => modal.remove());
}

// 打开 DeepSeek APP
function openDeepSeek() {
  const url = Store.get('deepseek_url', 'https://chat.deepseek.com/share/rvqstjfc3ypjkcgy2i');
  toast('正在打开 DeepSeek...');
  // 直接用 location 跳转（网页链接兼容性最好）
  window.location.href = url;
}

// 计算连续打卡天数
function calcLogStreak(logs) {
  if (!logs.length) return 0;
  const dates = new Set(logs.map(l => l.date));
  let streak = 0;
  const d = new Date();
  // 如果今天没写，从昨天开始算
  const today = todayStr();
  if (!dates.has(today)) {
    d.setDate(d.getDate() - 1);
  }
  while (true) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (dates.has(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// 保存日志
function saveLog() {
  const content = $('#logArea').value.trim();
  if (!content) { toast('日志内容不能为空'); return; }
  const today = todayStr();
  const logs = Store.get('logs', []);
  const idx = logs.findIndex(l => l.date === today);
  if (idx >= 0) {
    logs[idx].content = content;
    logs[idx].updatedAt = Date.now();
  } else {
    logs.push({ id: 'l_' + Date.now(), date: today, content, createdAt: Date.now() });
  }
  Store.set('logs', logs);
  toast('日志已保存，打卡成功！🎉');
  renderLog(); // 刷新统计
}

// ============ 日志提醒系统 ============
function showLogReminder(isTest = false) {
  const today = todayStr();
  const logs = Store.get('logs', []);
  const todayLog = logs.find(l => l.date === today);

  // 已写则不提醒（测试模式除外）
  if (!isTest && todayLog && todayLog.content.trim()) return;

  const reminder = Store.get('log_reminder', { enabled: true, time: DEFAULT_REMINDER_TIME });
  if (!isTest && !reminder.enabled) return;

  // 同一天只提醒一次（测试模式除外）
  if (!isTest) {
    const lastNotified = Store.get('log_last_notified', '');
    if (lastNotified === today) return;
    Store.set('log_last_notified', today);
  }

  // 弹出确认框
  const msg = isTest
    ? '🔔 测试提醒：该写今日工作日志了！'
    : `⏰ ${reminder.time} 提醒：今天还没写工作日志，花 5 分钟记录一下吧！`;

  showReminderModal(msg);
}

// 提醒弹窗
function showReminderModal(msg) {
  // 移除已存在的
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

  // "立即去写" → 跳转到 DeepSeek APP
  $('#reminderGoBtn').addEventListener('click', () => {
    modal.remove();
    openDeepSeek();
  });
  $('#reminderLaterBtn').addEventListener('click', () => {
    modal.remove();
    // 10 分钟后再提醒
    setTimeout(() => showLogReminder(true), 10 * 60 * 1000);
  });
}

// 判断是否为节假日或周末（非工作日）
// 包含 2025-2026 年国内法定节假日，周末默认不提醒
function isHolidayOrWeekend() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const wd = now.getDay(); // 0=周日, 6=周六
  const today = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  // 周末默认不提醒
  if (wd === 0 || wd === 6) {
    // 但如果周末是法定调休上班日，则要提醒
    if (!ADJUSTED_WORKDAYS.includes(today)) return true;
  }

  // 法定节假日不提醒
  if (HOLIDAYS.includes(today)) return true;

  return false;
}

// 2025-2026 国内法定节假日（日期）
const HOLIDAYS = [
  // 2025
  '2025-01-01','2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-01','2025-02-02','2025-02-03','2025-02-04',
  '2025-04-04','2025-04-05','2025-04-06',
  '2025-05-01','2025-05-02','2025-05-03','2025-05-04','2025-05-05',
  '2025-05-31','2025-06-01','2025-06-02',
  '2025-10-01','2025-10-02','2025-10-03','2025-10-04','2025-10-05','2025-10-06','2025-10-07','2025-10-08',
  // 2026
  '2026-01-01','2026-02-15','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-21','2026-02-22','2026-02-23','2026-02-24',
  '2026-04-04','2026-04-05','2026-04-06',
  '2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05',
  '2026-06-19','2026-06-20','2026-06-21',
  '2026-09-25','2026-09-26','2026-09-27',
  '2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08',
];

// 法定调休上班日（周末但要上班）
const ADJUSTED_WORKDAYS = [
  '2025-01-26','2025-02-08','2025-04-27','2025-09-28','2025-10-11',
  '2026-02-14','2026-02-28','2026-04-26','2026-09-27','2026-10-10',
];

// 定时检查提醒
function startReminderChecker() {
  // 每 60 秒检查一次
  setInterval(() => {
    checkReminder();
  }, 60 * 1000);
  // 启动时立即检查一次
  setTimeout(checkReminder, 2000);
}

function checkReminder() {
  const reminder = Store.get('log_reminder', { enabled: true, time: DEFAULT_REMINDER_TIME });
  if (!reminder.enabled) return;

  // 节假日/周末判断
  if (isHolidayOrWeekend()) return;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const nowTime = `${hh}:${mm}`;

  // 到达提醒时间或超过提醒时间（同一天内未通知过）
  if (nowTime >= reminder.time) {
    showLogReminder(false);
  }
}

// ============ 3. 每日/周复盘 ============
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

function switchReview(mode) {
  reviewMode = mode;
  renderReview();
}

function saveReview() {
  const today = todayStr();
  const key = reviewMode === 'daily' ? 'review_daily' : 'review_weekly';
  const saved = Store.get(key, []);
  const answers = [];
  $$('.review-q-input').forEach((el, i) => { answers[i] = el.value.trim(); });

  if (answers.every(a => !a)) { toast('请至少填写一项'); return; }

  const idx = saved.findIndex(r => r.date === today);
  if (idx >= 0) {
    saved[idx].answers = answers;
  } else {
    saved.push({ id: 'r_' + Date.now(), date: today, answers });
  }
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

// ============ 5. 英语口语学习 ============
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
  $$('.eng-tab').forEach(b => b.classList.toggle('active', b.textContent.includes(mode==='listen'?'听力':mode==='speak'?'口语':'阅读')));
  renderEngContent();
}

function renderEngContent() {
  const data = engMode === 'listen' ? LISTENING_LESSONS
             : engMode === 'speak'  ? SPEAKING_LESSONS
             : READING_LESSONS;
  const container = $('#engContent');

  container.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;">
      <div style="font-size:14px;font-weight:700;margin-bottom:4px;">
        ${engMode==='listen'?'👂 听力训练':engMode==='speak'?'🗣️ 口语训练':'📖 阅读训练'}
      </div>
      <div style="font-size:12px;opacity:0.9;line-height:1.5;">
        ${engMode==='listen'?'先听不看字幕，听不懂再看原文，跟读模仿语调。':engMode==='speak'?'大声朗读，注意连读和重音，反复练习直到流畅。':'先通读理解大意，再细读查生词，最后复述内容。'}
      </div>
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
    <div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:12px;">
      每天坚持 15 分钟，30 天看到明显进步 💪
    </div>
  `;
}

/* ============================================================
   英语口语学习内容
   ============================================================ */

// ============ 听力训练 ============
const LISTENING_LESSONS = [
  {
    title: '日常问候',
    level: 'easy', levelText: '入门',
    sentences: [
      {
        en: "How's it going?",
        zh: "最近怎么样？",
        key: "<b>How's it going?</b> 是比 How are you? 更口语化的问候，用于熟人之间。",
        tip: "going 的 g 弱读，听起来像 'How's it go-in'"
      },
      {
        en: "What have you been up to?",
        zh: "你最近在忙什么？",
        key: "<b>be up to</b> 表示「正在做某事」，常用来询问近况。",
        tip: "连读 what-have-you 听起来像 'whachya'"
      },
      {
        en: "Long time no see! How have you been?",
        zh: "好久不见！你过得怎么样？",
        key: "<b>Long time no see</b> 是中式英语演化成的地道表达，已广泛使用。",
        tip: "注意 How have you been 和 How are you 的区别：前者问一段时间"
      },
      {
        en: "It's been a while. What's new?",
        zh: "好久不见了。有什么新鲜事？",
        key: "<b>What's new?</b> 用于询问对方最近有没有什么新动态。",
        tip: "What's new 连读成 'Wha-s-new'"
      }
    ]
  },
  {
    title: '餐厅点餐',
    level: 'mid', levelText: '进阶',
    sentences: [
      {
        en: "I'd like to make a reservation for two.",
        zh: "我想预订两人位。",
        key: "<b>I'd like to</b> 是礼貌请求的句型，比 I want 更得体。<b>reservation</b> 预约。",
        tip: "I'd like to 连读成 'I-like-ta'"
      },
      {
        en: "Could I see the menu, please?",
        zh: "请给我看一下菜单好吗？",
        key: "<b>Could I...</b> 是委婉请求句型，比 Can I 更礼貌。",
        tip: "Could I 和 Can I 的区别：前者更正式"
      },
      {
        en: "What do you recommend?",
        zh: "你有什么推荐的？",
        key: "<b>recommend</b> 推荐，常用于询问对方建议。",
        tip: "注意 recommend 的重音在第二音节"
      },
      {
        en: "I'll have the steak, medium rare please.",
        zh: "我要一份牛排，三分熟。",
        key: "<b>I'll have...</b> 点餐常用句型。<b>medium rare</b> 三分熟，<b>medium</b> 五分熟，<b>well done</b> 全熟。",
        tip: "牛排熟度从低到高：rare → medium rare → medium → medium well → well done"
      },
      {
        en: "Check, please. / Can I get the bill?",
        zh: "买单。/ 可以给我账单吗？",
        key: "<b>Check, please</b> 美式用法；<b>bill</b> 英式用法。",
        tip: "简化表达，餐厅常用"
      }
    ]
  },
  {
    title: '职场沟通',
    level: 'hard', levelText: '高级',
    sentences: [
      {
        en: "Let's circle back to this after the meeting.",
        zh: "我们会后回头再讨论这个。",
        key: "<b>circle back</b> 职场高频短语，表示「稍后再回到某话题」。",
        tip: "职场黑话，体现专业度"
      },
      {
        en: "I think we're on the same page.",
        zh: "我认为我们达成共识了。",
        key: "<b>on the same page</b> 表示「意见一致、达成共识」。",
        tip: "常用于确认双方理解一致"
      },
      {
        en: "Could you walk me through the proposal?",
        zh: "你能给我讲解一下这个方案吗？",
        key: "<b>walk someone through</b> 表示「逐步讲解给某人听」。",
        tip: "比 explain 更形象，强调一步步讲"
      },
      {
        en: "Let's table this for now and revisit it next week.",
        zh: "我们暂时搁置，下周再讨论。",
        key: "<b>table</b> 作动词表示「暂缓、搁置'；<b>revisit</b> 重新讨论。",
        tip: "美式 table=搁置；英式 table=提出讨论，意思相反！"
      }
    ]
  }
];

// ============ 口语训练 ============
const SPEAKING_LESSONS = [
  {
    title: '自我介绍',
    level: 'easy', levelText: '入门',
    sentences: [
      {
        en: "Hi, I'm [name]. Nice to meet you!",
        zh: "嗨，我是[名字]。很高兴认识你！",
        key: "<b>Nice to meet you</b> 是初次见面的标准问候，to 弱读。",
        tip: "说的时候面带微笑，语气要热情"
      },
      {
        en: "I'm from [city]. I work as a [job].",
        zh: "我来自[城市]，我的职业是[工作]。",
        key: "<b>work as</b> 后接职业，表示「担任...工作」。",
        tip: "介绍职业时用 work as 比单纯说 I'm a 更自然"
      },
      {
        en: "In my free time, I enjoy reading and traveling.",
        zh: "业余时间我喜欢阅读和旅行。",
        key: "<b>In my free time</b> 引出爱好，<b>enjoy doing</b> 喜欢做某事。",
        tip: "enjoy 后接动名词 doing，不能接 to do"
      },
      {
        en: "I'm passionate about photography and learning new things.",
        zh: "我对摄影和学习新事物充满热情。",
        key: "<b>be passionate about</b> 对...有热情，比 like 更强烈。",
        tip: "高级表达，体现个性"
      }
    ]
  },
  {
    title: '表达观点',
    level: 'mid', levelText: '进阶',
    sentences: [
      {
        en: "In my opinion, we should focus on quality over quantity.",
        zh: "在我看来，我们应该重质量胜过数量。",
        key: "<b>In my opinion</b> 引出观点；<b>quality over quantity</b> 质量优先于数量。",
        tip: "表达观点的标准开场"
      },
      {
        en: "I see what you mean, but I have a different take on this.",
        zh: "我明白你的意思，但我有不同的看法。",
        key: "<b>I see what you mean</b> 表示理解对方；<b>take</b> 名词，表示「看法、观点」。",
        tip: "委婉表达不同意见的黄金句型"
      },
      {
        en: "That's a good point. However, we also need to consider the cost.",
        zh: "说得有道理。不过我们也要考虑成本。",
        key: "<b>That's a good point</b> 肯定对方观点；<b>However</b> 转折。",
        tip: "先肯定后转折，沟通更顺畅"
      },
      {
        en: "I'm of the opinion that we should take a different approach.",
        zh: "我认为我们应该采取不同的方法。",
        key: "<b>be of the opinion that</b> 较正式的「我认为」表达。",
        tip: "比 I think 更正式，适合商务场合"
      }
    ]
  },
  {
    title: '日常对话',
    level: 'mid', levelText: '进阶',
    sentences: [
      {
        en: "Sounds like a plan! Let's do it.",
        zh: "听起来不错！就这么办。",
        key: "<b>Sounds like a plan</b> 口语中表示「同意、就这么定」。",
        tip: "非常地道，日常对话高频"
      },
      {
        en: "To be honest, I'm not really sure about that.",
        zh: "说实话，我不太确定。",
        key: "<b>To be honest</b> 诚实说，引出真实想法；<b>not really sure</b> 不太确定。",
        tip: "委婉表达不确定"
      },
      {
        en: "It depends. Let me think about it and get back to you.",
        zh: "看情况。让我想想再回复你。",
        key: "<b>It depends</b> 看情况；<b>get back to you</b> 回头答复你。",
        tip: "不立刻决定时的标准回答"
      },
      {
        en: "No worries! I totally get it.",
        zh: "没关系！我完全理解。",
        key: "<b>No worries</b> 没关系/别担心；<b>I get it</b> 我明白了。",
        tip: "澳式/美式都常用，轻松场合万能句"
      }
    ]
  },
  {
    title: '商务谈判',
    level: 'hard', levelText: '高级',
    sentences: [
      {
        en: "We're willing to negotiate, but we have our limits.",
        zh: "我们愿意协商，但有底线。",
        key: "<b>willing to</b> 愿意；<b>have our limits</b> 有底线/限度。",
        tip: "谈判中表明立场"
      },
      {
        en: "Let's find a middle ground that works for both of us.",
        zh: "我们找个双方都能接受的折中方案。",
        key: "<b>middle ground</b> 中间地带、折中方案。",
        tip: "促成双赢的黄金表达"
      },
      {
        en: "I appreciate your offer, but it's a bit beyond our budget.",
        zh: "感谢你的报价，但有点超出我们预算。",
        key: "<b>appreciate</b> 感谢；<b>beyond our budget</b> 超出预算。",
        tip: "委婉拒绝的商务句型"
      },
      {
        en: "Can we sleep on it and give you an answer tomorrow?",
        zh: "我们能考虑一晚，明天给你答复吗？",
        key: "<b>sleep on it</b> 考虑一晚再做决定。",
        tip: "争取思考时间的高级表达"
      }
    ]
  }
];

// ============ 阅读训练 ============
const READING_LESSONS = [
  {
    title: '短篇故事',
    level: 'easy', levelText: '入门',
    sentences: [
      {
        en: "Every morning, Emma walks to the park near her house. She loves the fresh air and the singing of birds. It's her favorite way to start the day.",
        zh: "每天早上，艾玛走到家附近的公园。她喜欢新鲜空气和鸟儿的歌声。这是她开始一天最喜欢的方式。",
        key: "<b>favorite way to start the day</b> 开始一天最喜欢的方式。<b>singing of birds</b> 鸟鸣（动名词作名词）。",
        tip: "通读理解 → 跟读模仿 → 复述大意"
      },
      {
        en: "The old man sat on the bench, watching children play. He smiled, remembering his own childhood. Those were the golden days, he thought.",
        zh: "老人坐在长椅上，看着孩子们玩耍。他微笑着，回忆起自己的童年。他想，那才是黄金岁月。",
        key: "<b>remembering</b> 现在分词作伴随状语；<b>golden days</b> 黄金岁月。",
        tip: "注意 sat / watching / remembering / thought 的时态连贯"
      }
    ]
  },
  {
    title: '新闻片段',
    level: 'mid', levelText: '进阶',
    sentences: [
      {
        en: "A recent study shows that people who read regularly tend to have better memory and sharper thinking skills as they age.",
        zh: "最近一项研究表明，经常阅读的人随着年龄增长，往往有更好的记忆力和更敏锐的思维。",
        key: "<b>tend to</b> 倾向于；<b>as they age</b> 随着年龄增长；<b>sharper</b> 更敏锐的。",
        tip: "新闻句式较长，先抓主干：study shows that..."
      },
      {
        en: "The company announced a new policy allowing employees to work remotely up to three days a week, starting next month.",
        zh: "公司宣布了一项新政策，允许员工每周最多远程工作三天，下月起生效。",
        key: "<b>allowing</b> 现在分词修饰 policy；<b>remotely</b> 远程地；<b>up to</b> 最多。",
        tip: "长句拆分：主句 + 修饰语 + 时间状语"
      }
    ]
  },
  {
    title: 'TED 演讲节选',
    level: 'hard', levelText: '高级',
    sentences: [
      {
        en: "Success is not final, failure is not fatal: it is the courage to continue that counts. We often learn more from our failures than from our victories.",
        zh: "成功不是终点，失败也不是末日：重要的是继续前行的勇气。我们从失败中学到的往往比从胜利中学到的更多。",
        key: "<b>not final</b> 不是终点；<b>not fatal</b> 不是致命的；<b>it is...that counts</b> 强调句型，「重要的是...」。",
        tip: "丘吉尔名言变体，注意 it is...that... 强调结构"
      },
      {
        en: "The greatest discovery of my generation is that human beings can alter their lives by altering their attitudes of mind.",
        zh: "我们这一代最伟大的发现是：人类可以通过改变心态来改变生活。",
        key: "<b>alter</b> 改变；<b>by altering</b> 通过改变（方式状语）；<b>attitudes of mind</b> 心态。",
        tip: "威廉·詹姆斯名言，注意 alter 的双关重复"
      },
      {
        en: "In the middle of difficulty lies opportunity. The pessimist sees difficulty in every opportunity, while the optimist sees opportunity in every difficulty.",
        zh: "困难之中蕴藏着机遇。悲观者在每个机遇中看到困难，而乐观者却在每个困难中看到机遇。",
        key: "<b>lies</b> 蕴藏/位于（倒装句）；<b>while</b> 而（表对比）；<b>pessimist/optimist</b> 悲观者/乐观者。",
        tip: "爱因斯坦名言，注意 in...lies... 倒装结构和 while 的对比用法"
      }
    ]
  }
];

// ============ 记账本 ============
const EXPENSE_CATEGORIES = [
  { value: 'food', label: '🍔 餐饮' },
  { value: 'transport', label: '🚗 交通' },
  { value: 'shopping', label: '🛍 购物' },
  { value: 'life', label: '🏠 生活' },
  { value: 'fun', label: '🎮 娱乐' },
  { value: 'study', label: '📚 学习' },
  { value: 'medical', label: '💊 医疗' },
  { value: 'other', label: '📦 其他' },
];

let accountViewMode = 'month'; // month / year

function renderAccount() {
  const expenses = Store.get('expenses', []);
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const yy = `${now.getFullYear()}`;

  const monthExpenses = expenses.filter(e => e.date.startsWith(ym));
  const yearExpenses = expenses.filter(e => e.date.startsWith(yy));
  const shownExpenses = accountViewMode === 'month' ? monthExpenses : yearExpenses;

  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const yearTotal = yearExpenses.reduce((s, e) => s + e.amount, 0);
  const viewTotal = accountViewMode === 'month' ? monthTotal : yearTotal;

  // 分类统计
  const categoryTotals = {};
  shownExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const maxCategoryTotal = sortedCategories.length ? sortedCategories[0][1] : 1;

  // 按日期倒序展示
  const sortedExpenses = [...shownExpenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  $('#content').innerHTML = `
    <!-- 总览 -->
    <div class="task-stats">
      <div class="stat-box">
        <div class="stat-num">¥${monthTotal.toFixed(2)}</div>
        <div class="stat-label">本月支出</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">¥${yearTotal.toFixed(2)}</div>
        <div class="stat-label">本年支出</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${shownExpenses.length}</div>
        <div class="stat-label">${accountViewMode === 'month' ? '本月' : '本年'}笔数</div>
      </div>
    </div>

    <!-- 记录消费 -->
    <div class="card">
      <h3 class="card-title"><span class="emoji">➕</span>记一笔</h3>
      <div class="expense-form">
        <div class="expense-row">
          <input type="number" id="expenseAmount" class="expense-amount" placeholder="0.00" step="0.01" min="0" />
          <span class="expense-unit">元</span>
        </div>
        <div class="expense-category-wrap" id="expenseCategoryWrap">
          ${EXPENSE_CATEGORIES.map((c, i) => `
            <button class="cat-btn ${i === 0 ? 'active' : ''}" data-cat="${c.value}">${c.label}</button>
          `).join('')}
        </div>
        <input type="text" id="expenseNote" class="expense-note" placeholder="备注（可选）" />
        <button class="log-save-btn" id="expenseAddBtn">💾 记一笔</button>
      </div>
    </div>

    <!-- 视图切换 -->
    <div class="review-tabs">
      <button class="review-tab ${accountViewMode==='month'?'active':''}" onclick="switchAccountView('month')">📅 本月明细</button>
      <button class="review-tab ${accountViewMode==='year'?'active':''}" onclick="switchAccountView('year')">📆 本年明细</button>
    </div>

    <!-- 分类统计 -->
    ${sortedCategories.length === 0 ? '' : `
      <div class="card">
        <h3 class="card-title"><span class="emoji">📊</span>${accountViewMode === 'month' ? '本月' : '本年'}分类统计</h3>
        ${sortedCategories.map(([cat, total]) => {
          const catInfo = EXPENSE_CATEGORIES.find(c => c.value === cat) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
          const pct = Math.round(total / maxCategoryTotal * 100);
          return `
            <div class="cat-stat">
              <div class="cat-stat-header">
                <span class="cat-stat-label">${catInfo.label}</span>
                <span class="cat-stat-amount">¥${total.toFixed(2)}</span>
              </div>
              <div class="cat-stat-bar"><div class="cat-stat-fill" style="width:${pct}%"></div></div>
            </div>
          `;
        }).join('')}
      </div>
    `}

    <!-- 明细列表 -->
    <div class="card">
      <h3 class="card-title"><span class="emoji">📒</span>${accountViewMode === 'month' ? '本月' : '本年'}明细 (${shownExpenses.length})</h3>
      ${sortedExpenses.length === 0
        ? '<div class="empty-tip"><span class="emoji">💰</span>还没有记录，开始记一笔吧！</div>'
        : sortedExpenses.map(e => {
            const catInfo = EXPENSE_CATEGORIES.find(c => c.value === e.category) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
            return `
              <div class="expense-item">
                <div class="expense-item-cat">${catInfo.label}</div>
                <div class="expense-item-info">
                  <div class="expense-item-amount">¥${e.amount.toFixed(2)}</div>
                  <div class="expense-item-meta">${e.date}${e.note ? ' · ' + escapeHtml(e.note) : ''}</div>
                </div>
                <button class="task-delete" onclick="deleteExpense('${e.id}')">✕</button>
              </div>
            `;
          }).join('')
      }
    </div>
  `;

  // 分类选择
  $$('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 添加消费
  $('#expenseAddBtn').addEventListener('click', addExpense);
  $('#expenseAmount').addEventListener('keydown', e => { if (e.key === 'Enter') addExpense(); });
  $('#expenseNote').addEventListener('keydown', e => { if (e.key === 'Enter') addExpense(); });
}

function switchAccountView(mode) {
  accountViewMode = mode;
  renderAccount();
}

let currentExpenseCategory = 'food';

function addExpense() {
  const amount = parseFloat($('#expenseAmount').value);
  if (!amount || amount <= 0) { toast('请输入金额'); return; }
  const activeCat = $('.cat-btn.active');
  const category = activeCat ? activeCat.dataset.cat : 'other';
  const note = $('#expenseNote').value.trim();

  const expenses = Store.get('expenses', []);
  expenses.push({
    id: 'e_' + Date.now(),
    amount,
    category,
    note,
    date: todayStr(),
    createdAt: Date.now()
  });
  Store.set('expenses', expenses);
  renderAccount();
  toast('已记录 ¥' + amount.toFixed(2) + ' 💰');
}

function deleteExpense(id) {
  let expenses = Store.get('expenses', []);
  expenses = expenses.filter(x => x.id !== id);
  Store.set('expenses', expenses);
  renderAccount();
  toast('已删除');
}

// ============ 工具 ============
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============ 初始化 ============
function init() {
  const d = new Date();
  $('#todayDate').textContent = formatDate(d);
  initNav();
  switchPage('daily');
  // 启动日志提醒定时检查
  startReminderChecker();
  // 页面可见时检查一次（从后台切回前台）
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkReminder();
  });
}

document.addEventListener('DOMContentLoaded', init);
