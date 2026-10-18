# -*- coding: utf-8 -*-
"""매일 공고를 모아 docs/data/jobs.json 에 누적 저장한다.

수집처
  - 잡알리오(job.alio.go.kr): 공공기관 전체
  - 클린아이 잡플러스(job.cleaneye.go.kr): 지방공기업·출자출연기관(신용보증재단 등)
  - recruiter.co.kr 채용 사이트: 일부 시중은행·기관
기관 목록과 별칭은 docs/data/orgs.json 에서 읽는다.
"""
import json, re, html, os, sys, time, datetime
import urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'docs', 'data')
JOBS = os.path.join(DATA, 'jobs.json')
ORGS = os.path.join(DATA, 'orgs.json')
KST = datetime.timezone(datetime.timedelta(hours=9))
TODAY = datetime.datetime.now(KST).date()
UA = {'User-Agent': 'Mozilla/5.0 (personal job board; daily)'}

# 사무·행정 계열이 아닌 공고를 거르는 단어 (관심 기관이 아닌 공고에만 적용)
EXCLUDE = re.compile(r'의사|간호|약사|약무|의료|요양|보건직|임상|전임교원|교수|연구직|연구원\)|연구위원|부연구|박사|시설관리|미화|조리|운전|경비|청원|기능직|전기|기계|토목|건축|방사선|물리치료|사회복지사|상담사|보육|체육|강사|안전요원|주차|간호조무|변호사|회계사')
OFFICE = re.compile(r'사무|행정|일반직|신입|인턴|사원|경영|금융|5급|6급|7급|채용형|체험형|정규직|공개채용|직원 채용|직원채용|공채')


def get(url, data=None, headers=None, tries=3):
    h = dict(UA)
    h.update(headers or {})
    body = urllib.parse.urlencode(data, doseq=True).encode() if isinstance(data, dict) else data
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=body, headers=h)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode('utf-8', errors='ignore')
        except Exception as e:
            if k == tries - 1:
                print('  ! 실패', url[:80], e, file=sys.stderr)
                return ''
            time.sleep(2)


def strip(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def norm(name):
    return re.sub(r'\(주\)|\(재\)|㈜|주식회사|\s', '', name or '')


def ymd(s):
    """'26.11.02' / '2026.10.16' / '2026-10-16' -> '2026-11-02'"""
    s = (s or '').strip()
    m = re.search(r'(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})', s)
    if not m:
        return ''
    y = int(m.group(1))
    y = y + 2000 if y < 100 else y
    return f'{y:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}'


# ---------------- 분류 ----------------
def load_orgs():
    with open(ORGS, encoding='utf-8') as f:
        return json.load(f)['orgs']


def match_org(orgs, org_name, title=''):
    n = norm(org_name)
    for o in orgs:
        for a in [o['name']] + o.get('aliases', []):
            if norm(a) and (norm(a) == n or (len(norm(a)) >= 4 and norm(a) in n)):
                return o
    t = norm(title)
    for o in orgs:
        for a in [o['name']] + o.get('aliases', []):
            if len(norm(a)) >= 4 and norm(a) in t:
                return o
    return None


def region_tags(locs, title, org):
    """근무지 → 서울/창원/부산/진주/그 외 경남/기타 (복수 가능)"""
    text = ' '.join(locs) + ' ' + title
    tags = []
    if '서울' in text:
        tags.append('서울')
    if '부산' in text:
        tags.append('부산')
    if '창원' in text or '마산' in text or '진해' in text:
        tags.append('창원')
    if '진주' in text:
        tags.append('진주')
    if '경남' in text or '경상남도' in text:
        if not ({'창원', '진주'} & set(tags)):
            home = (org or {}).get('region', '')
            tags.append(home if home in ('창원', '진주') else '그 외 경남')
    if not tags:
        home = (org or {}).get('region', '')
        if home in ('서울', '부산', '창원', '진주') and not locs:
            tags.append(home)
    if not tags or any(l and not re.search(r'서울|부산|경남|경상남도|창원|진주', l) for l in locs):
        tags.append('기타')
    return sorted(set(tags), key=['서울', '창원', '부산', '진주', '그 외 경남', '기타'].index)


CONTRACT = re.compile(r'기간제|계약직|계약인력|위촉|단기|대체인력|육아휴직|육휴|시간제|텔러|타이머|도급|무기계약|비정규직|시니어|도우미')
OTHER = re.compile(r'이사장|원장|개방형|실장|본부장|경력직|경력사원|퇴직|재채용|교수|임원|감사')
# 장애인·보훈·고졸 제한 공고는 지원 대상이 아니므로 뺀다 (일반 전형에 '포함'된 경우는 남김)
TECH = re.compile(r'기술직|기능직|기계|전기|전자|화학|화공|토목|건축|설비|ICT|전산|정보보안|연구직|연구원\)|인턴연구원|위촉연구원|박사후|간호|의사|약사|운전|시설관리|조리|미화')
TECH_STRICT = re.compile(r'\((연구직|인턴연구원|위촉연구원|박사후|연구원|기계|전기|화학|토목|건축|ICT|전산|정보보안)[^)]*\)|도급강사|생활체육|체육센터|스포츠센터')
RESTRICT = re.compile(r'장애|보훈|고졸|특성화고')
KINDS = ['체험형 인턴', '채용형 인턴', '신입 정규직', '계약직·기간제', '직원 채용(종류 확인)']


def kind_tags(work_type, title):
    tokens = set(t.strip() for t in re.split(r'[,/ ]| 외', work_type or '') if t.strip())
    k = []
    if '청년인턴(체험형)' in tokens or '체험형' in title:
        k.append('체험형 인턴')
    if '청년인턴(채용형)' in tokens or '채용형' in title:
        k.append('채용형 인턴')
    if '인턴' in title and not k:
        k.append('체험형 인턴')
    if re.search(r'신입', title) or (('정규직' in tokens or re.search(r'(?<!비)정규직|공개채용|공채|일반직|[5-7]급|행원', title))
                                     and not CONTRACT.search(title) and not OTHER.search(title)):
        k.append('신입 정규직')
    if CONTRACT.search(title) or (tokens & {'비정규직', '무기계약직'} and not k):
        k.append('계약직·기간제')
    if not k:
        k = ['직원 채용(종류 확인)']
    return sorted(set(k), key=KINDS.index)


# ---------------- 잡알리오 ----------------
def alio_list():
    out, page = [], 1
    while page <= 30:
        url = f'https://job.alio.go.kr/recruit.do?pageNo={page}&pageSet=100&ing=2'
        t = get(url)
        body = t[t.find('<table class="tbl type_03">'):]
        rows = re.findall(r'<tr>(.*?)</tr>', body, re.S)
        got = 0
        for r in rows:
            m = re.search(r'recruitview\.do\?idx=(\d+)', r)
            tds = [strip(x) for x in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)]
            if not m or len(tds) < 9:
                continue
            got += 1
            out.append({'src': '잡알리오', 'id': 'alio-' + m.group(1), 'idx': m.group(1), 'title': tds[2], 'org': tds[3],
                        'loc': tds[4], 'work_type': tds[5], 'posted': ymd(tds[6]), 'deadline': ymd(tds[7]),
                        'url': f'https://job.alio.go.kr/recruitview.do?idx={m.group(1)}'})
        if got < 100:
            break
        page += 1
    return out


