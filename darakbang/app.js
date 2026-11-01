/* 무화과 그룹 박준원 다락방 — 앱 로직 */
(function () {
  'use strict';

  const CFG = window.DARAKBANG_CONFIG || {};
  const PREVIEW = !CFG.API_URL;               // API 주소 없으면 미리보기 모드
  const SHEETS = ['공지', '결단', '일정', '기도제목', '간식', '암송', '통독'];
  const SNACK_CATS = ['치킨', '피자', '중식', '분식', '한식', '양식', '카페·디저트', '기타'];
  const EVENT_KINDS = ['순모임', '행사', '기타'];
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ───────────────────────── 상태 ─────────────────────────
  const state = {
    token: localStorage.getItem('dk_token') || '',
    data: loadCache(),
    tab: 'home',
    calMonth: startOfMonth(new Date()),
    calSelected: todayStr(),
    snackCat: '전체',
    snackSort: 'new',
    openNotice: null,
  };

  function loadCache() {
    try { return JSON.parse(localStorage.getItem('dk_cache') || '{}'); } catch (_) { return {}; }
  }
  function saveCache() { try { localStorage.setItem('dk_cache', JSON.stringify(state.data)); } catch (_) {} }
  function rows(sheet) { return state.data[sheet] || []; }

  // ───────────────────────── 날짜 도구 ─────────────────────────
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return ymd(new Date()); }
  function parseYmd(s) { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
  function fmtKo(s) { const d = parseYmd(s); return d ? (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + DOW[d.getDay()] + ')' : s; }
  function fmtShort(s) { const d = parseYmd(s); return d ? (d.getMonth() + 1) + '.' + d.getDate() : s; }
  function dday(target) {
    const n = daysBetween(todayStr(), target);
    if (isNaN(n)) return '';
    return n === 0 ? 'D-day' : n > 0 ? 'D-' + n : 'D+' + (-n);
  }
  function byDesc(key) { return (a, b) => String(b[key]).localeCompare(String(a[key])); }
  function byAsc(key) { return (a, b) => String(a[key]).localeCompare(String(b[key])); }

  // ───────────────────────── API ─────────────────────────
  const api = PREVIEW ? mockApi() : realApi();

  function realApi() {
    const url = CFG.API_URL;
    async function get(params) {
      const q = new URLSearchParams(params).toString();
      const r = await fetch(url + '?' + q, { method: 'GET', redirect: 'follow' });
      return r.json();
    }
    async function post(body) {
      const r = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
      return r.json();
    }
    return {
      login: pw => get({ action: 'login', password: pw }),
      all: () => get({ action: 'all', token: state.token }),
      save: (sheet, row) => post({ action: 'save', sheet, row, token: state.token }),
      del: (sheet, id) => post({ action: 'delete', sheet, id, token: state.token }),
    };
  }

  // 미리보기: 이 기기(localStorage)에만 저장. 처음엔 예시 데이터.
  function mockApi() {
    const KEY = 'dk_mock';
    let store;
    try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { store = null; }
    if (!store) { store = sampleData(); persist(); }
    function persist() { localStorage.setItem(KEY, JSON.stringify(store)); }
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const now = () => { const d = new Date(); return ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    return {
      login: async () => { await wait(300); return { ok: true, token: 'preview' }; },
      all: async () => { await wait(250); return { ok: true, data: JSON.parse(JSON.stringify(store)) }; },
      save: async (sheet, row) => {
        await wait(300);
        const list = store[sheet] || (store[sheet] = []);
        const i = list.findIndex(r => r.id === row.id);
        if (i === -1) { row.id = Math.random().toString(36).slice(2, 10); if (!row['작성일시']) row['작성일시'] = now(); list.push(row); }
        else list[i] = Object.assign({}, list[i], row);
        persist(); return { ok: true, row };
      },
      del: async (sheet, id) => { await wait(200); store[sheet] = (store[sheet] || []).filter(r => r.id !== id); persist(); return { ok: true }; },
    };
  }

  function sampleData() {
    const t = new Date();
    const d = n => { const x = new Date(t); x.setDate(x.getDate() + n); return ymd(x); };
    return {
      '공지': [
        { id: 'n1', '작성일시': d(-2) + ' 21:10', '제목': '이번 주 순모임 장소 변경', '내용': '이번 주는 교회 2층 세미나실 대신 카페 그린에서 모입니다.\n7시 30분까지 와주세요.', '고정': 'Y', '작성자': '준원' },
        { id: 'n2', '작성일시': d(-6) + ' 09:00', '제목': '겨울 수련회 참가 신청', '내용': '12월 수련회 참가 신청을 받습니다. 결단 탭의 D-day 확인하고 신청해 주세요.', '고정': '', '작성자': '준원' },
      ],
      '결단': [
        { id: 'r1', '작성일시': d(-10) + ' 20:00', '제목': '신약 1독 완주', '내용': '매일 3장씩, 주일 제외', '목표일': d(23), '상태': '진행', '작성자': '다락방' },
        { id: 'r2', '작성일시': d(-20) + ' 20:00', '제목': '수련회 참가 신청 마감', '내용': '', '목표일': d(5), '상태': '진행', '작성자': '준원' },
        { id: 'r3', '작성일시': d(-40) + ' 20:00', '제목': '새벽기도 2주 연속', '내용': '', '목표일': d(-12), '상태': '완료', '작성자': '다락방' },
      ],
      '일정': [
        { id: 'e1', '날짜': d(0), '시작': '19:30', '종료': '21:30', '제목': '순모임', '장소': '카페 그린', '종류': '순모임', '메모': '' },
        { id: 'e2', '날짜': d(7), '시작': '19:30', '종료': '21:30', '제목': '순모임', '장소': '교회 2층', '종류': '순모임', '메모': '' },
        { id: 'e3', '날짜': d(12), '시작': '10:00', '종료': '', '제목': '그룹 연합 예배', '장소': '본당', '종류': '행사', '메모': '무화과 그룹 전체' },
        { id: 'e4', '날짜': d(23), '시작': '', '종료': '', '제목': '겨울 수련회 출발', '장소': '교회 앞', '종류': '행사', '메모': '' },
      ],
      '기도제목': [
        { id: 'p1', '작성일시': d(-1) + ' 22:00', '이름': '', '내용': '다음 주 면접 잘 볼 수 있도록', '응답': '', '응답메모': '' },
        { id: 'p2', '작성일시': d(-3) + ' 22:00', '이름': 'J', '내용': '어머니 수술 회복', '응답': '', '응답메모': '' },
        { id: 'p3', '작성일시': d(-15) + ' 22:00', '이름': '', '내용': '이직 결정에 지혜를', '응답': 'Y', '응답메모': '좋은 곳으로 결정했어요. 감사합니다.' },
      ],
      '간식': [
        { id: 's1', '작성일시': d(-4) + ' 21:00', '가게': '교촌치킨 역삼점', '카테고리': '치킨', '추천메뉴': '허니콤보 + 치즈볼', '양': '4', '맛': '5', '속도': '3', '한줄평': '맛은 보장. 뼈 때문에 나눔 중에 먹기엔 좀 번거로움.', '추천인': '준원', '링크': '' },
        { id: 's2', '작성일시': d(-11) + ' 21:00', '가게': '김밥천국 선릉점', '카테고리': '분식', '추천메뉴': '참치김밥, 떡볶이', '양': '5', '맛': '3', '속도': '5', '한줄평': '빨리 오고 빨리 먹고 바로 나눔 가능. 가성비 최고.', '추천인': 'H', '링크': '' },
        { id: 's3', '작성일시': d(-18) + ' 21:00', '가게': '피자스쿨', '카테고리': '피자', '추천메뉴': '고구마피자 L', '양': '3', '맛': '3', '속도': '4', '한줄평': '무난. 8명 넘으면 두 판.', '추천인': '', '링크': '' },
      ],
      '암송': [
        { id: 'v1', '시작일': d(-3), '구절': '시편 1:2', '본문': '오직 여호와의 율법을 즐거워하여 그의 율법을 주야로 묵상하는도다' },
      ],
      '통독': [
        { id: 't1', '날짜': d(-1), '범위': '마태복음 5-7장' },
        { id: 't2', '날짜': d(0), '범위': '마태복음 8-10장' },
        { id: 't3', '날짜': d(1), '범위': '마태복음 11-13장' },
      ],
    };
  }

  // ───────────────────────── 공통 UI ─────────────────────────
  let toastTimer;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function loading(on) {
    const el = $('#loading');
    if (on) { el.className = 'on'; }
    else { el.className = 'done'; setTimeout(() => { el.className = ''; }, 600); }
  }
  function stars(n) {
    n = Math.max(0, Math.min(5, parseInt(n, 10) || 0));
    return '<span class="stars"><b>' + '★'.repeat(n) + '</b>' + '★'.repeat(5 - n) + '</span>';
  }

  // ───────────────────────── 데이터 불러오기 ─────────────────────────
  let refreshing = false;
  async function refresh(silent) {
    if (refreshing) return;
    refreshing = true;
    if (!silent) loading(true);
    try {
      const r = await api.all();
      if (!r.ok) {
        if (r.error === 'unauthorized') { logout('비밀번호가 바뀌었어요. 다시 들어와 주세요.'); return; }
        throw new Error(r.error || '불러오기 실패');
      }
      state.data = r.data || {};
      saveCache();
      render();
    } catch (e) {
      toast('불러오지 못했어요. 저장된 내용을 보여드려요.');
    } finally {
      refreshing = false;
      if (!silent) loading(false);
    }
  }

  async function saveRow(sheet, row) {
    const r = await api.save(sheet, row);
    if (!r.ok) throw new Error(r.error || '저장 실패');
    await refresh(true);
    return r.row;
  }
  async function deleteRow(sheet, id) {
    const r = await api.del(sheet, id);
    if (!r.ok) throw new Error(r.error || '삭제 실패');
    await refresh(true);
  }

  // ───────────────────────── 입장/퇴장 ─────────────────────────
  function showLogin() {
    $('#login').classList.remove('hidden');
    $('#app').classList.add('hidden');
    $('#login-pw').value = '';
    $('#login-error').textContent = '';
  }
  function showApp() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    onHash();
    refresh(Object.keys(state.data).length > 0);
  }
  function logout(msg) {
    state.token = ''; localStorage.removeItem('dk_token');
    state.data = {}; localStorage.removeItem('dk_cache');
    showLogin();
    if (msg) $('#login-error').textContent = msg;
  }

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#login-pw').value.trim();
    if (!pw) return;
    const btn = $('#login-form button'); btn.disabled = true; btn.textContent = '확인 중…';
    $('#login-error').textContent = '';
    try {
      const r = await api.login(pw);
      if (r.ok && r.token) {
        state.token = r.token; localStorage.setItem('dk_token', r.token);
        showApp();
      } else {
        $('#login-error').textContent = '비밀번호가 맞지 않아요.';
      }
    } catch (_) {
      $('#login-error').textContent = '연결할 수 없어요. 잠시 후 다시 시도해 주세요.';
    } finally { btn.disabled = false; btn.textContent = '들어가기'; }
  });
  $('#btn-logout').addEventListener('click', () => { if (confirm('나가시겠어요? 다시 들어올 때 비밀번호가 필요해요.')) logout(); });
  $('#btn-refresh').addEventListener('click', () => refresh(false));

  // ───────────────────────── 탭 라우팅 ─────────────────────────
  const TABS = { home: renderHome, notice: renderNotice, resolve: renderResolve, calendar: renderCalendar, prayer: renderPrayer, snack: renderSnack };
  const FAB_ACTION = { notice: () => openNoticeForm(), resolve: () => openResolveForm(), calendar: () => openEventForm(null, state.calSelected), prayer: () => openPrayerForm(), snack: () => openSnackForm() };

  function onHash() {
    const t = (location.hash || '#home').slice(1);
    state.tab = TABS[t] ? t : 'home';
    $$('nav.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === state.tab));
    window.scrollTo(0, 0);
    render();
  }
  window.addEventListener('hashchange', onHash);

  function render() {
    if ($('#app').classList.contains('hidden')) return;
    TABS[state.tab]();
    const fab = $('#fab');
    fab.classList.toggle('hidden', !FAB_ACTION[state.tab]);
    fab.onclick = FAB_ACTION[state.tab] || null;
  }

  // ───────────────────────── ① 대시보드 ─────────────────────────
  function renderHome() {
    const today = todayStr();
    const reading = rows('통독').find(r => r['날짜'] === today);
    const verse = rows('암송').filter(r => r['시작일'] && r['시작일'] <= today).sort(byDesc('시작일'))[0];
    const upcoming = rows('일정').filter(r => r['날짜'] >= today && daysBetween(today, r['날짜']) <= 30).sort((a, b) => (a['날짜'] + a['시작']).localeCompare(b['날짜'] + b['시작'])).slice(0, 5);
    const resolves = rows('결단').filter(r => r['상태'] !== '완료' && r['목표일'] && r['목표일'] >= today).sort(byAsc('목표일')).slice(0, 2);
    const att = CFG.ATTENDANCE_URL;

    $('#main').innerHTML = `
      <div class="today-line">${fmtKo(today)}</div>
      <div class="dash-grid">
        <div class="card fig span2">
          <div class="kicker">오늘 통독</div>
          ${reading ? `<div class="reading">${esc(reading['범위'])}</div>` : `<div class="muted">오늘 통독 범위가 등록되지 않았어요</div>`}
        </div>
        <div class="card span2">
          <div class="kicker">이번 주 암송</div>
          ${verse ? `<div class="verse-ref">${esc(verse['구절'])}</div><div class="verse-text">${esc(verse['본문'])}</div>` : `<div class="muted">암송 구절이 등록되지 않았어요</div>`}
          <div class="card-actions" style="border:0;padding-top:6px;margin-top:4px">
            <button class="btn-sm" data-act="verse">${verse ? '암송 바꾸기' : '암송 등록'}</button>
            <button class="btn-sm" data-act="reading">통독 입력</button>
          </div>
        </div>
        <a class="link-btn span2 ${att ? '' : 'disabled'}" href="${esc(att || '#')}" target="_blank" rel="noopener">
          <span>${att ? '출석부 열기' : '출석부 주소가 설정되지 않았어요'}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
        </a>
      </div>

      <div class="section-label">다가오는 일정</div>
      <div class="card">
        ${upcoming.length ? upcoming.map(ev => {
          const d = parseYmd(ev['날짜']); const isToday = ev['날짜'] === today;
          return `<div class="event-line">
            <div class="date ${isToday ? 'today' : ''}"><b>${d.getDate()}</b><span>${isToday ? '오늘' : (d.getMonth() + 1) + '월 ' + DOW[d.getDay()]}</span></div>
            <div class="what"><div class="t">${esc(ev['제목'])} <span class="badge ${kindClass(ev['종류'])}">${esc(ev['종류'] || '기타')}</span></div>
            <div class="s">${[ev['시작'] && (ev['시작'] + (ev['종료'] ? '–' + ev['종료'] : '')), ev['장소']].filter(Boolean).map(esc).join(' · ')}</div></div>
          </div>`; }).join('') : `<div class="muted" style="text-align:center;padding:8px 0">예정된 일정이 없어요</div>`}
      </div>

      ${resolves.length ? `<div class="section-label">진행 중 결단</div>` + resolves.map(r => `
        <div class="card row"><div class="grow"><div class="title">${esc(r['제목'])}</div><div class="meta">${fmtKo(r['목표일'])}까지</div></div><div class="dday-chip">${dday(r['목표일'])}</div></div>`).join('') : ''}
    `;
    $('[data-act=verse]', $('#main')).onclick = () => openVerseForm(verse);
    $('[data-act=reading]', $('#main')).onclick = () => openReadingForm(reading);
  }
  function kindClass(k) { return k === '순모임' ? '' : k === '행사' ? 'leaf' : 'gray'; }

  function openVerseForm(cur) {
    openForm({
      title: '이번 주 암송 구절', sheet: '암송', initial: { '시작일': todayStr() },
      fields: [
        { key: '구절', label: '구절 주소', type: 'text', required: true, placeholder: '예: 시편 1:2' },
        { key: '본문', label: '본문', type: 'textarea', required: true },
        { key: '시작일', label: '적용 시작일', type: 'date', required: true, help: '이 날짜부터 대시보드에 표시돼요' },
      ],
    });
  }
  function openReadingForm(cur) {
    openForm({
      title: '통독 범위', sheet: '통독', initial: cur || { '날짜': todayStr() },
      fields: [
        { key: '날짜', label: '날짜', type: 'date', required: true },
        { key: '범위', label: '범위', type: 'text', required: true, placeholder: '예: 마태복음 8-10장' },
      ],
      help: '통독표 전체는 구글 시트의 "통독" 탭에 한 번에 붙여넣는 게 편해요.',
    });
  }

  // ───────────────────────── ② 공지 ─────────────────────────
  function renderNotice() {
    const list = rows('공지').slice().sort((a, b) => (b['고정'] === 'Y') - (a['고정'] === 'Y') || byDesc('작성일시')(a, b));
    $('#main').innerHTML = `<div class="page-title">공지 <small>${list.length}개</small></div>` +
      (list.length ? list.map(n => {
        const open = state.openNotice === n.id;
        return `<div class="card" data-id="${n.id}">
          <div class="row"><div class="grow title">${n['고정'] === 'Y' ? '<span class="badge">고정</span> ' : ''}${esc(n['제목'])}</div></div>
          ${open ? `<div class="body">${esc(n['내용'])}</div>` : ''}
          <div class="meta"><span>${esc(n['작성일시'])}</span>${n['작성자'] ? `<span>${esc(n['작성자'])}</span>` : ''}</div>
          ${open ? `<div class="card-actions"><button class="btn-sm" data-edit>수정</button><button class="btn-sm danger" data-del>삭제</button></div>` : ''}
        </div>`; }).join('') : `<div class="empty">아직 공지가 없어요.<br>오른쪽 아래 + 로 첫 공지를 올려보세요.</div>`);
    $$('.card[data-id]', $('#main')).forEach(card => {
      const n = list.find(x => x.id === card.dataset.id);
      card.addEventListener('click', e => {
        if (e.target.closest('[data-edit]')) return openNoticeForm(n);
        if (e.target.closest('[data-del]')) return confirmDelete('공지', n.id, '이 공지를 삭제할까요?');
        state.openNotice = state.openNotice === n.id ? null : n.id; renderNotice();
      });
    });
  }
  function openNoticeForm(cur) {
    openForm({
      title: cur ? '공지 수정' : '새 공지', sheet: '공지', initial: cur || {},
      fields: [
        { key: '제목', label: '제목', type: 'text', required: true },
        { key: '내용', label: '내용', type: 'textarea', required: true },
        { key: '고정', label: '상단에 고정', type: 'check' },
        { key: '작성자', label: '작성자', type: 'text', placeholder: '선택' },
      ],
      after: row => { state.openNotice = row.id; },
    });
  }

  // ───────────────────────── ③ 결단 ─────────────────────────
  function renderResolve() {
    const today = todayStr();
    const all = rows('결단');
    const active = all.filter(r => r['상태'] !== '완료').sort(byAsc('목표일'));
    const done = all.filter(r => r['상태'] === '완료').sort(byDesc('목표일'));
    const card = r => {
      const n = daysBetween(today, r['목표일']);
      const cls = isNaN(n) ? '' : n < 0 ? 'past' : n === 0 ? 'today' : '';
      return `<div class="card resolve-card" data-id="${r.id}">
        <div class="dday ${cls}">${r['상태'] === '완료' ? '완료' : (dday(r['목표일']) || '—')}<small>${fmtShort(r['목표일'])}</small></div>
        <div class="grow">
          <div class="title">${esc(r['제목'])}</div>
          ${r['내용'] ? `<div class="body">${esc(r['내용'])}</div>` : ''}
          <div class="meta">${r['작성자'] ? `<span>${esc(r['작성자'])}</span>` : ''}<span>${fmtKo(r['목표일'])}까지</span></div>
          <div class="card-actions">
            ${r['상태'] === '완료' ? `<button class="btn-sm" data-reopen>다시 진행</button>` : `<button class="btn-sm primary" data-done>완료</button>`}
            <button class="btn-sm" data-edit>수정</button><button class="btn-sm danger" data-del>삭제</button>
          </div>
        </div></div>`;
    };
    $('#main').innerHTML = `<div class="page-title">결단 <small>진행 중 ${active.length}개</small></div>` +
      (active.length ? active.map(card).join('') : `<div class="empty">진행 중인 결단이 없어요.<br>+ 로 결단과 목표일을 적어보세요.</div>`) +
      (done.length ? `<details class="fold"><summary>완료한 결단 ${done.length}개</summary>${done.map(card).join('')}</details>` : '');
    $$('.card[data-id]', $('#main')).forEach(el => {
      const r = all.find(x => x.id === el.dataset.id);
      el.addEventListener('click', e => {
        if (e.target.closest('[data-done]')) return quickSave('결단', { id: r.id, '상태': '완료' }, '완료 처리했어요');
        if (e.target.closest('[data-reopen]')) return quickSave('결단', { id: r.id, '상태': '진행' }, '다시 진행 중이에요');
        if (e.target.closest('[data-edit]')) return openResolveForm(r);
        if (e.target.closest('[data-del]')) return confirmDelete('결단', r.id, '이 결단을 삭제할까요?');
      });
    });
  }
  function openResolveForm(cur) {
    openForm({
      title: cur ? '결단 수정' : '새 결단', sheet: '결단', initial: cur || { '상태': '진행' },
      fields: [
        { key: '제목', label: '결단', type: 'text', required: true, placeholder: '예: 신약 1독 완주' },
        { key: '목표일', label: '목표일', type: 'date', required: true },
        { key: '내용', label: '내용', type: 'textarea', placeholder: '선택' },
        { key: '작성자', label: '작성자', type: 'text', placeholder: '선택' },
      ],
    });
  }

  // ───────────────────────── ④ 캘린더 ─────────────────────────
  function renderCalendar() {
    const m = state.calMonth, y = m.getFullYear(), mo = m.getMonth();
    const first = new Date(y, mo, 1), startDow = first.getDay();
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const today = todayStr();
    const events = rows('일정');
    const byDate = {};
    events.forEach(e => { (byDate[e['날짜']] = byDate[e['날짜']] || []).push(e); });

    let cells = '';
    const total = Math.ceil((startDow + daysInMonth) / 7) * 7;
    for (let i = 0; i < total; i++) {
      const d = new Date(y, mo, i - startDow + 1);
      const s = ymd(d), other = d.getMonth() !== mo;
      const kinds = (byDate[s] || []).map(e => e['종류'] || '기타').filter((v, j, a) => a.indexOf(v) === j).slice(0, 3);
      cells += `<button class="cal-cell ${other ? 'other' : ''} ${d.getDay() === 0 ? 'sun' : ''} ${s === today ? 'today' : ''} ${s === state.calSelected ? 'selected' : ''}" data-date="${s}">
        ${d.getDate()}<span class="dots">${kinds.map(k => `<i class="${k}"></i>`).join('')}</span></button>`;
    }
    const sel = (byDate[state.calSelected] || []).slice().sort(byAsc('시작'));

    $('#main').innerHTML = `
      <div class="cal-head"><button data-nav="-1" aria-label="이전 달">‹</button><div class="month">${y}년 ${mo + 1}월</div><button data-nav="1" aria-label="다음 달">›</button></div>
      <div class="cal-grid">${DOW.map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div>
      <div class="cal-legend"><span><i style="background:var(--fig)"></i>순모임</span><span><i style="background:var(--leaf)"></i>행사</span><span><i style="background:var(--ink-3)"></i>기타</span></div>
      <div class="section-label">${fmtKo(state.calSelected)}${state.calSelected === today ? ' · 오늘' : ''}</div>
      ${sel.length ? sel.map(ev => `<div class="card" data-id="${ev.id}">
          <div class="title">${esc(ev['제목'])} <span class="badge ${kindClass(ev['종류'])}">${esc(ev['종류'] || '기타')}</span></div>
          <div class="meta">${ev['시작'] ? `<span>${esc(ev['시작'])}${ev['종료'] ? '–' + esc(ev['종료']) : ''}</span>` : ''}${ev['장소'] ? `<span>${esc(ev['장소'])}</span>` : ''}</div>
          ${ev['메모'] ? `<div class="body">${esc(ev['메모'])}</div>` : ''}
          <div class="card-actions"><button class="btn-sm" data-edit>수정</button><button class="btn-sm danger" data-del>삭제</button></div>
        </div>`).join('') : `<div class="empty">이 날은 일정이 없어요. + 로 추가할 수 있어요.</div>`}
    `;
    $$('[data-nav]', $('#main')).forEach(b => b.onclick = () => { state.calMonth = new Date(y, mo + +b.dataset.nav, 1); renderCalendar(); });
    $$('.cal-cell', $('#main')).forEach(b => b.onclick = () => {
      state.calSelected = b.dataset.date;
      const d = parseYmd(b.dataset.date); if (d.getMonth() !== mo) state.calMonth = startOfMonth(d);
      renderCalendar();
    });
    $$('.card[data-id]', $('#main')).forEach(el => {
      const ev = events.find(x => x.id === el.dataset.id);
      el.addEventListener('click', e => {
        if (e.target.closest('[data-edit]')) return openEventForm(ev);
        if (e.target.closest('[data-del]')) return confirmDelete('일정', ev.id, '이 일정을 삭제할까요?');
      });
    });
  }
  function openEventForm(cur, dateDefault) {
    openForm({
      title: cur ? '일정 수정' : '새 일정', sheet: '일정', initial: cur || { '날짜': dateDefault || todayStr(), '종류': '순모임' },
      fields: [
        { key: '제목', label: '제목', type: 'text', required: true, placeholder: '예: 순모임' },
        { key: '날짜', label: '날짜', type: 'date', required: true },
        { key: '_time', label: '시간', type: 'timerange' },
        { key: '종류', label: '종류', type: 'select', options: EVENT_KINDS },
        { key: '장소', label: '장소', type: 'text', placeholder: '선택' },
        { key: '메모', label: '메모', type: 'textarea', placeholder: '선택' },
      ],
      after: row => { state.calSelected = row['날짜']; state.calMonth = startOfMonth(parseYmd(row['날짜'])); },
    });
  }

  // ───────────────────────── ⑤ 기도제목 ─────────────────────────
  function renderPrayer() {
    const all = rows('기도제목').slice().sort(byDesc('작성일시'));
    const open = all.filter(p => p['응답'] !== 'Y');
    const done = all.filter(p => p['응답'] === 'Y');
    const card = p => `<div class="card prayer-card" data-id="${p.id}">
        <div class="name">${esc(p['이름'] || '익명')}</div>
        <div class="body">${esc(p['내용'])}</div>
        ${p['응답'] === 'Y' ? `<div class="answer"><b>응답</b>${esc(p['응답메모'] || '응답되었어요')}</div>` : ''}
        <div class="meta"><span>${esc((p['작성일시'] || '').slice(0, 10))}</span></div>
        <div class="card-actions">
          ${p['응답'] === 'Y' ? '' : `<button class="btn-sm primary" data-answer>응답됨</button>`}
          <button class="btn-sm" data-edit>수정</button><button class="btn-sm danger" data-del>삭제</button>
        </div></div>`;
    $('#main').innerHTML = `<div class="page-title">기도제목 <small>${open.length}개</small></div>` +
      (open.length ? open.map(card).join('') : `<div class="empty">나눈 기도제목이 없어요.<br>이름은 안 적어도 괜찮아요.</div>`) +
      (done.length ? `<details class="fold"><summary>응답된 기도 ${done.length}개</summary>${done.map(card).join('')}</details>` : '');
    $$('.card[data-id]', $('#main')).forEach(el => {
      const p = all.find(x => x.id === el.dataset.id);
      el.addEventListener('click', e => {
        if (e.target.closest('[data-answer]')) return openAnswerForm(p);
        if (e.target.closest('[data-edit]')) return openPrayerForm(p);
        if (e.target.closest('[data-del]')) return confirmDelete('기도제목', p.id, '이 기도제목을 삭제할까요?');
      });
    });
  }
  function openPrayerForm(cur) {
    openForm({
      title: cur ? '기도제목 수정' : '기도제목 나누기', sheet: '기도제목', initial: cur || {},
      fields: [
        { key: '내용', label: '기도제목', type: 'textarea', required: true },
        { key: '이름', label: '이름', type: 'text', placeholder: '비우면 익명으로 표시돼요' },
      ],
    });
  }
  function openAnswerForm(p) {
    openForm({
      title: '응답 기록', sheet: '기도제목', initial: { id: p.id, '응답': 'Y' },
      fields: [{ key: '응답메모', label: '어떻게 응답되었나요?', type: 'textarea', placeholder: '선택' }],
      toast: '응답된 기도로 옮겼어요',
    });
  }

  // ───────────────────────── ⑥ 간식 ─────────────────────────
  function renderSnack() {
    const all = rows('간식');
    const cats = ['전체'].concat(SNACK_CATS.filter(c => c !== '기타'), all.map(s => s['카테고리']).filter(c => c && !SNACK_CATS.includes(c)).filter((v, i, a) => a.indexOf(v) === i), ['기타']);
    let list = state.snackCat === '전체' ? all.slice() : all.filter(s => (s['카테고리'] || '기타') === state.snackCat);
    list.sort(state.snackSort === 'taste' ? (a, b) => (+b['맛'] || 0) - (+a['맛'] || 0) || byDesc('작성일시')(a, b) : byDesc('작성일시'));
    $('#main').innerHTML = `<div class="page-title">순간식 <small>${all.length}곳</small></div>
      <div class="chips">${cats.map(c => `<button class="chip ${c === state.snackCat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="sort-row"><button class="${state.snackSort === 'new' ? 'on' : ''}" data-sort="new">최신순</button><button class="${state.snackSort === 'taste' ? 'on' : ''}" data-sort="taste">맛순</button></div>
      <div class="speed-help">속도 별점: 많을수록 빨리 먹고 바로 나눔으로 넘어가기 좋아요</div>` +
      (list.length ? list.map(s => `<div class="card snack-card" data-id="${s.id}">
          <div class="row"><div class="grow"><div class="shop">${esc(s['가게'])}</div><div class="menu">${esc(s['추천메뉴'])}</div></div><span class="badge gray">${esc(s['카테고리'] || '기타')}</span></div>
          <div class="stars-table"><span>양</span>${stars(s['양'])}<span>맛</span>${stars(s['맛'])}<span>속도</span>${stars(s['속도'])}</div>
          ${s['한줄평'] ? `<div class="review">${esc(s['한줄평'])}</div>` : ''}
          <div class="meta">${s['추천인'] ? `<span>${esc(s['추천인'])} 추천</span>` : ''}<span>${esc((s['작성일시'] || '').slice(0, 10))}</span></div>
          <div class="card-actions">
            ${s['링크'] ? `<a class="btn-sm primary" href="${esc(s['링크'])}" target="_blank" rel="noopener" style="text-decoration:none">주문하러 가기</a>` : ''}
            <button class="btn-sm" data-edit>수정</button><button class="btn-sm danger" data-del>삭제</button>
          </div></div>`).join('') : `<div class="empty">${state.snackCat === '전체' ? '아직 추천이 없어요.<br>+ 로 맛있었던 곳을 남겨주세요.' : '이 카테고리에는 아직 추천이 없어요.'}</div>`);
    $$('[data-cat]', $('#main')).forEach(b => b.onclick = () => { state.snackCat = b.dataset.cat; renderSnack(); });
    $$('[data-sort]', $('#main')).forEach(b => b.onclick = () => { state.snackSort = b.dataset.sort; renderSnack(); });
    $$('.card[data-id]', $('#main')).forEach(el => {
      const s = all.find(x => x.id === el.dataset.id);
      el.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        if (e.target.closest('[data-edit]')) return openSnackForm(s);
        if (e.target.closest('[data-del]')) return confirmDelete('간식', s.id, '이 추천을 삭제할까요?');
      });
    });
  }
  function openSnackForm(cur) {
    openForm({
      title: cur ? '추천 수정' : '간식 추천', sheet: '간식', initial: cur || { '카테고리': state.snackCat !== '전체' ? state.snackCat : '치킨', '양': '3', '맛': '3', '속도': '3' },
      fields: [
        { key: '가게', label: '가게 이름', type: 'text', required: true, placeholder: '예: 교촌치킨 역삼점' },
        { key: '카테고리', label: '카테고리', type: 'select-other', options: SNACK_CATS },
        { key: '추천메뉴', label: '추천 메뉴', type: 'text', placeholder: '예: 허니콤보 + 치즈볼' },
        { key: '양', label: '양', type: 'stars' },
        { key: '맛', label: '맛', type: 'stars' },
        { key: '속도', label: '속도', type: 'stars', help: '많을수록 빨리 먹고 바로 나눔 가능' },
        { key: '한줄평', label: '한줄평', type: 'textarea', placeholder: '선택' },
        { key: '추천인', label: '추천인', type: 'text', placeholder: '선택' },
        { key: '링크', label: '배달앱 링크', type: 'url', placeholder: '선택' },
      ],
    });
  }

  // ───────────────────────── 공통 동작 ─────────────────────────
  async function quickSave(sheet, row, msg) {
    loading(true);
    try { await saveRow(sheet, row); toast(msg || '저장했어요'); }
    catch (e) { toast('저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { loading(false); }
  }
  async function confirmDelete(sheet, id, msg) {
    if (!confirm(msg || '삭제할까요?')) return;
    loading(true);
    try { await deleteRow(sheet, id); toast('삭제했어요'); }
    catch (e) { toast('삭제하지 못했어요. 다시 시도해 주세요.'); }
    finally { loading(false); }
  }

  // ───────────────────────── 바텀 시트 폼 ─────────────────────────
  let formSpec = null;
  function openForm(spec) {
    formSpec = spec;
    const init = spec.initial || {};
    $('#sheet-title').textContent = spec.title;
    $('#sheet-error').textContent = '';
    $('#sheet-form').innerHTML = spec.fields.map(f => fieldHtml(f, init)).join('') + (spec.help ? `<div class="help" style="font-size:12px;color:var(--ink-3)">${esc(spec.help)}</div>` : '');
    // 별점 입력
    $$('.star-input', $('#sheet-form')).forEach(wrap => {
      const hidden = $('input[type=hidden]', wrap.parentElement);
      const paint = () => $$('button', wrap).forEach(b => b.classList.toggle('on', +b.dataset.v <= +hidden.value));
      $$('button', wrap).forEach(b => b.onclick = e => { e.preventDefault(); hidden.value = b.dataset.v; paint(); });
      paint();
    });
    // 카테고리 '기타' 선택 시 직접 입력
    $$('[data-other-select]', $('#sheet-form')).forEach(sel => {
      const inp = $('[data-other-input]', sel.parentElement);
      const sync = () => inp.classList.toggle('hidden', sel.value !== '기타');
      sel.onchange = sync; sync();
    });
    $('#sheet-wrap').classList.remove('hidden');
    requestAnimationFrame(() => $('#sheet-wrap').classList.add('open'));
    setTimeout(() => { const f = $('#sheet-form input:not([type=hidden]), #sheet-form textarea'); if (f && !init.id) f.focus(); }, 300);
  }
  function closeForm() {
    $('#sheet-wrap').classList.remove('open');
    setTimeout(() => $('#sheet-wrap').classList.add('hidden'), 250);
    formSpec = null;
  }
  function fieldHtml(f, init) {
    const v = init[f.key] == null ? '' : String(init[f.key]);
    const lab = `<label>${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>`;
    const help = f.help ? `<div class="help">${esc(f.help)}</div>` : '';
    switch (f.type) {
      case 'textarea': return `<div class="field">${lab}<textarea name="${f.key}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>${help}</div>`;
      case 'date': return `<div class="field">${lab}<input type="date" name="${f.key}" value="${esc(v)}">${help}</div>`;
      case 'url': return `<div class="field">${lab}<input type="url" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" inputmode="url">${help}</div>`;
      case 'check': return `<div class="field"><label class="check"><input type="checkbox" name="${f.key}" ${v === 'Y' ? 'checked' : ''}> ${esc(f.label)}</label>${help}</div>`;
      case 'select': return `<div class="field">${lab}<select name="${f.key}">${f.options.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>${help}</div>`;
      case 'select-other': {
        const known = f.options.includes(v) || !v;
        return `<div class="field">${lab}<div class="inline"><select name="${f.key}" data-other-select>${f.options.map(o => `<option ${(known ? o === v : o === '기타') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>
          <input type="text" name="${f.key}__other" data-other-input class="hidden" placeholder="직접 입력" value="${known ? '' : esc(v)}"></div>${help}</div>`;
      }
      case 'stars': return `<div class="field">${lab}<input type="hidden" name="${f.key}" value="${esc(v || '3')}"><div class="star-input">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-v="${n}">★</button>`).join('')}</div>${help}</div>`;
      case 'timerange': return `<div class="field">${lab}<div class="inline"><input type="time" name="시작" value="${esc(init['시작'] || '')}"><input type="time" name="종료" value="${esc(init['종료'] || '')}"></div>${help}</div>`;
      default: return `<div class="field">${lab}<input type="text" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}">${help}</div>`;
    }
  }
  function readForm() {
    const spec = formSpec, form = $('#sheet-form');
    const row = Object.assign({}, spec.initial && spec.initial.id ? { id: spec.initial.id } : {});
    Object.keys(spec.initial || {}).forEach(k => { if (row[k] === undefined && !spec.fields.some(f => f.key === k || f.type === 'timerange' && (k === '시작' || k === '종료'))) row[k] = spec.initial[k]; });
    for (const f of spec.fields) {
      if (f.type === 'timerange') { row['시작'] = form.elements['시작'].value; row['종료'] = form.elements['종료'].value; continue; }
      const el = form.elements[f.key];
      let val;
      if (f.type === 'check') val = el.checked ? 'Y' : '';
      else if (f.type === 'select-other') { val = el.value === '기타' ? (form.elements[f.key + '__other'].value.trim() || '기타') : el.value; }
      else val = (el.value || '').trim();
      if (f.required && !val) throw new Error(f.label + '을(를) 입력해 주세요.');
      row[f.key] = val;
    }
    return row;
  }
  $('#sheet-cancel').onclick = closeForm;
  $('#sheet-backdrop').onclick = closeForm;
  $('#sheet-save').onclick = async () => {
    if (!formSpec) return;
    const btn = $('#sheet-save');
    let row;
    try { row = readForm(); } catch (e) { $('#sheet-error').textContent = e.message; return; }
    btn.disabled = true; btn.textContent = '저장 중…'; $('#sheet-error').textContent = '';
    try {
      const saved = await saveRow(formSpec.sheet, row);
      if (formSpec.after) formSpec.after(saved || row);
      const msg = formSpec.toast || '저장했어요';
      closeForm(); render(); toast(msg);
    } catch (e) {
      $('#sheet-error').textContent = '저장 실패, 다시 시도해 주세요. (' + (e.message || e) + ')';
    } finally { btn.disabled = false; btn.textContent = '저장'; }
  };

  // ───────────────────────── 시작 ─────────────────────────
  function boot() {
    const g = CFG.GROUP_NAME || '', r = CFG.ROOM_NAME || '다락방';
    $('#login-group').textContent = g; $('#login-room').textContent = r;
    $('#hdr-group').textContent = g; $('#hdr-room').textContent = r;
    document.title = r;
    if (PREVIEW) { $('#login-preview-note').classList.remove('hidden'); $('#preview-banner').classList.remove('hidden'); }
    if (state.token) showApp(); else showLogin();
  }
  boot();
})();
