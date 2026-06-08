// ============================================================
// Google Apps Script — 결혼식 청첩장 데이터 수신
// (방명록 · 참석 의사 표시)
//
// ▶ 배포 방법 (최초 1회만)
//  1. https://script.google.com → [새 프로젝트]
//  2. 이 코드 전체를 붙여넣고 저장 (Ctrl+S)
//  3. [배포] → [새 배포]
//     - 유형 : 웹 앱
//     - 실행 계정 : 나 (내 Google 계정)
//     - 액세스 권한 : 모든 사용자 (익명 포함)  ← 필수
//  4. [배포] 클릭 → 권한 허용 → 웹 앱 URL 복사
//  5. script.js 의 CONFIG.sheetsUrl 에 붙여넣기
//
// ▶ 스프레드시트 연결 방법
//  - 아래 SPREADSHEET_ID 를 비워두면 → 스크립트와 연결된 시트 사용
//    (새 프로젝트 생성 시 자동 생성 혹은 [파일] → [스프레드시트에 컨테이너로 설정])
//  - 기존 시트를 연결하려면 해당 시트 ID 입력
//    (시트 URL 중 /d/[여기]/edit 부분)
// ============================================================

var SPREADSHEET_ID = '';   // 비워두면 컨테이너 스프레드시트 자동 사용

/* ── 공통 JSON 응답 생성 ─────────────────────────────────── */
function jsonRes(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── 시트 가져오기 (없으면 생성 + 헤더 추가) ─────────────── */
function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);

    // 헤더 스타일 (우드톤 배경, 볼드)
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#F0EBE3');
    headerRange.setFontColor('#5C4F44');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

/* ── POST 핸들러 ─────────────────────────────────────────── */
function doPost(e) {
  // 동시 쓰기 충돌 방지 (Race condition)
  var lock = LockService.getScriptLock();
  var acquired = lock.tryLock(10000); // 최대 10초 대기

  if (!acquired) {
    return jsonRes({ result: 'error', message: '서버가 바쁩니다. 잠시 후 다시 시도해주세요.' });
  }

  try {
    var p = e.parameter || {};       // URL-encoded 폼 파라미터
    var type    = (p.type    || '').trim();
    var name    = (p.name    || '').trim();
    var website = (p.website || '');  // 허니팟 필드

    // ── 서버 측 스팸 방지 ───────────────────────────────

    // ① 허니팟 필드가 채워진 경우 → 봇으로 간주
    //    봇에게는 성공처럼 보여서 재시도를 막음
    if (website.length > 0) {
      return jsonRes({ result: 'success' });
    }

    // ② 이름 길이 검사 (1~20자)
    if (!name || name.length < 1 || name.length > 20) {
      return jsonRes({ result: 'error', message: '이름을 올바르게 입력해주세요.' });
    }

    // ── 스프레드시트 연결 ────────────────────────────────
    var ss = SPREADSHEET_ID
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();

    var ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

    // ── RSVP (참석 의사 표시) ────────────────────────────
    if (type === 'rsvp') {
      var attendance = (p.attendance || '-').trim();
      var meal       = (p.meal       || '-').trim();
      var guests     = (p.guests     || '1').trim();

      var rsvpSheet = getOrCreateSheet(ss, 'RSVP',
        ['제출 시간', '이름', '참석 여부', '식사 여부', '동반 인원']);

      rsvpSheet.appendRow([ts, name, attendance, meal, guests]);
      return jsonRes({ result: 'success' });
    }

    // ── 방명록 (Guestbook) ───────────────────────────────
    if (type === 'guestbook') {
      var message = (p.message || '').trim();

      // 메시지 유효성 검사
      if (!message || message.length < 1) {
        return jsonRes({ result: 'error', message: '메시지를 입력해주세요.' });
      }
      if (message.length > 200) {
        return jsonRes({ result: 'error', message: '메시지는 200자 이내로 입력해주세요.' });
      }

      // URL 2개 이상 → 스팸 링크 광고 의심
      var urlCount = (message.match(/https?:\/\//gi) || []).length;
      if (urlCount > 1) {
        return jsonRes({ result: 'error', message: '링크가 포함된 메시지는 등록할 수 없습니다.' });
      }

      // 6자 이상 반복 문자 (aaaaaa, 111111 등) → 스팸 의심
      if (/(.)\1{5,}/.test(message)) {
        return jsonRes({ result: 'error', message: '비정상적인 입력이 감지되었습니다.' });
      }

      var gbSheet = getOrCreateSheet(ss, '방명록',
        ['제출 시간', '이름', '메시지']);

      gbSheet.appendRow([ts, name, message]);
      return jsonRes({ result: 'success' });
    }

    return jsonRes({ result: 'error', message: '알 수 없는 요청 유형입니다.' });

  } catch (err) {
    return jsonRes({ result: 'error', message: '서버 오류: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/* ── GET 핸들러 ─────────────────────────────────────────────
   ?action=guestbook&callback=fnName  → 방명록 목록 JSONP 반환
   (인수 없음)                        → 서버 상태 확인용 텍스트
   ─────────────────────────────────────────────────────────── */
function doGet(e) {
  var p = e.parameter || {};

  /* ── 방명록 목록 조회 ────────────────────────────────────── */
  if (p.action === 'guestbook') {
    var cb = (p.callback && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p.callback))
             ? p.callback : null;
    try {
      var ss = SPREADSHEET_ID
        ? SpreadsheetApp.openById(SPREADSHEET_ID)
        : SpreadsheetApp.getActiveSpreadsheet();

      var sheet  = ss.getSheetByName('방명록');
      var entries = [];

      if (sheet && sheet.getLastRow() > 1) {
        var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
        for (var i = 0; i < data.length; i++) {
          var row     = data[i];
          var rowName = String(row[1] || '').trim();
          var rowMsg  = String(row[2] || '').trim();
          if (!rowName || !rowMsg) continue;

          /* 날짜 셀: Sheets가 자동으로 Date 객체로 변환했을 수 있음.
             항상 KST 'yyyy-MM-dd HH:mm:ss' 문자열로 정규화해서 반환. */
          var dateVal = row[0];
          var dateStr;
          if (dateVal instanceof Date) {
            dateStr = Utilities.formatDate(dateVal, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
          } else {
            dateStr = String(dateVal || '');
          }

          entries.push({ date: dateStr, name: rowName, msg: rowMsg });
        }
      }

      var res = JSON.stringify({ result: 'success', entries: entries });
      if (cb) {
        return ContentService
          .createTextOutput(cb + '(' + res + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(res).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      var errJson = JSON.stringify({ result: 'error', message: err.message });
      if (cb) {
        return ContentService
          .createTextOutput(cb + '(' + errJson + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(errJson).setMimeType(ContentService.MimeType.JSON);
    }
  }

  /* ── 기본 응답 (배포 확인용) ────────────────────────────── */
  return ContentService
    .createTextOutput('✓ Wedding Form Server is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}