def alio_detail(idx):
    t = get(f'https://job.alio.go.kr/recruitview.do?idx={idx}')
    if not t:
        return {}
    s = html.unescape(re.sub(r'<[^>]+>', '\n', t[t.find('공공기관 채용정보'):]))
    s = re.sub(r'[ \t]+', ' ', s)
    lines = [l.strip() for l in s.split('\n') if l.strip()]

    def after(label):
        for i, l in enumerate(lines):
            if l == label and i + 1 < len(lines):
                return lines[i + 1]
        return ''

    def block(label, stops):
        for i, l in enumerate(lines):
            if l == label:
                buf = []
                for x in lines[i + 1:]:
                    if x in stops:
                        break
                    buf.append(x)
                return '\n'.join(buf[:40])
        return ''
    stops = {'응시자격', '결격사유', '우대내용', '전형절차/방법', '제출서류', '기타사항', '첨부파일', '전형단계별 채용정보', '문의처'}
    files = []
    for m in re.finditer(r'href="(https://www\.alio\.go\.kr/download/download\.json\?fileNo=\d+)"[^>]*>(.*?)</a>', t, re.S):
        files.append({'name': strip(m.group(2)) or '첨부파일', 'url': m.group(1)})
    return {
        'ncs': after('표준직무(NCS)'), 'edu': after('학력정보'), 'field': after('근무분야'),
        'career': after('채용구분'), 'work_type_full': after('고용형태'), 'locs': [x.strip() for x in after('근무지').split(',') if x.strip()],
        'pay': after('급여정보'), 'headcount': after('채용인원'), 'home_url': after('공고 URL :'),
        'qualification': block('응시자격', stops), 'preference': block('우대내용', stops),
        'process': block('전형절차/방법', stops), 'files': files[:10],
    }


# ---------------- 클린아이 ----------------
def cleaneye_list(max_pages=40):
    out = []
    for page in range(1, max_pages + 1):
        t = get('https://job.cleaneye.go.kr/user/selectYpRecruitment.do', {'pageIndex': page, 'status': ''},
                {'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://job.cleaneye.go.kr/user/ypRecruitment.do'})
        try:
            L = json.loads(t)['list']
        except Exception:
            break
        if not L:
            break
        old = 0
        for x in L:
            posted = ymd(x.get('pubDate'))
            if posted and (TODAY - datetime.date.fromisoformat(posted)).days > 45:
                old += 1
                continue
            out.append({'src': '클린아이', 'id': f"ce-{x.get('empyear')}-{x.get('ypEntId')}-{x.get('entSeq')}", 'title': x.get('entTitle', ''),
                        'org': x.get('entName', ''), 'loc': x.get('localName', '') or '', 'work_type': '', 'posted': posted,
                        'deadline': ymd(x.get('pubEndDate')),
                        'url': f"https://job.cleaneye.go.kr/user/ypCareersData.do?empyear={x.get('empyear')}&ypEntId={x.get('ypEntId')}&entSeq={x.get('entSeq')}"})
        if old == len(L):
            break
    return out


