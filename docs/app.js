const REGIONS = ['서울', '창원', '부산', '진주', '그 외 경남', '기타'];
const KINDS = ['체험형 인턴', '채용형 인턴', '신입 정규직', '계약직·기간제', '직원 채용(종류 확인)'];
const GROUPS = ['금융공기업', '금융기관(비공공)', '신용보증재단', '시중은행', '지역 공공기관', '기타 공공기관'];
// 내가 가진 자격증 (자격증 효율표 표시용)
const MINE = { 'TESAT': '2급 보유', '컴퓨터활용능력': '2급 보유', 'ERP정보관리사': '회계 2급 보유', 'TOEIC': '770', 'TOEIC Speaking': 'IH', '한국사능력검정시험': '80회 결과 대기' };

const state = { tab: 'open', q: '', org: '', orgQ: '', orgView: 'table', cmpGroup: '', onlyTarget: true, regions: new Set(), kinds: new Set(['체험형 인턴', '채용형 인턴', '신입 정규직', '계약직·기간제']), groups: new Set(), orgGroup: '' };
let JOBS = [], ORGS = [], UPDATED = '', NEW = new Set();
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); };
const dday = dl => dl ? Math.round((new Date(dl) - new Date(today())) / 864e5) : null;

try { const saved = JSON.parse(localStorage.getItem('jb-filter2') || 'null'); if (saved) { state.onlyTarget = saved.onlyTarget; state.regions = new Set(saved.regions); state.kinds = new Set(saved.kinds); state.groups = new Set(saved.groups); } } catch (e) {}
const save = () => { try { localStorage.setItem('jb-filter2', JSON.stringify({ onlyTarget: state.onlyTarget, regions: [...state.regions], kinds: [...state.kinds], groups: [...state.groups] })); } catch (e) {} };

async function load() {
  const [j, o] = await Promise.all([fetch('data/jobs.json?' + Date.now()).then(r => r.json()), fetch('data/orgs.json?' + Date.now()).then(r => r.json())]);
  JOBS = Object.values(j.jobs); UPDATED = j.updated; NEW = new Set(j.new_today || []); ORGS = o.orgs;
  $('#updated').textContent = `마지막 갱신 ${UPDATED.replace('T', ' ').slice(0, 16)} · 진행 중 ${JOBS.filter(x => x.open).length}건 · 누적 ${JOBS.length}건`;
  chips(); const h = location.hash.slice(1); if (['open', 'archive', 'exam', 'orgs', 'certs', 'manual'].includes(h)) go(h); else render();
}

function chips() {
  const mk = (el, label, items, set) => {
    el.innerHTML = `<span class="label">${label}</span>` + items.map(x => `<button data-v="${esc(x)}" class="${set.has(x) ? 'on' : ''}">${esc(x)}</button>`).join('');
    el.onclick = e => { const b = e.target.closest('button'); if (!b) return; const v = b.dataset.v; set.has(v) ? set.delete(v) : set.add(v); b.classList.toggle('on'); save(); render(); };
  };
  mk($('#regionChips'), '지역', REGIONS, state.regions);
  mk($('#kindChips'), '종류', KINDS, state.kinds);
  mk($('#groupChips'), '구분', GROUPS, state.groups);
  $('#onlyTarget').checked = state.onlyTarget;
}

function filtered(open) {
  const q = state.q.trim().toLowerCase();
  return JOBS.filter(j => j.open === open)
    .filter(j => !state.onlyTarget || j.target)
    .filter(j => !state.regions.size || (j.regions || []).some(r => state.regions.has(r)))
    .filter(j => !state.kinds.size || (j.kinds || []).some(k => state.kinds.has(k)))
    .filter(j => !state.groups.size || state.groups.has(j.group))
    .filter(j => !q || (j.org + ' ' + j.title + ' ' + (j.org_key || '')).toLowerCase().includes(q));
}

