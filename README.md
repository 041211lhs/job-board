# 금융·공공 채용 보드

금융공기업·시중은행·경남/부산/서울 지역 공공기관 채용 공고를 매일 모아 보여주는 개인용 사이트.

- 사이트: https://041211lhs.github.io/job-board/
- 수집: `collector/collect.py` (잡알리오 · 클린아이 잡플러스 · recruiter.co.kr) → `docs/data/jobs.json` 누적
- 알림: `collector/notify.py` (디스코드 — 새 공고 매일 / 마감 2일 전 / 금요일 요약)
- 자동 실행: `.github/workflows/collect.yml` (매일 07:00 KST)
- 기관별 채용조건: `docs/data/orgs.json` (2025·2026 공고 원문 기준 조사)
- 구글 시트: `google_sheet.gs` 를 시트의 Apps Script 에 붙여넣고 `setup` 실행

개인 정보(스펙·지원 이력)는 이 저장소에 넣지 않는다.
