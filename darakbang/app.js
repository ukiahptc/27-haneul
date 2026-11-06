/* 무화과 그룹 박준원 다락방 — 앱 로직 */
(function () {
  'use strict';

  const CFG = window.DARAKBANG_CONFIG || {};
  const PREVIEW = !CFG.API_URL || /[?&]preview=1/.test(location.search); // API 주소 없거나 ?preview=1 이면 미리보기 모드
  const SHEETS = ['공지', '일정', '기도제목', '간식', '암송', '통독', '사진첩'];
  const MAX_PHOTOS = 10, PHOTO_MAX_PX = 1600, PHOTO_QUALITY = 0.85;
  const WEEK_START_DAY = 5; // 주차 시작 요일: 0=일 … 5=금
  const PRAYER_START = CFG.PRAYER_START || '2026-10-30'; // 기도제목 1주차 시작일 (금)
  const SNACK_CATS = ['치킨', '피자', '중식', '분식', '한식', '양식', '카페·디저트', '기타'];
  const EVENT_KINDS = ['순모임', '행사', '기타'];
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  // ── 아이콘 (24x24 선 아이콘)
  const I = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    book: '<path d="M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5z"/><path d="M12 6.5v13"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4.5h6M9 13l2 2 4-4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="4"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/>',
    heart: '<path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z"/>',
    cookie: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/>',
    pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    pinned: '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v6"/>',
    arrow: '<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="4"/><circle cx="9" cy="10" r="1.6"/><path d="M21 15.5l-4.5-4.5-7 7"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  };
  const ic = (name, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${I[name] || ''}</svg>`;
  const bubble = (name, tone) => `<span class="ic-bubble ${tone || ''}">${ic(name)}</span>`;

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
    viewer: null,
    prayerWeek: null, // 선택한 주차(주일 날짜). null이면 이번 주
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
  function endOf(ev) { return ev['종료일'] && ev['종료일'] > ev['날짜'] ? ev['종료일'] : ev['날짜']; }
  function nights(ev) { const n = daysBetween(ev['날짜'], endOf(ev)); return n > 0 ? n : 0; }
  function covers(ev, day) { return ev['날짜'] <= day && day <= endOf(ev); }
  // "11.25 09:00 ~ 11.27 15:00 · 2박 3일" / 하루면 "09:00~11:00"
  function whenLabel(ev) {
    const n = nights(ev);
    if (n) return `${fmtShort(ev['날짜'])}${ev['시작'] ? ' ' + ev['시작'] : ''} ~ ${fmtShort(endOf(ev))}${ev['종료'] ? ' ' + ev['종료'] : ''} · ${n}박 ${n + 1}일`;
    return ev['시작'] ? ev['시작'] + (ev['종료'] ? '~' + ev['종료'] : '') : '';
  }
  // ── 주차 (금요일 시작, 이름은 주가 끝나는 목요일이 속한 달 기준)
  function weekStart(dateStr) { const d = parseYmd(dateStr); if (!d) return ''; d.setDate(d.getDate() - ((d.getDay() - WEEK_START_DAY + 7) % 7)); return ymd(d); }
  function weekLabel(start) { const d = parseYmd(start); if (!d) return ''; d.setDate(d.getDate() + 6); return `${d.getMonth() + 1}월 ${Math.ceil(d.getDate() / 7)}주차`; }
  function weekRange(start) { const a = parseYmd(start); if (!a) return ''; const b = new Date(a); b.setDate(b.getDate() + 6); return `${a.getMonth() + 1}.${a.getDate()}~${b.getMonth() + 1}.${b.getDate()}`; }
  function weekList() { // PRAYER_START부터 다음 주까지의 주일 목록 (오래된 순)
    const list = []; const end = parseYmd(weekStart(todayStr())); end.setDate(end.getDate() + 7);
    for (let d = parseYmd(weekStart(PRAYER_START)); d <= end; d.setDate(d.getDate() + 7)) list.push(ymd(d));
    return list;
  }
  function prayerWeekOf(p) { return weekStart(p['주차'] || (p['작성일시'] || '').slice(0, 10)); } // 어떤 날짜가 들어 있어도 그 주의 시작(금)으로 맞춤
  function byDesc(key) { return (a, b) => String(b[key]).localeCompare(String(a[key])); }
  function byAsc(key) { return (a, b) => String(a[key]).localeCompare(String(b[key])); }

  // ───────────────────────── API ─────────────────────────
  // 미리보기용 파일 저장소 (localStorage). 실제 모드에서는 드라이브 파일 ID를 씀.
  const mockFiles = {
    all() { try { return JSON.parse(localStorage.getItem('dk_mock_files') || '{}'); } catch (_) { return {}; } },
    get(id) { return this.all()[id] || ''; },
    put(id, url) { const m = this.all(); m[id] = url; try { localStorage.setItem('dk_mock_files', JSON.stringify(m)); } catch (_) { toast('미리보기 저장 공간이 부족해요'); } },
  };
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
      upload: (name, mime, data) => post({ action: 'upload', name, mime, data, token: state.token }),
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
      // 미리보기에서는 드라이브 대신 data URL을 그대로 파일 ID로 사용
      upload: async (name, mime, data) => { await wait(400); const id = 'mock-' + Math.random().toString(36).slice(2, 9); mockFiles.put(id, 'data:' + mime + ';base64,' + data); return { ok: true, fileId: id }; },
    };
  }

  function sampleData() {
    const t = new Date();
    const d = n => { const x = new Date(t); x.setDate(x.getDate() + n); return ymd(x); };
    return {
      '공지': [
        { id: 'n1', '작성일시': d(-2) + ' 21:10', '제목': '이번 주 순모임 장소 변경', '내용': '이번 주는 교회 2층 세미나실 대신 카페 그린에서 모입니다.\n7시 30분까지 와주세요.', '고정': 'Y', '작성자': '준원' },
        { id: 'n2', '작성일시': d(-6) + ' 09:00', '제목': '겨울 수련회 참가 신청', '내용': '12월 수련회 참가 신청을 받습니다. 캘린더에서 날짜 확인하고 신청해 주세요.', '고정': '', '작성자': '준원' },
      ],
      '일정': [
        { id: 'e1', '날짜': d(0), '시작': '19:30', '종료': '21:30', '제목': '순모임', '장소': '카페 그린', '종류': '순모임', '메모': '' },
        { id: 'e2', '날짜': d(7), '시작': '19:30', '종료': '21:30', '제목': '순모임', '장소': '교회 2층', '종류': '순모임', '메모': '' },
        { id: 'e3', '날짜': d(12), '시작': '10:00', '종료': '', '제목': '그룹 연합 예배', '장소': '본당', '종류': '행사', '메모': '무화과 그룹 전체' },
        { id: 'e4', '날짜': d(23), '종료일': d(25), '시작': '09:00', '종료': '', '제목': '겨울 수련회', '장소': '양평 수양관', '종류': '행사', '메모': '2박 3일' },
      ],
      '기도제목': [
        { id: 'p1', '작성일시': d(-1) + ' 22:00', '주차': '', '이름': '', '내용': '다음 주 면접 잘 볼 수 있도록', '응답': '', '응답메모': '' },
        { id: 'p2', '작성일시': d(-3) + ' 22:00', '주차': '', '이름': 'J', '내용': '어머니 수술 회복', '응답': '', '응답메모': '' },
        { id: 'p3', '작성일시': d(-15) + ' 22:00', '주차': '', '이름': '', '내용': '이직 결정에 지혜를', '응답': 'Y', '응답메모': '좋은 곳으로 결정했어요. 감사합니다.' },
      ],
      '간식': [
        { id: 's1', '작성일시': d(-4) + ' 21:00', '가게': '교촌치킨 역삼점', '카테고리': '치킨', '추천메뉴': '허니콤보 + 치즈볼', '양': '4', '맛': '5', '속도': '3', '한줄평': '맛은 보장. 뼈 때문에 나눔 중에 먹기엔 좀 번거로움.', '추천인': '준원', '링크': '' },
        { id: 's2', '작성일시': d(-11) + ' 21:00', '가게': '김밥천국 선릉점', '카테고리': '분식', '추천메뉴': '참치김밥, 떡볶이', '양': '5', '맛': '3', '속도': '5', '한줄평': '빨리 오고 빨리 먹고 바로 나눔 가능. 가성비 최고.', '추천인': 'H', '링크': '' },
        { id: 's3', '작성일시': d(-18) + ' 21:00', '가게': '피자스쿨', '카테고리': '피자', '추천메뉴': '고구마피자 L', '양': '3', '맛': '3', '속도': '4', '한줄평': '무난. 8명 넘으면 두 판.', '추천인': '', '링크': '' },
      ],
      '암송': [
        { id: 'v1', '시작일': d(-3), '구절': '시편 1:2', '본문': '오직 여호와의 율법을 즐거워하여 그의 율법을 주야로 묵상하는도다' },
      ],
      '사진첩': [
        { id: 'ph1', '작성일시': d(-2) + ' 21:40', '설명': '카페 그린에서 순모임', '파일IDs': samplePhotos(3).join(','), '작성자': '준원' },
        { id: 'ph2', '작성일시': d(-9) + ' 22:10', '설명': '연합예배 뒤풀이', '파일IDs': samplePhotos(5, 1).join(','), '작성자': '' },
      ],
      '통독': [
        { id: 't1', '날짜': d(-1), '범위': '마태복음 5-7장' },
        { id: 't2', '날짜': d(0), '범위': '마태복음 8-10장' },
        { id: 't3', '날짜': d(1), '범위': '마태복음 11-13장' },
      ],
    };
  }

  // 미리보기용 자리표시 이미지. SVG를 저장소에 넣고 id 목록 반환
  function samplePhotos(n, seed) {
    const colors = ['#6B2D5C', '#5B7A4E', '#D98E9A', '#8A4A7A', '#A8B59B', '#EADDE6'];
    return Array.from({ length: n }, (_, i) => {
      return 'mock-sample-' + (i + (seed || 0)) % colors.length;
    });
  }
  function sampleSvg(k) {
    const colors = ['#6B2D5C', '#5B7A4E', '#D98E9A', '#8A4A7A', '#A8B59B', '#EADDE6'];
    const c = colors[k % colors.length];
    return 'data:image/svg+xml;base64,' + btoa(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='400' height='400' fill='${c}'/><circle cx='200' cy='230' r='90' fill='rgba(255,255,255,.25)'/></svg>`);
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
  function photoUrl(id, w) {
    id = String(id || '').trim();
    if (!id) return '';
    if (id.startsWith('mock-sample-')) return sampleSvg(+id.slice(12) || 0);
    if (id.startsWith('mock-')) return mockFiles.get(id);
    if (id.startsWith('http')) return id;
    return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 400);
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
  const TABS = { home: renderHome, notice: renderNotice, photos: renderPhotos, calendar: renderCalendar, prayer: renderPrayer, snack: renderSnack };
  const FAB_ACTION = { notice: () => openNoticeForm(), photos: () => openPhotoForm(), calendar: () => openEventForm(null, state.calSelected), prayer: () => openPrayerForm(), snack: () => openSnackForm() };

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
    const upcoming = rows('일정').filter(r => endOf(r) >= today && daysBetween(today, r['날짜']) <= 30).sort((a, b) => (a['날짜'] + a['시작']).localeCompare(b['날짜'] + b['시작'])).slice(0, 5);
    const att = CFG.ATTENDANCE_URL;

    $('#main').innerHTML = `
      <div class="today-line">${ic('sun')} ${fmtKo(today)}</div>
      <div class="dash-grid">
        <div class="card fig span2">
          <div class="kicker">${bubble('book', 'white')} 오늘 통독</div>
          ${reading ? `<div class="reading">${esc(reading['범위'])}</div>` : `<div class="muted">오늘 통독 범위가 등록되지 않았어요</div>`}
        </div>
        <div class="card span2">
          <div class="kicker">${bubble('sparkle', 'butter')} 이번 주 암송</div>
          ${verse ? `<div class="verse-ref">${esc(verse['구절'])}</div><div class="verse-text">${esc(verse['본문'])}</div>` : `<div class="muted">암송 구절이 등록되지 않았어요</div>`}
          <div class="card-actions" style="border:0;padding-top:6px;margin-top:4px">
            <button class="btn-sm" data-act="verse">${verse ? '암송 바꾸기' : '암송 등록'}</button>
            <button class="btn-sm" data-act="reading">통독 입력</button>
          </div>
        </div>
        <a class="link-btn span2 ${att ? '' : 'disabled'}" href="${esc(att || '#')}" target="_blank" rel="noopener">
          ${ic('clipboard')}<span>${att ? '출석부 열기' : '출석부 주소가 설정되지 않았어요'}</span>${ic('arrow')}
        </a>
      </div>

      <div class="section-label">${ic('calendar')} 다가오는 일정</div>
      <div class="card">
        ${upcoming.length ? upcoming.map(ev => {
          const d = parseYmd(ev['날짜']); const isToday = covers(ev, today);
          return `<div class="event-line">
            <div class="date ${isToday ? 'today' : ''}"><b>${d.getDate()}</b><span>${isToday ? (nights(ev) ? '진행 중' : '오늘') : (d.getMonth() + 1) + '월 ' + DOW[d.getDay()]}</span></div>
            <div class="what"><div class="t">${esc(ev['제목'])} <span class="badge ${kindClass(ev['종류'])}">${esc(ev['종류'] || '기타')}</span></div>
            <div class="s">${[whenLabel(ev) && ic('clock') + ' ' + esc(whenLabel(ev)), ev['장소'] && ic('pin') + ' ' + esc(ev['장소'])].filter(Boolean).join(' &nbsp; ')}</div></div>
          </div>`; }).join('') : `<div class="muted" style="text-align:center;padding:8px 0">${ic('calendar')} 예정된 일정이 없어요</div>`}
      </div>

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
    $('#main').innerHTML = `<div class="page-title">${bubble('bell')} 공지 <small>${list.length}개</small></div>` +
      (list.length ? list.map(n => {
        const open = state.openNotice === n.id;
        return `<div class="card" data-id="${n.id}">
          <div class="row"><div class="grow title">${n['고정'] === 'Y' ? `<span class="badge">${ic('pinned')}고정</span> ` : ''}${esc(n['제목'])}</div></div>
          ${open ? `<div class="body">${esc(n['내용'])}</div>` : ''}
          <div class="meta"><span>${ic('clock')}${esc(n['작성일시'])}</span>${n['작성자'] ? `<span>${ic('user')}${esc(n['작성자'])}</span>` : ''}</div>
          ${open ? `<div class="card-actions"><button class="btn-sm" data-edit>수정</button><button class="btn-sm danger" data-del>삭제</button></div>` : ''}
        </div>`; }).join('') : `<div class="empty">${bubble('bell')}아직 공지가 없어요.<br>오른쪽 아래 + 로 첫 공지를 올려보세요.</div>`);
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

  // ───────────────────────── ③ 사진첩 ─────────────────────────
  function photoIds(p) { return String(p['파일IDs'] || '').split(',').map(x => x.trim()).filter(Boolean); }

  function renderPhotos() {
    const list = rows('사진첩').slice().sort(byDesc('작성일시'));
    $('#main').innerHTML = `<div class="page-title">${bubble('camera', 'flesh')} 사진첩 <small>${list.length}개 게시글</small></div>` +
      (list.length ? list.map(p => {
        const ids = photoIds(p);
        const shown = ids.slice(0, 6);
        const cls = ids.length === 1 ? 'one' : ids.length === 2 || ids.length === 4 ? 'two' : '';
        return `<div class="card photo-card" data-id="${p.id}">
          ${p['설명'] ? `<div class="caption">${esc(p['설명'])}</div>` : ''}
          <div class="photo-grid ${cls}">${shown.map((id, i) => `<button data-view="${i}"><img src="${esc(photoUrl(id, 400))}" alt="" loading="lazy">${i === 5 && ids.length > 6 ? `<span class="more">+${ids.length - 6}</span>` : ''}</button>`).join('')}</div>
          <div class="meta"><span>${ic('clock')}${esc((p['작성일시'] || '').slice(0, 10))}</span>${p['작성자'] ? `<span>${ic('user')}${esc(p['작성자'])}</span>` : ''}<span>${ic('image')}${ids.length}장</span></div>
          <div class="card-actions"><button class="btn-sm" data-edit>설명 수정</button><button class="btn-sm danger" data-del>삭제</button></div>
        </div>`; }).join('') : `<div class="empty">${bubble('image', 'flesh')}아직 사진이 없어요.<br>+ 로 다락방 사진을 올려보세요.</div>`);
    $$('.card[data-id]', $('#main')).forEach(el => {
      const p = list.find(x => x.id === el.dataset.id);
      el.addEventListener('click', e => {
        const v = e.target.closest('[data-view]');
        if (v) return openViewer(photoIds(p), +v.dataset.view, p['설명']);
        if (e.target.closest('[data-edit]')) return openPhotoForm(p);
        if (e.target.closest('[data-del]')) return confirmDelete('사진첩', p.id, '이 게시글과 사진 ' + photoIds(p).length + '장을 삭제할까요?');
      });
    });
  }

  function openPhotoForm(cur) {
    openForm({
      title: cur ? '설명 수정' : '사진 올리기', sheet: '사진첩', initial: cur || {},
      fields: [
        ...(cur ? [] : [{ key: '_files', label: '사진 (최대 ' + MAX_PHOTOS + '장)', type: 'files', required: true }]),
        { key: '설명', label: '설명', type: 'textarea', placeholder: '선택' },
        { key: '작성자', label: '올린 사람', type: 'text', placeholder: '선택' },
      ],
      // 저장 직전: 사진을 줄여서 하나씩 업로드하고 파일 ID 목록을 행에 넣음
      beforeSave: async (row, form, progress) => {
        if (cur) return row;
        const files = Array.from(form.elements['_files'].files || []).slice(0, MAX_PHOTOS);
        if (!files.length) throw new Error('사진을 선택해 주세요.');
        const ids = [];
        for (let i = 0; i < files.length; i++) {
          progress(`${i + 1} / ${files.length}장 올리는 중…`);
          const b64 = await shrinkImage(files[i]);
          const r = await api.upload('darakbang-' + Date.now() + '-' + (i + 1) + '.jpg', 'image/jpeg', b64);
          if (!r.ok || !r.fileId) throw new Error(r.error || '업로드 실패');
          ids.push(r.fileId);
        }
        progress('게시글 저장 중…');
        row['파일IDs'] = ids.join(',');
        return row;
      },
    });
  }

  // 사진을 긴 변 PHOTO_MAX_PX 이하 JPEG로 줄여 base64 반환
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, PHOTO_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', PHOTO_QUALITY).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없어요: ' + file.name)); };
      img.src = url;
    });
  }

  // ── 크게 보기
  function openViewer(ids, index, caption) {
    state.viewer = { ids, index, caption };
    $('#viewer').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    paintViewer();
  }
  function paintViewer() {
    const v = state.viewer; if (!v) return;
    $('#viewer-img').src = photoUrl(v.ids[v.index], 1600);
    $('#viewer-count').textContent = (v.index + 1) + ' / ' + v.ids.length;
    $('#viewer-cap').textContent = v.caption || '';
  }
  function closeViewer() { state.viewer = null; $('#viewer').classList.add('hidden'); $('#viewer-img').src = ''; document.body.style.overflow = ''; }
  $('#viewer-close').onclick = closeViewer;
  $('#viewer-stage').addEventListener('click', e => {
    const v = state.viewer; if (!v) return;
    const x = e.clientX / window.innerWidth;
    if (x < 0.3) v.index = (v.index - 1 + v.ids.length) % v.ids.length;
    else if (x > 0.7) v.index = (v.index + 1) % v.ids.length;
    else return closeViewer();
    paintViewer();
  });
  let touchX = null;
  $('#viewer-stage').addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  $('#viewer-stage').addEventListener('touchend', e => {
    const v = state.viewer; if (!v || touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) < 40) return;
    v.index = (v.index + (dx < 0 ? 1 : -1) + v.ids.length) % v.ids.length; paintViewer();
  }, { passive: true });

  // ───────────────────────── ④ 캘린더 ─────────────────────────
  function renderCalendar() {
    const m = state.calMonth, y = m.getFullYear(), mo = m.getMonth();
    const first = new Date(y, mo, 1), startDow = first.getDay();
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const today = todayStr();
    const events = rows('일정');
    const byDate = {};
    events.forEach(e => {
      const d0 = parseYmd(e['날짜']), d1 = parseYmd(endOf(e));
      if (!d0) return;
      for (let x = new Date(d0); x <= (d1 || d0); x.setDate(x.getDate() + 1)) { const k = ymd(x); (byDate[k] = byDate[k] || []).push(e); }
    });

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
      <div class="cal-wrap"><div class="cal-grid">${DOW.map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div>
      <div class="cal-legend"><span><i style="background:var(--fig)"></i>순모임</span><span><i style="background:var(--leaf)"></i>행사</span><span><i style="background:var(--ink-3)"></i>기타</span></div></div>
      <div class="section-label">${ic('calendar')} ${fmtKo(state.calSelected)}${state.calSelected === today ? ' · 오늘' : ''}</div>
      ${sel.length ? sel.map(ev => `<div class="card" data-id="${ev.id}">
          <div class="title">${esc(ev['제목'])} <span class="badge ${kindClass(ev['종류'])}">${esc(ev['종류'] || '기타')}</span></div>
          <div class="meta">${whenLabel(ev) ? `<span>${ic('clock')}${esc(whenLabel(ev))}</span>` : ''}${ev['장소'] ? `<span>${ic('pin')}${esc(ev['장소'])}</span>` : ''}</div>
          ${ev['메모'] ? `<div class="body">${esc(ev['메모'])}</div>` : ''}
          <div class="card-actions"><button class="btn-sm" data-edit>수정</button><button class="btn-sm danger" data-del>삭제</button></div>
        </div>`).join('') : `<div class="empty">${bubble('calendar', 'leaf')}이 날은 일정이 없어요.<br>+ 로 추가할 수 있어요.</div>`}
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
        { key: '_start', label: '시작', type: 'datetime', dateName: '날짜', timeName: '시작', required: true },
        { key: '_end', label: '종료', type: 'datetime', dateName: '종료일', timeName: '종료', help: '하루 일정이면 종료 날짜는 비워두세요' },
        { key: '종류', label: '종류', type: 'select', options: EVENT_KINDS },
        { key: '장소', label: '장소', type: 'text', placeholder: '선택' },
        { key: '메모', label: '메모', type: 'textarea', placeholder: '선택' },
      ],
      after: row => { state.calSelected = row['날짜']; state.calMonth = startOfMonth(parseYmd(row['날짜'])); },
    });
  }

  // ───────────────────────── ⑤ 기도제목 ─────────────────────────
  function renderPrayer() {
    const weeks = weekList();
    const thisWeek = weekStart(todayStr());
    if (!state.prayerWeek) state.prayerWeek = weeks.includes(thisWeek) ? thisWeek : weeks[weeks.length - 1];
    const everything = rows('기도제목');
    const all = (state.prayerWeek === 'all' ? everything : everything.filter(p => prayerWeekOf(p) === state.prayerWeek)).slice().sort(byDesc('작성일시'));
    const open = all.filter(p => p['응답'] !== 'Y');
    const done = all.filter(p => p['응답'] === 'Y');
    const countOf = w => everything.filter(p => prayerWeekOf(p) === w).length;
    const chips = `<div class="chips week-chips">${weeks.map(w => `<button class="chip ${w === state.prayerWeek ? 'on' : ''}" data-week="${w}">${weekLabel(w)}${w === thisWeek ? ' · 이번 주' : ''}${countOf(w) ? `<em>${countOf(w)}</em>` : ''}</button>`).join('')}<button class="chip ${state.prayerWeek === 'all' ? 'on' : ''}" data-week="all">전체</button></div>
      <div class="week-range">${state.prayerWeek === 'all' ? `전체 ${everything.length}개` : `${ic('calendar')} ${weekRange(state.prayerWeek)}`}</div>`;
    const card = p => `<div class="card prayer-card" data-id="${p.id}">
        <div class="name">${ic('user')}${esc(p['이름'] || '익명')}</div>
        <div class="body">${esc(p['내용'])}</div>
        ${p['응답'] === 'Y' ? `<div class="answer"><b>${ic('check')}응답</b>${esc(p['응답메모'] || '응답되었어요')}</div>` : ''}
        <div class="meta"><span>${ic('calendar')}${esc(weekLabel(prayerWeekOf(p)))}</span><span>${ic('clock')}${esc((p['작성일시'] || '').slice(0, 10))}</span></div>
        <div class="card-actions">
          ${p['응답'] === 'Y' ? '' : `<button class="btn-sm primary" data-answer>응답됨</button>`}
          <button class="btn-sm" data-edit>수정</button><button class="btn-sm danger" data-del>삭제</button>
        </div></div>`;
    $('#main').innerHTML = `<div class="page-title">${bubble('heart', 'flesh')} 기도제목 <small>${open.length}개</small></div>` + chips +
      (open.length ? open.map(card).join('') : `<div class="empty">${bubble('heart', 'flesh')}${state.prayerWeek === 'all' ? '나눈 기도제목이 없어요.' : weekLabel(state.prayerWeek) + '에 나눈 기도제목이 없어요.'}<br>이름은 안 적어도 괜찮아요.</div>`) +
      (done.length ? `<details class="fold"><summary>응답된 기도 ${done.length}개</summary>${done.map(card).join('')}</details>` : '');
    $$('[data-week]', $('#main')).forEach(b => b.onclick = () => { state.prayerWeek = b.dataset.week; renderPrayer(); });
    const on = $('.week-chips .chip.on', $('#main')); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
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
      title: cur ? '기도제목 수정' : '기도제목 나누기', sheet: '기도제목',
      initial: cur ? Object.assign({}, cur, { '주차': prayerWeekOf(cur) }) : { '주차': state.prayerWeek && state.prayerWeek !== 'all' ? state.prayerWeek : weekStart(todayStr()) },
      fields: [
        { key: '주차', label: '주차', type: 'select', options: weekList().slice().reverse(), labels: w => `${weekLabel(w)} (${weekRange(w)})`, required: true },
        { key: '내용', label: '기도제목', type: 'textarea', required: true },
        { key: '이름', label: '이름', type: 'text', placeholder: '비우면 익명으로 표시돼요' },
      ],
      after: row => { state.prayerWeek = row['주차'] || state.prayerWeek; },
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
    $('#main').innerHTML = `<div class="page-title">${bubble('cookie', 'butter')} 순간식 <small>${all.length}곳</small></div>
      <div class="chips">${cats.map(c => `<button class="chip ${c === state.snackCat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="sort-row"><button class="${state.snackSort === 'new' ? 'on' : ''}" data-sort="new">최신순</button><button class="${state.snackSort === 'taste' ? 'on' : ''}" data-sort="taste">맛순</button></div>
      <div class="speed-help">${ic('clock')} 속도 별점: 많을수록 빨리 먹고 바로 나눔으로 넘어가기 좋아요</div>` +
      (list.length ? list.map(s => `<div class="card snack-card" data-id="${s.id}">
          <div class="row"><div class="grow"><div class="shop">${esc(s['가게'])}</div><div class="menu">${esc(s['추천메뉴'])}</div></div><span class="badge gray">${esc(s['카테고리'] || '기타')}</span></div>
          <div class="stars-table"><span>양</span>${stars(s['양'])}<span>맛</span>${stars(s['맛'])}<span>속도</span>${stars(s['속도'])}</div>
          ${s['한줄평'] ? `<div class="review">${esc(s['한줄평'])}</div>` : ''}
          <div class="meta">${s['추천인'] ? `<span>${ic('user')}${esc(s['추천인'])} 추천</span>` : ''}<span>${ic('clock')}${esc((s['작성일시'] || '').slice(0, 10))}</span></div>
          <div class="card-actions">
            ${s['링크'] ? `<a class="btn-sm primary" href="${esc(s['링크'])}" target="_blank" rel="noopener" style="text-decoration:none">${ic('link')}주문하러 가기</a>` : ''}
            <button class="btn-sm" data-edit>수정</button><button class="btn-sm danger" data-del>삭제</button>
          </div></div>`).join('') : `<div class="empty">${bubble('cookie', 'butter')}${state.snackCat === '전체' ? '아직 추천이 없어요.<br>+ 로 맛있었던 곳을 남겨주세요.' : '이 카테고리에는 아직 추천이 없어요.'}</div>`);
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
    const sheetIcon = { '공지': 'bell', '사진첩': 'camera', '일정': 'calendar', '기도제목': 'heart', '간식': 'cookie', '암송': 'sparkle', '통독': 'book' }[spec.sheet] || 'sparkle';
    $('#sheet-title').innerHTML = ic(sheetIcon) + ' ' + esc(spec.title);
    $('#sheet-error').textContent = '';
    $('#sheet-form').innerHTML = spec.fields.map(f => fieldHtml(f, init)).join('') + (spec.help ? `<div class="help" style="font-size:12px;color:var(--ink-3)">${esc(spec.help)}</div>` : '');
    // 별점 입력
    $$('.star-input', $('#sheet-form')).forEach(wrap => {
      const hidden = $('input[type=hidden]', wrap.parentElement);
      const paint = () => $$('button', wrap).forEach(b => b.classList.toggle('on', +b.dataset.v <= +hidden.value));
      $$('button', wrap).forEach(b => b.onclick = e => { e.preventDefault(); hidden.value = b.dataset.v; paint(); });
      paint();
    });
    // 기간 입력 시 "n박 n+1일" 안내
    const dr = $('input[name=종료일]', $('#sheet-form'));
    if (dr) {
      const a = $('input[name=날짜]', $('#sheet-form')), h = $('.range-help', $('#sheet-form'));
      const paintRange = () => { const n = a.value && dr.value ? daysBetween(a.value, dr.value) : 0; h.textContent = n > 0 ? `${n}박 ${n + 1}일` : (n < 0 ? '종료일이 시작일보다 앞서 있어요' : ''); };
      a.onchange = dr.onchange = paintRange; paintRange();
    }
    // 사진 선택 시 미리보기
    $$('input[type=file]', $('#sheet-form')).forEach(inp => {
      inp.onchange = () => {
        const box = $('.file-previews', inp.closest('.file-pick'));
        const files = Array.from(inp.files || []);
        box.innerHTML = files.slice(0, MAX_PHOTOS).map(f => `<div><img src="${URL.createObjectURL(f)}" alt=""></div>`).join('');
        $('label.pick span', inp.closest('.file-pick')).textContent = files.length ? `${Math.min(files.length, MAX_PHOTOS)}장 선택됨 · 다시 선택` : '사진 선택';
        if (files.length > MAX_PHOTOS) toast('최대 ' + MAX_PHOTOS + '장까지만 올라가요');
      };
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
      case 'select': return `<div class="field">${lab}<select name="${f.key}">${f.options.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(f.labels ? f.labels(o) : o)}</option>`).join('')}</select>${help}</div>`;
      case 'select-other': {
        const known = f.options.includes(v) || !v;
        return `<div class="field">${lab}<div class="inline"><select name="${f.key}" data-other-select>${f.options.map(o => `<option ${(known ? o === v : o === '기타') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>
          <input type="text" name="${f.key}__other" data-other-input class="hidden" placeholder="직접 입력" value="${known ? '' : esc(v)}"></div>${help}</div>`;
      }
      case 'stars': return `<div class="field">${lab}<input type="hidden" name="${f.key}" value="${esc(v || '3')}"><div class="star-input">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-v="${n}">★</button>`).join('')}</div>${help}</div>`;
      case 'files': return `<div class="field">${lab}<div class="file-pick"><label class="pick">${ic('camera')}<span>사진 선택</span><input type="file" name="${f.key}" accept="image/*" multiple></label><div class="file-previews"></div><div class="upload-progress"></div></div>${help}</div>`;
      case 'timerange': return `<div class="field">${lab}<div class="inline"><input type="time" name="시작" value="${esc(init['시작'] || '')}"><input type="time" name="종료" value="${esc(init['종료'] || '')}"></div>${help}</div>`;
      case 'datetime': {
        const dv = f.dateName === '종료일' ? (init['종료일'] && init['종료일'] > init['날짜'] ? init['종료일'] : '') : (init[f.dateName] || '');
        return `<div class="field">${lab}<div class="inline"><input type="date" name="${f.dateName}" value="${esc(dv)}" style="flex:3"><input type="time" name="${f.timeName}" value="${esc(init[f.timeName] || '')}" style="flex:2"></div>${f.dateName === '종료일' ? '<div class="help range-help"></div>' : ''}${help}</div>`;
      }
      default: return `<div class="field">${lab}<input type="text" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}">${help}</div>`;
    }
  }
  function readForm() {
    const spec = formSpec, form = $('#sheet-form');
    const row = Object.assign({}, spec.initial && spec.initial.id ? { id: spec.initial.id } : {});
    Object.keys(spec.initial || {}).forEach(k => { if (row[k] === undefined && !spec.fields.some(f => f.key === k || f.type === 'timerange' && (k === '시작' || k === '종료') || f.type === 'datetime' && (k === f.dateName || k === f.timeName))) row[k] = spec.initial[k]; });
    for (const f of spec.fields) {
      if (f.type === 'timerange') { row['시작'] = form.elements['시작'].value; row['종료'] = form.elements['종료'].value; continue; }
      if (f.type === 'datetime') {
        const d = form.elements[f.dateName].value, t = form.elements[f.timeName].value;
        if (f.dateName === '날짜') {
          if (!d) throw new Error('시작 날짜를 입력해 주세요.');
          row['날짜'] = d; row['시작'] = t;
        } else {
          const a = row['날짜'];
          if (d && d < a) throw new Error('종료가 시작보다 앞설 수 없어요.');
          if ((!d || d === a) && t && row['시작'] && t < row['시작']) throw new Error('종료 시간이 시작 시간보다 앞서 있어요.');
          row['종료일'] = d && d > a ? d : ''; row['종료'] = t;
        }
        continue;
      }
      if (f.type === 'files') { if (f.required && !(form.elements[f.key].files || []).length) throw new Error('사진을 선택해 주세요.'); continue; }
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
    const spec = formSpec;
    const progress = msg => { const el = $('.upload-progress', $('#sheet-form')); if (el) el.textContent = msg; btn.textContent = msg || '저장 중…'; };
    try {
      if (spec.beforeSave) row = await spec.beforeSave(row, $('#sheet-form'), progress);
      if (formSpec !== spec) return; // 업로드 중 폼이 닫힘
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