function jobCard(j) {
  const d = dday(j.deadline);
  const dTxt = d === null ? '상시' : d < 0 ? '마감' : d === 0 ? 'D-DAY' : 'D-' + d;
  const cls = d === null ? '' : d < 0 ? 'done' : d <= 3 ? 'soon' : '';
  const isNew = NEW.has(j.id) || (j.first_seen && (Date.now() - new Date(j.first_seen)) < 36 * 3600e3);
  const det = j.detail || {};
  const org = ORGS.find(o => o.name === j.org_key);
  const kv = [['기간', `${j.posted || '?'} ~ ${j.deadline || '?'}`], ['근무지', (det.locs || []).join(', ') || j.loc], ['채용인원', det.headcount], ['고용형태', det.work_type_full || j.work_type],
    ['직무(NCS)', det.ncs], ['학력', det.edu], ['응시자격', det.qualification], ['우대', det.preference], ['전형절차', det.process]].filter(x => x[1]);
  const files = (det.files || []).map(f => `<a href="${esc(f.url)}" target="_blank" rel="noopener">📎 ${esc(f.name)}</a>`).join('');
  return `<li class="job"><div class="head"><div class="dday ${cls}">${dTxt}</div><div class="main">
    <div class="org"><b>${esc(j.org_key || j.org)}</b> · ${esc(j.group)} · ${esc(j.src)}</div>
    <h3>${esc(j.title)}</h3>
    <div class="tags">${isNew ? '<span class="tag new">NEW</span>' : ''}${(j.kinds || []).map(k => `<span class="tag ${k === '계약직·기간제' ? 'contract' : 'kind'}">${esc(k)}</span>`).join('')}${(j.regions || []).map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div>
    <details><summary>자세히</summary><dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <div class="btns"><a href="${esc(j.url)}" target="_blank" rel="noopener">원문 공고 열기</a>${files}${org && org.research && org.research.status ? `<a href="#" data-org="${esc(org.name)}">이 기관 채용조건</a>` : ''}</div>
    </details></div></div></li>`;
}

