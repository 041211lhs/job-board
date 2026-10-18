const REGIONS = ['서울', '창원', '부산', '진주', '그 외 경남', '기타'];
const KINDS = ['체험형 인턴', '채용형 인턴', '신입 정규직', '계약직·기간제', '직원 채용(종류 확인)'];
const GROUPS = ['금융공기업', '금융기관(비공공)', '신용보증재단', '시중은행', '지역 공공기관', '기타 공공기관'];
// 내가 가진 자격증 (자격증 효율표 표시용)
const MINE = { 'TESAT': '2급 보유', '컴퓨터활용능력': '2급 보유', 'ERP정보관리사': '회계 2급 보유', 'TOEIC': '770', 'TOEIC Speaking': 'IH', '한국사능력검정시험': '80회 결과 대기' };

const state = { tab: 'open', q: '', onlyTarget: true, regions: new Set(), kinds: new Set(['체험형 인턴', '채용형 인턴', '신입 정규직', '계약직·기간제']), groups: new Set(), orgGroup: '' };
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
function orgCard(o) {
  const r = o.research || {};
  const head = `<h3>${esc(o.name)}</h3><div class="meta">${esc(o.group)} · 본사 ${esc(o.region)}${r.updated ? ' · 조사 ' + esc(r.updated) : ''}</div>`;
  if (!r.status) return `<div class="orgcard" id="org-${esc(o.name)}">${head}<p class="pending">조사 예정</p></div>`;
  const certs = (r.certs || []).map(c => `<tr><td>${esc(c.name)}${c.grade ? ' ' + esc(c.grade) : ''}</td><td><span class="ben ${esc((c.type || '')[0])}">${esc((c.type || '')[0])}</span>${esc(c.value || '')}</td><td>${esc(c.stage || '')}</td></tr>`).join('');
  const row = (k, v) => `<dt>${k}</dt><dd>${unk(v)}</dd>`;
  return `<div class="orgcard" id="org-${esc(o.name)}">${head}
    <dl class="kv">${row('기준 공고', r.notice)}${row('채용 시기', r.schedule)}${row('지원자격', r.eligibility)}${row('어학', r.language)}${row('전형', r.process)}${row('NCS', r.ncs)}${row('전공(공식)', r.major)}${row('경제학 세부', r.major_detail)}${row('교육·봉사·인턴', r.activities)}${row('지역인재', r.regional)}${row('초봉', r.salary)}${row('2027 예상', r.expect2027)}</dl>
    ${certs ? `<table class="mini"><tr><th>자격증</th><th>혜택(원문)</th><th>전형</th></tr>${certs}</table>` : ''}
    ${(r.acts || []).length ? `<table class="mini"><tr><th>활동·인턴·지역</th><th>혜택(원문)</th></tr>${r.acts.map(a => `<tr><td>${esc(a.name)}</td><td><span class="ben ${esc(a.type)}">${esc(a.type)}</span>${esc(a.value)}</td></tr>`).join('')}</table>` : ''}
    ${r.memo ? `<p class="meta">${esc(r.memo)}</p>` : ''}
    <div class="btns">${(r.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join('')}</div></div>`;
}

