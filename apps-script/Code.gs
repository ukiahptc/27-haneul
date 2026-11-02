/**
 * 무화과 그룹 박준원 다락방 — 구글 시트 백엔드
 *
 * 설치 순서
 *  1. 새 구글 시트 → 확장 프로그램 → Apps Script → 이 코드 전체 붙여넣기
 *  2. 왼쪽 톱니(프로젝트 설정) → 스크립트 속성 → PASSWORD 추가 (입장 비밀번호)
 *  3. 상단 함수 선택에서 setup 고르고 ▶ 실행 (권한 허용: 시트 + 드라이브) → 탭 자동 생성
 *     (코드를 새로 붙여넣은 뒤에도 setup을 한 번 더 실행하면 새 탭과 사진 폴더가 생김)
 *  4. 배포 → 새 배포 → 유형: 웹 앱 / 실행 사용자: 나 / 액세스: 모든 사용자 → 배포
 *  5. 나온 웹 앱 URL을 사이트 config.js의 API_URL에 붙여넣기
 */

const TZ = 'Asia/Seoul';

// 탭 이름 → 열 목록. 첫 열 id, 마지막 열 삭제 고정.
const SCHEMA = {
  '공지':     ['id', '작성일시', '제목', '내용', '고정', '작성자', '삭제'],
  '일정':     ['id', '날짜', '종료일', '시작', '종료', '제목', '장소', '종류', '메모', '삭제'],
  '기도제목': ['id', '작성일시', '이름', '내용', '응답', '응답메모', '삭제'],
  '간식':     ['id', '작성일시', '가게', '카테고리', '추천메뉴', '양', '맛', '속도', '한줄평', '추천인', '링크', '삭제'],
  '암송':     ['id', '시작일', '구절', '본문', '삭제'],
  '통독':     ['id', '날짜', '범위', '삭제'],
  '사진첩':   ['id', '작성일시', '설명', '파일IDs', '작성자', '삭제'],
};

// ───────────────────────── 설치 ─────────────────────────

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const cols = SCHEMA[name];
    migrate_(sh, cols); // 열 구조가 바뀐 탭은 기존 데이터를 이름 기준으로 옮김
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // 날짜·시간을 구글이 멋대로 바꾸지 않도록 전체를 텍스트 서식으로
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
  });
  photoFolder_(); // 사진첩 폴더 준비
  const first = ss.getSheets()[0];
  if (first.getName() === '시트1' || first.getName() === 'Sheet1') {
    if (first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  }
}

// 기존 탭의 제목 행이 SCHEMA와 다르면, 열 이름 기준으로 데이터를 새 순서로 다시 씀
function migrate_(sh, cols) {
  const lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
  if (lastCol === 0 || lastRow === 0) return;
  const oldCols = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  if (oldCols.join('\u0001') === cols.join('\u0001')) return;
  if (!oldCols.includes('id')) return; // 우리가 만든 탭이 아니면 손대지 않음
  const data = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
  const moved = data.map(r => cols.map(c => { const i = oldCols.indexOf(c); return i === -1 ? '' : r[i]; }));
  sh.getRange(1, 1, lastRow, Math.max(lastCol, cols.length)).clearContent();
  if (moved.length) sh.getRange(2, 1, moved.length, cols.length).setValues(moved);
}

// ───────────────────────── 인증 ─────────────────────────

function expectedToken_() {
  const pw = PropertiesService.getScriptProperties().getProperty('PASSWORD');
  if (!pw) throw new Error('스크립트 속성에 PASSWORD가 없습니다.');
  return tokenOf_(pw);
}

function tokenOf_(pw) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw + '|darakbang', Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function checkToken_(token) {
  return !!token && token === expectedToken_();
}