function renderJobs() {
  const open = state.tab === 'open';
  let L = filtered(open);
  L.sort(open ? (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') : (a, b) => (b.deadline || '').localeCompare(a.deadline || ''));
  $('#count').textContent = `${L.length}건` + (open ? ' · 마감 임박 순' : ' · 최근 마감 순');
  const el = open ? $('#openList') : $('#archiveList');
  el.innerHTML = L.length ? L.slice(0, 400).map(jobCard).join('') : '<li class="empty">조건에 맞는 공고가 없어요. 필터를 줄여 보세요.</li>';
}

const unk = v => v ? esc(v) : '<span class="unk">확인 불가</span>';
const TYPE_LABEL = { A: '지원자격', B: '가산점', C: '서류 배점', D: '우대', E: '전형 면제', F: '혜택 없음' };
const badge = t => `<span class="badge t${esc(t)}">${TYPE_LABEL[t] || esc(t)}</span>`;
const prop = (k, v, raw) => `<div class="prop"><div class="pk">${k}</div><div class="pv">${raw ? v : unk(v)}</div></div>`;
function weightBar(w) {
  const parts = [...String(w || '').matchAll(/([가-힣A-Za-z·+]+)\s*(\d+)\s*%/g)].map(m => [m[1], +m[2]]);
  if (parts.length < 2) return '';
  return `<div class="wbar">${parts.map(([n, v], i) => `<span class="seg s${i}" style="flex:${v}">${esc(n)} ${v}%</span>`).join('')}</div>`;
}
function orgDetail(o) {
  if (!o) return '<div class="empty">왼쪽에서 기관을 골라 주세요.</div>';
  const r = o.research || {}, e = r.exam || {};
  const pills = `<span class="pill">${esc(o.group)}</span><span class="pill">본사 ${esc(o.city || o.region)}</span>${r.status ? `<span class="pill ${r.status === '조사 완료' ? 'ok' : 'warn'}">${esc(r.status)}</span>` : '<span class="pill">조사 예정</span>'}`;
  if (!r.status) return `<header class="dh"><h2>${esc(o.name)}</h2><div class="pills">${pills}</div></header><div class="empty">아직 조사하지 않은 기관이에요.</div>`;
  const certs = r.certs || [];
  const real = certs.filter(c => (c.type || '')[0] !== 'F'), none = certs.filter(c => (c.type || '')[0] === 'F');
  const certRows = real.map(c => `<tr><td><b>${esc(c.name)}</b>${c.grade ? `<div class="sub2">${esc(c.grade)}</div>` : ''}</td><td>${badge((c.type || '')[0])}</td><td>${esc(c.value || '')}${c.stage ? `<div class="sub2">${esc(c.stage)}</div>` : ''}</td></tr>`).join('');
  const actRows = (r.acts || []).map(a => `<tr><td><b>${esc(a.name)}</b></td><td>${badge(a.type)}</td><td>${esc(a.value)}</td></tr>`).join('');
  return `<header class="dh"><h2>${esc(o.name)}</h2><div class="pills">${pills}${r.updated ? `<span class="muted">조사 ${esc(r.updated)}</span>` : ''}</div></header>
    ${r.memo ? `<div class="callout">💡 ${esc(r.memo)}</div>` : ''}
    <div class="facts">
      <div class="fact"><div class="fk">어학</div><div class="fv">${unk(r.language)}</div></div>
      <div class="fact"><div class="fk">경제 과목 비중</div><div class="fv">${unk(e.weight || r.major_detail)}${weightBar(e.weight)}</div></div>
      <div class="fact"><div class="fk">2027 예상</div><div class="fv">${unk(r.expect2027)}</div></div>
    </div>
    <section class="dsec"><h3>채용 개요</h3>${prop('기준 공고', r.notice)}${prop('채용 시기', r.schedule)}${prop('지원자격', r.eligibility)}${prop('전형', r.process)}${prop('지역인재', r.regional)}${prop('초봉', r.salary)}</section>
    <section class="dsec"><h3>필기 시험</h3>${prop('NCS 영역', e.ncs || r.ncs)}${prop('NCS 문항·시간', e.ncs_size)}${prop('NCS 유형', e.ncs_type ? esc(e.ncs_type) + ' <span class="muted">(수험생 후기 기준, 공식 아님)</span>' : '', !!e.ncs_type)}${prop('경제 과목', e.econ || r.major)}${prop('전공 비중', e.share)}${prop('논술·기타', e.essay)}</section>
    <section class="dsec"><h3>자격증 혜택 <span class="muted">공고 표현 그대로</span></h3>
      ${certRows ? `<table class="dtable"><thead><tr><th>자격증</th><th>구분</th><th>혜택</th></tr></thead><tbody>${certRows}</tbody></table>` : '<div class="muted">자격증 가점·배점 항목 없음(또는 확인 불가)</div>'}
      ${none.length ? `<div class="nonerow">혜택 없음 확인: ${none.map(c => esc(c.name)).join(' · ')}</div>` : ''}</section>
    <section class="dsec"><h3>교육·봉사·인턴·지역</h3>
      ${actRows ? `<table class="dtable"><thead><tr><th>항목</th><th>구분</th><th>혜택</th></tr></thead><tbody>${actRows}</tbody></table>` : prop('내용', r.activities)}</section>
    <div class="btns">${(r.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ↗</a>`).join('')}</div>`;
}
function renderCompare() {
  const groups = GROUPS.filter(g => ORGS.some(o => o.group === g && o.research?.summary));
  const el = $('#cmpChips');
  el.innerHTML = ['전체', ...groups].map(g => `<button data-v="${g}" class="${(state.cmpGroup || '전체') === g ? 'on' : ''}">${g}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; state.cmpGroup = b.dataset.v === '전체' ? '' : b.dataset.v; renderCompare(); };
  const FIT = { ok: '<span class="fit ok">✅</span>', warn: '<span class="fit warn">⚠</span>', unk: '<span class="fit unk">❔</span>' };
  const L = ORGS.filter(o => o.research?.summary && (!state.cmpGroup || o.group === state.cmpGroup));
  const rank = o => ({ ok: 0, warn: 1, unk: 2 }[o.research.summary.fit] ?? 3);
  L.sort((a, b) => (/접수 중/.test(b.research.summary.note) - /접수 중/.test(a.research.summary.note)) || rank(a) - rank(b) || GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
  const cell = v => !v || v === '-' ? '<span class="dash">–</span>' : esc(v);
  $('#cmpTable').innerHTML = '<thead><tr><th></th><th>기관</th><th>본사</th><th>어학</th><th>한국사</th><th>경제 필기</th><th>지역 우대</th><th>다음 공고</th></tr></thead><tbody>' +
    L.map(o => { const s = o.research.summary; return `<tr data-org="${esc(o.name)}"><td>${FIT[s.fit] || ''}</td><td><b>${esc(o.name)}</b>${s.note ? `<div class="sub2 ${/접수 중/.test(s.note) ? 'hotnote' : ''}">${esc(s.note)}</div>` : ''}</td><td>${esc(o.city || o.region)}</td><td>${cell(s.lang)}</td><td>${cell(s.hist)}</td><td>${cell(s.econ)}</td><td>${cell(s.region)}</td><td>${cell(s.next)}</td></tr>`; }).join('') + '</tbody>';
}

