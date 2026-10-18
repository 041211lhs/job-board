# -*- coding: utf-8 -*-
"""디스코드 알림: 매일 새 공고 / 마감 2일 전 / 금요일 누적 요약.
DISCORD_WEBHOOK 환경변수(GitHub Secrets)가 있을 때만 보낸다."""
import json, os, datetime, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KST = datetime.timezone(datetime.timedelta(hours=9))
TODAY = datetime.datetime.now(KST).date()
HOOK = os.environ.get('DISCORD_WEBHOOK', '')
SITE = os.environ.get('SITE_URL', '')
MAIN = {'체험형 인턴', '채용형 인턴', '신입 정규직'}

db = json.load(open(os.path.join(ROOT, 'docs', 'data', 'jobs.json'), encoding='utf-8'))
jobs = db['jobs']


def line(j):
    dl = j.get('deadline') or ''
    d = (datetime.date.fromisoformat(dl) - TODAY).days if dl else None
    dd = '상시' if d is None else ('D-DAY' if d == 0 else f'D-{d}')
    return f"• **{j.get('org_key') or j['org']}** {j['title'][:60]} `{'/'.join(j.get('kinds', []))}` `{','.join(j.get('regions', []))}` {dd} <{j['url']}>"


def send(title, lines):
    if not lines:
        return
    chunks, cur = [], f'**{title}**\n'
    for l in lines:
        if len(cur) + len(l) + 1 > 1900:
            chunks.append(cur); cur = ''
        cur += l + '\n'
    chunks.append(cur + (f'\n전체 보기: {SITE}' if SITE else ''))
    for c in chunks:
        req = urllib.request.Request(HOOK, data=json.dumps({'content': c}).encode(), headers={'Content-Type': 'application/json', 'User-Agent': 'job-bot'})
        urllib.request.urlopen(req, timeout=20)


HOME = {'서울', '창원', '부산', '진주', '그 외 경남'}


def wanted(j):
    # 관심 기관은 전부, 기타 공공기관은 인턴·신입 정규직 + 내 지역 계약직·기간제
    if not j.get('open'):
        return False
    k = set(j.get('kinds', []))
    return j.get('target') or k & MAIN or ('계약직·기간제' in k and set(j.get('regions', [])) & HOME)


new = [jobs[i] for i in db.get('new_today', []) if i in jobs and wanted(jobs[i])]
new.sort(key=lambda j: (not j.get('target'), j.get('deadline') or '9999'))
send(f'📢 새 공고 {len(new)}건 ({TODAY:%m/%d})', [line(j) for j in new])

soon = [j for j in jobs.values() if j.get('open') and j.get('target') and j.get('deadline') == (TODAY + datetime.timedelta(days=2)).isoformat()]
send(f'⏰ 마감 2일 전 {len(soon)}건', [line(j) for j in soon])

if TODAY.weekday() == 4:  # 금요일
    allopen = sorted([j for j in jobs.values() if j.get('open') and j.get('target')], key=lambda j: j.get('deadline') or '9999')
    week = [j for j in jobs.values() if j.get('target') and j.get('first_seen', '')[:10] >= (TODAY - datetime.timedelta(days=6)).isoformat()]
    send(f'🗂 금요일 요약 · 이번 주 새 공고 {len(week)}건 · 지금 진행 중 {len(allopen)}건 (마감 순)', [line(j) for j in allopen])
print('알림 완료', len(new), len(soon))