// ───────────────────────── HTTP 진입점 ─────────────────────────

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'login') {
      const ok = tokenOf_(String(p.password || '')) === expectedToken_();
      return json_({ ok, token: ok ? expectedToken_() : null });
    }
    if (!checkToken_(p.token)) return json_({ ok: false, error: 'unauthorized' });

    if (p.action === 'list') return json_({ ok: true, rows: readSheet_(p.sheet) });
    if (p.action === 'all') {
      const data = {};
      Object.keys(SCHEMA).forEach(n => data[n] = readSheet_(n));
      return json_({ ok: true, data });
    }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (_) {}
  try {
    if (!checkToken_(body.token)) return json_({ ok: false, error: 'unauthorized' });
    if (body.action === 'save')   return json_({ ok: true, row: saveRow_(body.sheet, body.row || {}) });
    if (body.action === 'delete') return json_({ ok: deleteRow_(body.sheet, body.id) });
    if (body.action === 'upload') return json_({ ok: true, fileId: uploadPhoto_(body.name, body.mime, body.data) });
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────── 읽기/쓰기 ─────────────────────────

function sheetOf_(name) {
  if (!SCHEMA[name]) throw new Error('없는 탭: ' + name);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('탭이 없습니다. setup을 먼저 실행하세요: ' + name);
  return sh;
}

function readSheet_(name) {
  const sh = sheetOf_(name);
  const cols = SCHEMA[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  const rows = [];
  values.forEach(v => {
    const row = {};
    cols.forEach((c, i) => row[c] = cell_(v[i]));
    if (!row.id || row['삭제'] === 'Y') return;
    rows.push(row);
  });
  return rows;
}

// 셀 값을 문자열로. 구글이 날짜/시간으로 바꿔 놓은 값도 원래 모양으로 되돌림.
function cell_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    if (v.getFullYear() <= 1900) return Utilities.formatDate(v, TZ, 'HH:mm');
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  return String(v);
}

function saveRow_(name, row) {
  const sh = sheetOf_(name);
  const cols = SCHEMA[name];
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');

  let rowIndex = row.id ? findRow_(sh, row.id) : -1;
  if (rowIndex === -1) {
    row.id = Utilities.getUuid().slice(0, 8);
    if (cols.includes('작성일시') && !row['작성일시']) row['작성일시'] = now;
    row['삭제'] = '';
    sh.appendRow(cols.map(c => row[c] === undefined ? '' : String(row[c])));
    return row;
  }
  // 기존 행: 보낸 열만 덮어쓰고 나머지는 유지
  const current = sh.getRange(rowIndex, 1, 1, cols.length).getValues()[0];
  const merged = cols.map((c, i) => (row[c] === undefined ? cell_(current[i]) : String(row[c])));
  sh.getRange(rowIndex, 1, 1, cols.length).setValues([merged]);
  const out = {};
  cols.forEach((c, i) => out[c] = merged[i]);
  return out;
}

function deleteRow_(name, id) {
  const sh = sheetOf_(name);
  const rowIndex = findRow_(sh, id);
  if (rowIndex === -1) return false;
  if (name === '사진첩') {
    const col = SCHEMA[name].indexOf('파일IDs') + 1;
    String(sh.getRange(rowIndex, col).getValue() || '').split(',').map(x => x.trim()).filter(Boolean).forEach(fid => {
      try { DriveApp.getFileById(fid).setTrashed(true); } catch (_) {}
    });
  }
  sh.getRange(rowIndex, SCHEMA[name].length).setValue('Y');
  return true;
}

// ───────────────────────── 사진 (구글 드라이브) ─────────────────────────

function photoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (_) {} }
  const folder = DriveApp.createFolder('다락방 사진첩');
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

// base64 이미지를 드라이브에 저장하고 파일 ID 반환. 링크 있는 사람은 볼 수 있음.
function uploadPhoto_(name, mime, base64) {
  if (!base64) throw new Error('이미지 데이터가 없습니다.');
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mime || 'image/jpeg', name || ('photo-' + Date.now() + '.jpg'));
  const file = photoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}