function renderOrgs() {
  document.querySelectorAll('.viewtoggle button').forEach(b => b.classList.toggle('on', b.dataset.view === state.orgView));
  $('#cmpWrap').hidden = state.orgView !== 'table';
  $('#detailWrap').hidden = state.orgView !== 'detail';
  if (state.orgView === 'table') { renderCompare(); return; }
  const groups = GROUPS.filter(g => ORGS.some(o => o.group === g));
  const el = $('#orgGroupChips');
  el.innerHTML = ['전체', ...groups].map(g => `<button data-v="${g}" class="${(state.orgGroup || '전체') === g ? 'on' : ''}">${g}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; state.orgGroup = b.dataset.v === '전체' ? '' : b.dataset.v; renderOrgs(); };
  const q = (state.orgQ || '').trim();
  const L = ORGS.filter(o => (!state.orgGroup || o.group === state.orgGroup) && (!q || o.name.includes(q)));
  if (!state.org || !L.some(o => o.name === state.org)) state.org = (L[0] || {}).name;
  const dot = o => { const s = o.research?.status; return s === '조사 완료' ? 'ok' : s ? 'warn' : ''; };
  const hot = o => /⚠|⏳|진행 중/.test(o.research?.memo || '') ? '<span class="hot">진행 중</span>' : '';
  $('#orgList').innerHTML = L.map(o => `<button class="oi ${o.name === state.org ? 'on' : ''}" data-org="${esc(o.name)}"><span class="dot ${dot(o)}"></span><span class="on1">${esc(o.name)}${hot(o)}</span><span class="on2">${esc(o.region)} · ${esc(o.group)}</span></button>`).join('') || '<div class="muted" style="padding:12px">검색 결과 없음</div>';
  $('#orgDetail').innerHTML = orgDetail(ORGS.find(o => o.name === state.org));
}


// 같은 자격증을 한 줄로 모으기 위한 대표 이름과 별칭 (긴 이름부터 검사)
const CANON = [
  ['TOEIC Speaking', ['TOEIC Speaking', '토익스피킹', 'TOEIC-S']],
  ['TOEIC', ['TOEIC']],
  ['한국사능력검정시험', ['한국사']],
  ['컴퓨터활용능력', ['컴퓨터활용', '컴활']],
  ['ADsP(데이터분석준전문가)', ['ADsP', '데이터분석준전문가']],
  ['ADP(데이터분석전문가)', ['ADP', '데이터분석전문가']],
  ['빅데이터분석기사', ['빅데이터분석기사', '빅데이터']],
  ['SQLD', ['SQLD']],
  ['정보처리기사', ['정보처리기사']],
  ['투자자산운용사', ['투자자산운용사']],
  ['신용분석사', ['신용분석사']],
  ['신용관리사', ['신용관리사']],
  ['재경관리사', ['재경관리사']],
  ['회계관리', ['회계관리']],
  ['전산회계', ['전산회계 1급', '전산회계']],
  ['전산세무', ['전산세무']],
  ['사회조사분석사', ['사회조사분석사']],
  ['KBS한국어능력시험', ['KBS한국어']],
  ['ERP정보관리사', ['ERP']],
  ['TESAT', ['TESAT']],
  ['외환전문역', ['외환전문역']],
  ['AFPK', ['AFPK']],
  ['경영지도사', ['경영지도사']],
  ['공인회계사(KICPA)', ['공인회계사', 'KICPA', 'CPA·', '회계사']],
  ['세무사', ['세무사']],
  ['CFA', ['CFA']],
  ['FRM', ['FRM']],
  ['변호사', ['변호사']],
  ['공인노무사', ['노무사']],
  ['감정평가사', ['감정평가사']],
  ['보험계리사', ['보험계리사']],
];
const canonOf = name => {
  const hits = CANON.filter(([, al]) => al.some(a => name.includes(a))).map(([k]) => k);
  if (hits.includes('TOEIC Speaking')) return hits.filter(h => h !== 'TOEIC');
  return hits.length ? hits : [name];
};
const PRO = new Set(['공인회계사(KICPA)', '세무사', 'CFA', 'FRM', '변호사', '공인노무사', '감정평가사', '보험계리사']);
function certCard(c, mine) {
  const n = k => c[k].size;
  const rows = c.rows.sort((a, b) => 'AEBCD'.indexOf(a.t) - 'AEBCD'.indexOf(b.t));
  const li = x => `<li><button class="olink" data-org="${esc(x.org)}">${esc(x.org)}</button>${badge(x.t)}<span>${esc(x.v)}</span></li>`;
  return `<article class="ccard">
    <header><h3>${esc(c.name)}</h3>${mine ? `<span class="mine">${esc(mine)}</span>` : ''}</header>
    <div class="stats">${n('qual') ? `<span class="st tA">지원자격 ${n('qual')}</span>` : ''}<span class="st tB">점수 반영 ${n('orgs')}</span>${n('pref') ? `<span class="st tD">우대 ${n('pref')}</span>` : ''}${n('none') ? `<span class="st tF">혜택 없음 ${n('none')}</span>` : ''}</div>
    <ul class="clist">${rows.slice(0, 5).map(li).join('')}</ul>
    ${rows.length > 5 ? `<details><summary>${rows.length - 5}곳 더 보기</summary><ul class="clist">${rows.slice(5).map(li).join('')}</ul></details>` : ''}
  </article>`;
}
function renderCerts() {
  const m = {};
  ORGS.forEach(o => (o.research?.certs || []).forEach(c => {
    const t = (c.type || '')[0];
    canonOf(c.name).forEach(k => {
      const e = (m[k] = m[k] || { name: k, orgs: new Set(), qual: new Set(), pref: new Set(), none: new Set(), rows: [] });
      if (t === 'A') e.qual.add(o.name); else if (t === 'F') e.none.add(o.name); else if (t === 'D') e.pref.add(o.name); else e.orgs.add(o.name);
      if (t !== 'F') e.rows.push({ org: o.name, t, v: `${c.grade ? c.grade + ' · ' : ''}${c.value || ''}` });
    });
  }));
  const mine = n => { const k = Object.keys(MINE).sort((a, b) => b.length - a.length).find(x => n.replace(/\s/g, '').toLowerCase().startsWith(x.replace(/\s/g, '').toLowerCase())); return k ? MINE[k] : ''; };
  const score = c => c.qual.size * 3 + c.orgs.size * 2 + c.pref.size;
  const L = Object.values(m).filter(c => c.rows.length).sort((a, b) => score(b) - score(a));
  $('#certCards').innerHTML = L.filter(c => !PRO.has(c.name)).map(c => certCard(c, mine(c.name))).join('');
  $('#proCards').innerHTML = L.filter(c => PRO.has(c.name)).map(c => certCard(c, '')).join('');
  renderActs();
}
function renderActs() {
  const m = {};
  ORGS.forEach(o => (o.research?.acts || []).forEach(a => {
    const e = (m[a.name] = m[a.name] || { name: a.name, orgs: new Set(), qual: new Set(), pref: new Set(), none: new Set(), rows: [] });
    if (a.type === 'D') e.pref.add(o.name); else e.orgs.add(o.name);
    e.rows.push({ org: o.name, t: a.type, v: a.value });
  }));
  $('#actCards').innerHTML = Object.values(m).sort((a, b) => b.rows.length - a.rows.length).map(a => certCard(a, '')).join('');
}


function renderExam() {
  const L = ORGS.filter(o => o.research && o.research.exam);
  const rank = o => { const w = o.research.exam.weight || ''; return /\d+ *%|\d+ \//.test(w) ? 0 : /비공개|원론/.test(w) ? 1 : 2; };
  L.sort((a, b) => rank(a) - rank(b) || GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
  $('#examTable').innerHTML = '<tr><th>기관</th><th>NCS (영역·배점)</th><th>경제 과목</th><th>과목별 비중</th><th>전공 비중</th><th>논술·기타</th></tr>' +
    L.map(o => { const e = o.research.exam; return `<tr><td><b>${esc(o.name)}</b><br><span class="unk">${esc(o.group)}</span></td><td>${esc(e.ncs)}</td><td>${esc(e.econ)}</td><td>${/\d+ *%|\d+ \//.test(e.weight) ? '<b>' + esc(e.weight) + '</b>' : esc(e.weight)}</td><td>${esc(e.share)}</td><td>${esc(e.essay)}</td></tr>`; }).join('');
}

function renderManual() {
  const L = ORGS.filter(o => o.manual);
  $('#manualList').innerHTML = L.map(o => `<li><a href="${esc(o.site)}" target="_blank" rel="noopener"><b>${esc(o.name)}</b></a><span>${esc(o.group)} · ${esc(o.manual_note || '채용 페이지 직접 확인')}</span></li>`).join('') || '<li>없음</li>';
}

function render() {
  const jobTab = state.tab === 'open' || state.tab === 'archive';
  $('#filters').style.display = jobTab ? '' : 'none';
  if (jobTab) renderJobs();
  if (state.tab === 'orgs') renderOrgs();
  if (state.tab === 'certs') renderCerts();
  if (state.tab === 'exam') renderExam();
  if (state.tab === 'manual') renderManual();
}

function go(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + tab));
  render(); window.scrollTo(0, 0);
  try { history.replaceState(null, '', '#' + tab); } catch (e) {}
}
document.querySelector('.tabs').onclick = e => { const b = e.target.closest('button'); if (b) go(b.dataset.tab); };
$('#q').oninput = e => { state.q = e.target.value; render(); };
$('#onlyTarget').onchange = e => { state.onlyTarget = e.target.checked; save(); render(); };
document.addEventListener('click', e => {
  const a = e.target.closest('[data-org]'); if (!a) return; e.preventDefault();
  state.org = a.dataset.org; state.orgGroup = ''; state.orgQ = ''; state.orgView = 'detail';
  const q = $('#orgQ'); if (q) q.value = '';
  if (state.tab !== 'orgs') go('orgs'); else renderOrgs();
  if (window.innerWidth < 820) $('#orgDetail').scrollIntoView({ behavior: 'smooth', block: 'start' }); else window.scrollTo(0, 0);
});
document.addEventListener('click', e => { const b = e.target.closest('.viewtoggle button'); if (!b) return; state.orgView = b.dataset.view; renderOrgs(); });
document.addEventListener('input', e => { if (e.target.id === 'orgQ') { state.orgQ = e.target.value; renderOrgs(); } });
load().catch(err => { $('#updated').textContent = '데이터를 불러오지 못했어요: ' + err; });
