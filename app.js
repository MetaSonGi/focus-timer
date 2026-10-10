/* 집중 타이머 — 뽀모도로 + localStorage 기록 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const CIRC = 553; // 2πr (r=88)
  const KEY = 'ft_log_v1';

  let totalSec = 25 * 60, remainSec = totalSec, running = false, timerId = null, endAt = 0;
  let modeMin = 25, modeName = '집중';

  const load = () => JSON.parse(localStorage.getItem(KEY) || '[]');
  const save = (log) => localStorage.setItem(KEY, JSON.stringify(log));

  function fmt(s) {
    s = Math.max(0, Math.ceil(s));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function render() {
    $('timeLeft').textContent = fmt(remainSec);
    $('ringFg').style.strokeDashoffset = CIRC * (1 - remainSec / totalSec);
    document.title = running ? `⏱ ${fmt(remainSec)} — 집중 타이머` : '집중 타이머 — 뽀모도로';
  }

  function setMode(min, name, btn) {
    stop();
    modeMin = min; modeName = name;
    totalSec = remainSec = min * 60;
    document.querySelectorAll('.mode').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    $('phaseLabel').textContent = '준비';
    $('startBtn').textContent = '▶ 시작';
    render();
  }

  document.querySelectorAll('.mode[data-min]').forEach((b) =>
    b.addEventListener('click', () => setMode(parseInt(b.dataset.min, 10), b.textContent.trim(), b)));

  $('customMode').addEventListener('click', () => {
    const v = prompt('분 단위로 입력하세요 (1~180)', '25');
    const n = parseInt(v, 10);
    if (n >= 1 && n <= 180) setMode(n, `직접 ${n}분`, $('customMode'));
  });

  function tick() {
    remainSec = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    render();
    if (remainSec <= 0) finish();
  }

  function start() {
    if (running) { pause(); return; }
    running = true;
    endAt = Date.now() + remainSec * 1000;
    timerId = setInterval(tick, 500);
    $('startBtn').textContent = '⏸ 일시정지';
    $('phaseLabel').textContent = modeName + ' 중…';
  }

  function pause() {
    running = false;
    clearInterval(timerId);
    $('startBtn').textContent = '▶ 계속';
    $('phaseLabel').textContent = '일시정지';
    render();
  }

  function stop() {
    running = false;
    clearInterval(timerId);
  }

  function beep() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [523, 659, 784].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.frequency.value = f;
        const t = ac.currentTime + i * 0.18;
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
        o.start(t); o.stop(t + 0.18);
      });
    } catch (e) { /* 오디오 미지원 */ }
  }

  function finish() {
    stop();
    beep();
    $('phaseLabel').textContent = '완료! 🎉';
    $('startBtn').textContent = '▶ 시작';
    // 기록 저장
    const log = load();
    const now = new Date();
    log.push({
      t: now.toISOString(),
      min: modeMin,
      mode: modeName,
      task: $('taskInput').value.trim(),
    });
    save(log);
    renderStats();
    remainSec = totalSec;
    setTimeout(render, 1500);
  }

  $('startBtn').addEventListener('click', start);
  $('resetBtn').addEventListener('click', () => {
    stop();
    remainSec = totalSec;
    $('startBtn').textContent = '▶ 시작';
    $('phaseLabel').textContent = '준비';
    render();
  });

  /* ---------- 통계 ---------- */
  function dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function renderStats() {
    const log = load();
    const today = dayKey(new Date());
    const todayLog = log.filter((e) => dayKey(new Date(e.t)) === today && e.mode.includes('집중'));
    const tMin = todayLog.reduce((a, e) => a + e.min, 0);
    $('todayMin').textContent = tMin;
    $('todayCount').textContent = todayLog.length;

    // 연속 일수
    let streak = 0;
    const d = new Date();
    for (;;) {
      const k = dayKey(d);
      if (log.some((e) => dayKey(new Date(e.t)) === k && e.mode.includes('집중'))) { streak++; d.setDate(d.getDate() - 1); }
      else break;
      if (streak > 365) break;
    }
    $('streak').textContent = streak;

    // 주간 차트
    const week = $('weekChart');
    week.innerHTML = '';
    const names = ['일', '월', '화', '수', '목', '금', '토'];
    const maxV = Math.max(1, ...Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(); dd.setDate(dd.getDate() - (6 - i));
      const k = dayKey(dd);
      return log.filter((e) => dayKey(new Date(e.t)) === k && e.mode.includes('집중')).reduce((a, e) => a + e.min, 0);
    }));
    for (let i = 0; i < 7; i++) {
      const dd = new Date(); dd.setDate(dd.getDate() - (6 - i));
      const k = dayKey(dd);
      const v = log.filter((e) => dayKey(new Date(e.t)) === k && e.mode.includes('집중')).reduce((a, e) => a + e.min, 0);
      const col = document.createElement('div');
      col.className = 'wday';
      col.innerHTML = `<div class="wbar" style="height:${Math.max(4, (v / maxV) * 62)}px" title="${v}분"></div><span>${names[dd.getDay()]}</span>`;
      week.appendChild(col);
    }

    // 로그
    const list = $('logList');
    const recent = [...log].reverse().slice(0, 20);
    list.innerHTML = recent.length ? recent.map((e) => {
      const dt = new Date(e.t);
      const hm = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
      const md = (dt.getMonth() + 1) + '/' + dt.getDate();
      const task = e.task ? ` — <b>${escapeHtml(e.task)}</b>` : '';
      return `<li>${md} ${hm} · ${e.mode} ${e.min}분${task}</li>`;
    }).join('') : '<li>아직 기록이 없습니다. 첫 세션을 시작해보세요!</li>';
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  renderStats();
  render();
})();