# ---------------- recruiter.co.kr ----------------
def recruiter_list(sub, org_name):
    t = get(f'https://{sub}.recruiter.co.kr/app/jobnotice/list.json?pageSize=50&currentPage=1', b'')
    try:
        L = json.loads(t)['list']
    except Exception:
        return []
    out = []
    for x in L:
        def d(k):
            v = x.get(k) or {}
            return datetime.datetime.fromtimestamp(v['time'] / 1000, KST).date().isoformat() if v.get('time') else ''
        out.append({'src': 'recruiter', 'id': f"rc-{sub}-{x['jobnoticeSn']}", 'title': x.get('jobnoticeName', ''), 'org': org_name,
                    'loc': '', 'work_type': x.get('recruitClassName', ''), 'posted': d('applyStartDate'), 'deadline': d('applyEndDate'),
                    'state': x.get('receiptState', ''),
                    'url': f"https://{sub}.recruiter.co.kr/career/jobs/{x['jobnoticeSn']}"})
    return out


# ---------------- 메인 ----------------
def main():
    orgs = load_orgs()
    try:
        with open(JOBS, encoding='utf-8') as f:
            db = json.load(f)
    except FileNotFoundError:
        db = {'jobs': {}}
    jobs = db['jobs']
    now = datetime.datetime.now(KST).isoformat(timespec='minutes')

    fetched = []
    a = alio_list(); print('잡알리오', len(a)); fetched += a
    c = cleaneye_list(); print('클린아이', len(c)); fetched += c
    for o in orgs:
        if o.get('recruiter'):
            r = recruiter_list(o['recruiter'], o['name']); print(o['name'], len(r)); fetched += r

    new_ids = []
    for j in fetched:
        o = match_org(orgs, j['org'], j['title'])
        target = bool(o)
        if not target:
            # 관심 기관이 아니면 사무·행정 계열 신입/인턴만 남김
            if j['src'] == 'recruiter' or EXCLUDE.search(j['title']) or not (OFFICE.search(j['title']) or re.search(r'정규직|인턴|계약|기간제', j['work_type'] + j['title'])):
                continue
        if RESTRICT.search(j['title']) and '포함' not in j['title']:
            continue
        if OTHER.search(j['title']) and not re.search(r'신입|인턴', j['title']):
            continue  # 경력·임원 공고는 보지 않음
        if TECH.search(j['title']) and not re.search(r'사무|행정|일반직|상경|경제|경영|금융|인턴|정규직|공채|신입사원|신입직원', j['title']):
            continue  # 기술직만 뽑는 공고는 보지 않음 (경제 직렬 기준)
        if TECH_STRICT.search(j['title']):
            continue  # 괄호로 기술·연구 분야를 명시한 공고
        old = jobs.get(j['id'])
        rec = old or {'first_seen': now}
        rec.update({k: v for k, v in j.items() if k != 'idx'})
        rec['last_seen'] = now
        rec['target'] = target
        rec['group'] = o['group'] if o else '기타 공공기관'
        rec['org_key'] = o['name'] if o else ''
        if j['src'] == '잡알리오' and (target or not old) and not (old and old.get('detail')):
            rec['detail'] = alio_detail(j['idx'])
            time.sleep(0.5)
        locs = (rec.get('detail') or {}).get('locs') or [x for x in re.split(r'\s*외\s*\d+|,', j['loc']) if x.strip()]
        rec['regions'] = region_tags(locs, j['title'], o)
        rec['kinds'] = kind_tags(((rec.get('detail') or {}).get('work_type_full') or '') + ',' + j['work_type'], j['title'])
        if not old:
            new_ids.append(j['id'])
        jobs[j['id']] = rec

    # 상태 갱신
    for j in jobs.values():
        dl = j.get('deadline')
        j['open'] = bool(dl) and datetime.date.fromisoformat(dl) >= TODAY
        if j.get('state') == '접수마감':
            j['open'] = False

    db.update({'updated': now, 'new_today': new_ids, 'jobs': jobs})
    with open(JOBS, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=0)
    tgt = sum(1 for i in new_ids if jobs[i]['target'])
    print(f'완료: 전체 {len(jobs)}건, 오늘 새 공고 {len(new_ids)}건(관심 기관 {tgt}건)')


if __name__ == '__main__':
    main()
