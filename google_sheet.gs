/**
 * 구글 시트 자동 동기화 (구글 시트 > 확장 프로그램 > Apps Script 에 붙여넣기)
 * 사이트의 공고 데이터를 매일 시트로 가져온다. 별도 키 필요 없음.
 * 처음 한 번: 위 메뉴에서 함수 'setup' 선택 → 실행 → 권한 허용
 */
const DATA_URL = 'https://041211lhs.github.io/job-board/data/jobs.json';
const ORG_URL = 'https://041211lhs.github.io/job-board/data/orgs.json';

function sync() {
  const db = JSON.parse(UrlFetchApp.fetch(DATA_URL + '?t=' + Date.now()).getContentText());
  const jobs = Object.values(db.jobs).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  const head = ['상태', '관심기관', '구분', '기관', '공고 제목', '종류', '지역', '등록일', '마감일', '처음 본 날', '출처', '링크'];
  const row = j => [j.open ? '진행 중' : '마감', j.target ? 'O' : '', j.group, j.org_key || j.org, j.title, (j.kinds || []).join(', '),
    (j.regions || []).join(', '), j.posted || '', j.deadline || '', (j.first_seen || '').slice(0, 10), j.src, j.url];
  write_('진행 중 공고', head, jobs.filter(j => j.open).map(row));
  write_('누적 아카이브', head, jobs.slice().reverse().map(row));

  const orgs = JSON.parse(UrlFetchApp.fetch(ORG_URL + '?t=' + Date.now()).getContentText()).orgs;
  const oh = ['구분', '기관', '본사', '기준 공고', '채용 시기', '어학', 'NCS', '전공', '경제학 세부', '자격증 혜택(원문)', '교육·봉사·인턴', '지역인재', '초봉', '2027 예상', '조사일'];
  write_('기관별 채용조건', oh, orgs.map(o => {
    const r = o.research || {};
    return [o.group, o.name, o.region, r.notice || '조사 예정', r.schedule || '', r.language || '', r.ncs || '', r.major || '', r.major_detail || '',
      (r.certs || []).map(c => `${c.name}${c.grade ? ' ' + c.grade : ''}: [${(c.type || '')[0]}] ${c.value || ''}`).join('\n'),
      r.activities || '', r.regional || '', r.salary || '', r.expect2027 || '', r.updated || ''];
  }));
  SpreadsheetApp.getActive().getSheetByName('진행 중 공고').getRange('N1').setValue('갱신: ' + db.updated);
}

function write_(name, head, rows) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows);
  sh.setFrozenRows(1);
}

function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sync').timeBased().everyDays(1).atHour(8).create(); // 매일 오전 8~9시
  sync();
}
