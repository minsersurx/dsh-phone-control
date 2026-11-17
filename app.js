// DSH Phone Control Web
// 通过隧道/反向代理连接手机上的 dsh-go 本地引擎，发送任务并查看结果。

const $ = (id) => document.getElementById(id);

const state = {
  baseUrl: localStorage.getItem('dsh_base') || '',
  token: localStorage.getItem('dsh_token') || '',
  connected: false,
  sessions: [],
  currentSessionId: null,
  eventSource: null,
};

const QUICK_TASKS = [
  "打开设置，查看电池使用情况",
  "打开相机，拍一张照片并保存",
  "打开浏览器，搜索「今天天气」",
  "打开微信，查看最近消息",
  "截图当前屏幕并描述内容",
  "打开文件管理器，列出下载目录",
  "检查手机存储空间剩余多少",
  "打开音乐 App 播放一首歌",
];

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function setStatus(text, type = '') {
  const el = $('status');
  el.textContent = text;
  el.className = 'status ' + type;
}

function saveConfig() {
  localStorage.setItem('dsh_base', state.baseUrl);
  localStorage.setItem('dsh_token', state.token);
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (state.token) h['Authorization'] = `Bearer ${state.token}`;
  return h;
}

async function api(path, options = {}) {
  const url = state.baseUrl.replace(/\/$/, '') + path;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text.slice(0, 200)}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

// 尝试多种常见端点
async function testConnection() {
  if (!state.baseUrl) return toast('请先填写地址');
  setStatus('测试中...', '');
  const candidates = ['/health', '/api/health', '/', '/api/sessions'];
  for (const p of candidates) {
    try {
      const r = await fetch(state.baseUrl.replace(/\/$/, '') + p, { headers: headers() });
      if (r.ok || r.status === 401 || r.status === 200) {
        setStatus('可达 ✓', 'connected');
        toast(`测试成功：${p} → ${r.status}`);
        return true;
      }
    } catch (e) {}
  }
  setStatus('无法连接', 'error');
  toast('无法连接到该地址，请检查隧道是否正常');
  return false;
}

async function loadSessions() {
  try {
    let data;
    try {
      data = await api('/api/sessions');
    } catch {
      try { data = await api('/api/v1/sessions'); } catch { data = { items: [] }; }
    }
    state.sessions = data.items || data.sessions || data || [];
    renderSessions();
  } catch (e) {
    console.warn(e);
    toast('加载会话失败：' + e.message);
  }
}

function renderSessions() {
  const ul = $('sessionList');
  ul.innerHTML = '';
  state.sessions.forEach(s => {
    const li = document.createElement('li');
    li.textContent = s.title || s.name || s.id || '未命名会话';
    li.dataset.id = s.id;
    if (s.id === state.currentSessionId) li.classList.add('active');
    li.onclick = () => selectSession(s.id);
    ul.appendChild(li);
  });
}

async function selectSession(id) {
  state.currentSessionId = id;
  renderSessions();
  $('currentSession').textContent = id.slice(0, 8) + '...';
  $('cancelBtn').disabled = false;
  await loadHistory(id);
  startStream(id);
}

async function loadHistory(id) {
  $('messages').innerHTML = '<div class="message system">加载历史...</div>';
  try {
    let data;
    try { data = await api(`/api/sessions/${id}/history`); }
    catch { try { data = await api(`/api/v1/sessions/${id}/history`); } catch { data = { messages: [] }; } }
    const msgs = data.messages || data.items || data || [];
    $('messages').innerHTML = '';
    msgs.forEach(m => {
      const role = m.role || m.type || 'assistant';
      addMessage(role === 'user' ? 'user' : 'assistant', m.content || m.text || JSON.stringify(m));
    });
  } catch (e) {
    addMessage('system', '无法加载历史：' + e.message);
  }
}

function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = content;
  $('messages').appendChild(div);
  $('messages').scrollTop = $('messages').scrollHeight;
}

function startStream(id) {
  if (state.eventSource) state.eventSource.close();
  try {
    const url = state.baseUrl.replace(/\/$/, '') + `/api/sessions/${id}/stream`;
    state.eventSource = new EventSource(url + (state.token ? `?token=${encodeURIComponent(state.token)}` : ''));
    state.eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'delta' || data.content) {
          addMessage('assistant', data.content || data.delta || '');
        }
      } catch {}
    };
    state.eventSource.onerror = () => {};
  } catch {}
}

async function createSession() {
  if (!state.connected && !(await testConnection())) return;
  try {
    let data;
    try { data = await api('/api/sessions', { method: 'POST', body: JSON.stringify({}) }); }
    catch { data = await api('/api/v1/sessions', { method: 'POST', body: JSON.stringify({}) }); }
    const id = data.id || data.sessionId;
    if (id) {
      state.sessions.unshift({ id, title: '新会话' });
      renderSessions();
      selectSession(id);
      toast('会话已创建');
    }
  } catch (e) {
    toast('创建失败：' + e.message);
  }
}

async function sendPrompt() {
  const text = $('prompt').value.trim();
  if (!text) return;
  if (!state.currentSessionId) {
    await createSession();
    if (!state.currentSessionId) return;
  }
  addMessage('user', text);
  $('prompt').value = '';
  $('sendBtn').disabled = true;
  try {
    const body = { content: text, mode: 'queue' };
    try {
      await api(`/api/sessions/${state.currentSessionId}/prompt`, { method: 'POST', body: JSON.stringify(body) });
    } catch {
      await api(`/api/v1/sessions/${state.currentSessionId}/prompt`, { method: 'POST', body: JSON.stringify(body) });
    }
    addMessage('system', '任务已发送，等待手机上的 DSH 执行...');
  } catch (e) {
    addMessage('error', '发送失败：' + e.message);
  } finally {
    $('sendBtn').disabled = false;
  }
}

async function cancelTask() {
  if (!state.currentSessionId) return;
  try {
    await api(`/api/sessions/${state.currentSessionId}/cancel`, { method: 'POST' });
    toast('已请求取消');
  } catch (e) {
    toast('取消失败');
  }
}

function initQuick() {
  const box = $('quickTasks');
  QUICK_TASKS.forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = t;
    chip.onclick = () => { $('prompt').value = t; $('prompt').focus(); };
    box.appendChild(chip);
  });
}

// 事件绑定
$('connectBtn').onclick = async () => {
  state.baseUrl = $('baseUrl').value.trim();
  state.token = $('token').value.trim();
  saveConfig();
  if (await testConnection()) {
    state.connected = true;
    setStatus('已连接', 'connected');
    await loadSessions();
  }
};
$('testBtn').onclick = testConnection;
$('newSessionBtn').onclick = createSession;
$('sendBtn').onclick = sendPrompt;
$('cancelBtn').onclick = cancelTask;
$('prompt').onkeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(); }
};

// 初始化
$('baseUrl').value = state.baseUrl;
$('token').value = state.token;
initQuick();
if (state.baseUrl) $('connectBtn').click();

console.log('DSH Phone Control ready. 记得在手机侧通过隧道暴露 dsh web。');