function renderOrgs() {
  const groups = GROUPS.filter(g => ORGS.some(o => o.group === g));
  const el = $('#orgGroupChips');
  el.innerHTML = '<span class="label">구분</span>' + ['전체', ...groups].map(g => `<button data-v="${g}" class="${(state.orgGroup || '전체') === g ? 'on' : ''}">${g}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; state.orgGroup = b.dataset.v === '전체' ? '' : b.dataset.v; renderOrgs(); };
  const L = ORGS.filter(o => !state.orgGroup || o.group === state.orgGroup);
  L.sort((a, b) => (b.research?.status ? 1 : 0) - (a.research?.status ? 1 : 0));
  $('#orgCards').innerHTML = L.map(orgCard).join('');
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
function renderCerts() {
  const m = {};
  ORGS.forEach(o => (o.research?.certs || []).forEach(c => {
    const t = (c.type || '')[0];
    canonOf(c.name).forEach(k => {
      const e = (m[k] = m[k] || { name: k, orgs: new Set(), qual: new Set(), none: new Set(), vals: [] });
      if (t === 'A') e.qual.add(o.name); else if (t === 'F') e.none.add(o.name); else e.orgs.add(o.name);
      if (t !== 'F') e.vals.push(`<b>${esc(o.name)}</b> [${t}] ${esc(c.grade ? c.grade + ' ' : '')}${esc(c.value || '')}`);
    });
  }));
  const L = Object.values(m).filter(c => c.orgs.size + c.qual.size > 0).sort((a, b) => (PRO.has(a.name) - PRO.has(b.name)) || (b.orgs.size + b.qual.size - a.orgs.size - a.qual.size));
  const mine = n => { const k = Object.keys(MINE).sort((a, b) => b.length - a.length).find(x => n.replace(/\s/g, '').toLowerCase().startsWith(x.replace(/\s/g, '').toLowerCase())); return k ? `<span class="have">${MINE[k]}</span>` : '없음'; };
  $('#certTable').innerHTML = `<tr><th>자격증</th><th>내 현황</th><th>혜택 기관 수</th><th>지원자격으로 요구</th><th>기관별 혜택(원문)</th></tr>` +
    (L.length ? L.map(c => `<tr><td><b>${esc(c.name)}</b>${PRO.has(c.name) ? '<br><span class="unk">전문자격</span>' : ''}${c.none.size ? `<br><span class="unk">혜택 없음 ${c.none.size}곳</span>` : ''}</td><td>${mine(c.name)}</td><td class="num">${c.orgs.size}</td><td>${esc([...c.qual].join(', ')) || '-'}</td><td>${c.vals.join('<br>')}</td></tr>`).join('')
      : '<tr><td colspan="5" class="empty">기관 조사가 끝나면 채워져요.</td></tr>');
}

function renderExam() {
  const L = ORGS.filter(o => o.research && o.research.exam);
  const rank = o => { const w = o.research.exam.weight || ''; return /\d+ *%|\d+ \//.test(w) ? 0 : /비공개|원론/.test(w) ? 1 : 2; };
  L.sort((a, b) => rank(a) - rank(b) || GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
  $('#examTable').innerHTML = '<tr><th>기관</th><th>NCS (영역·배점)</th><th>경제 과목</th><th>과목별 비중</th><th>전공 비중</th><th>논술·기타</th></tr>' +
    L.map(o => { const e = o.research.exam; return `<tr><td><b>${esc(o.name)}</b><br><span class="unk">${esc(o.group)}</span></td><td>${esc(e.ncs)}</td><td>${esc(e.econ)}</td><td>${/\d+ *%|\d+ \//.test(e.weight) ? '<b>' + esc(e.weight) + '</b>' : esc(e.weight)}</td><td>${esc(e.share)}</td><td>${esc(e.essay)}</td></tr>`; }).join('');
}

function renderActs() {
  const m = {};
  ORGS.forEach(o => (o.research?.acts || []).forEach(a => {
    const e = (m[a.name] = m[a.name] || { name: a.name, orgs: new Set(), vals: [] });
    e.orgs.add(o.name); e.vals.push(`<b>${esc(o.name)}</b> [${esc(a.type)}] ${esc(a.value)}`);
  }));
  const L = Object.values(m).sort((a, b) => b.orgs.size - a.orgs.size);
  $('#actTable').innerHTML = '<tr><th>활동</th><th>인정 기관 수</th><th>기관별 혜택(원문)</th></tr>' +
    L.map(a => `<tr><td><b>${esc(a.name)}</b></td><td class="num">${a.orgs.size}</td><td>${a.vals.join('<br>')}</td></tr>`).join('');
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
  if (state.tab === 'certs') { renderCerts(); renderActs(); }
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
  const a = e.target.closest('a[data-org]'); if (!a) return; e.preventDefault();
  go('orgs'); const el = document.getElementById('org-' + a.dataset.org); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
load().catch(err => { $('#updated').textContent = '데이터를 불러오지 못했어요: ' + err; });
