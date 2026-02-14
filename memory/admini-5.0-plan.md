# Admini 5.0 Ultimate Edition - 통합개발계획

## 최종 비전
- "대한민국 모든 기업의 AI COO (J.A.R.V.I.S)"
- 행정사 + 중소기업 + 스타트업 원스톱 행정 자동화 플랫폼

---

## Part 1: 요금제 (4-Tier)

| | Starter | Standard | Pro | Pro Plus |
|---|---|---|---|---|
| **planCode** | starter | standard | pro | pro_plus |
| **가격** | 무료 (1회) | 90,000원/월 | 150,000원/월 | 220,000원/월 |
| **대상** | 체험 사용자 | 소규모/개인 사업자 | 기업담당자, 공무원, 일반행정사 | 전문행정사, 전문기업담당자, 법무팀 |
| **제한** | 계정당 평생 1회 | 월간 | 월간 무제한 | 월간 무제한 |
| **Pro Plus 핵심** | - | - | - | 거래처 관리50개, 거래처별 서류함, 대시보드, 일괄 보조금매칭, 고객 리포트PDF, 위임장 자동생성, 전담지원 |
| **행정사 할인** | - | - | - | 첫 6개월 50% (220,000→110,000원) |

---

## Part 2: 긴급 작업 (현재 진행 상황)

### 완료됨 (v37, 2026-02-12)
- [x] Prisma 스키마 5개 신규 모델 + ceoGender
- [x] DB 적용 (prisma db push)
- [x] 시드 데이터 4개 요금제
- [x] 토큰 서비스 (tokenCosts, tokenService, withTokenCheck, planAccess)
- [x] 토큰 API 3개 (balance, history, purchase)
- [x] 랜딩페이지 11개 기능 소개
- [x] 모바일 반응형 전체
- [x] 대표자 성별 + 인증진단 연동
- [x] **문서24 봇 완전 수정** (v37 jconfirm 모달, 발송 성공 접수번호 M00050-014314)

### 완료됨 (2026-02-12~13, Sprint 1~3 전체 완료)
- [x] 요금제 재설계 반영 (시드 데이터 5개 요금제, planAccess 매핑 완료)
- [x] 빌링키 + 구독 결제 API 12개 (billing, subscription, cancel, webhook, prepare, complete, cancel)
- [x] 페이월 시스템 (usePaywall, PaywallModal 완성)
- [x] 결제/구독 UI (pricing, subscription, token-charge 페이지)
- [x] 보조금 매칭 엔진 + API 5개 + UI (fundMatcher + subsidy/match + consulting + generate-application + bookmark)
- [x] Cron 5개 (subscription-billing, deadline-alerts, renew-knowledge, keep-alive, procurement)
- [x] 토큰 미들웨어 10개 API 적용 + 플랜 체크
- [x] 관리자 플랜 변경→Subscription 자동 동기화
- [x] RAG 고도화: 멀티 AI 라우터 + 법령 캐시 + AI 서류 검증 API
- [x] 관리자 보안: 인증 누락 수정 + 분석 API + 대시보드 8개 KPI
- [x] Worker/Vercel 전체 정상 동작 확인

### 다음 단계 (Sprint 4~5)
- [ ] Sprint 4: 서류 확장 (HWPX 206개 목표)
- [ ] Sprint 5: 최종 보안 + 출시 준비
- [ ] Phase 2: 나라장터 입찰 시뮬레이터

---

## Part 3: 킬러 피처

### 3-1. 문서24 봇 (완성)
- jconfirm 모달 방식 수신기관 검색/선택
- HWP API InsertText 본문 입력
- 3-Way: 직접접수(무료) / 문서24봇(구독) / 전문가대행(50,000원/건)
- 폴백 체인: 봇 실패 → 가이드 모드 → 대행 접수 전환

### 3-2. 무제한 입찰 시뮬레이터 (Phase 2)
- 나라장터 공고 파싱 → 사정율 분포 분석 → 슬라이더로 투찰가 조정
- 특허 회피: AI "예측/추천" X, 과거 데이터 "분석 도구" O
- 스마트 필터: 면허/실적/신용 기반 1순위 가능 공고
- AI 프로젝트 매니저: 입찰마감/보증서/제안서/기성 알림

### 3-3. 법인차량 Fleet 관리 (Phase 3 킬러 피처 - 신규 추가)
- 운행기록부 자동화 (GPS 연동 or 수동 입력)
- 차량별 비용 관리 (유류비, 보험, 정비)
- 법인차량 세무 처리 자동화
- 운전자 배정 및 예약 시스템

### 3-4. R&D 연구노트 & 전자결재 (Phase 3)
- 블록체인 타임스탬프 (연구노트 위변조 방지)
- 결재 라인 설정 / 자동 라우팅

### 3-5. 보조금/정책자금 매칭
- CompanyProfile 기반 점수 산출 (matchScore 0~100)
- 기업마당 API + 보조금24 API 자동 동기화
- 기한 알림 D-30/D-7/D-1

---

## Part 4: 서식 DB + RAG

### HWPX 서식 (206개 목표)
- 마스터 목록: `memory/government-forms-master-list.md`
- 저장 경로: `public/templates/hwpx/`
- AI 서류 검증: 형식검증 → RAG 법령대조 → 첨부서류체크 → 반려예측

### 법령 벡터DB (RAG)
- 국가법령정보센터 API → 핵심 법령 200개 수집
- 청킹 (800자, 100자 오버랩) → Gemini text-embedding-004 → Supabase pgvector
- 민원 메타데이터 1,000개 임베딩

### 멀티 AI 라우터
- Gemini Flash로 의도 분류 → 모델 라우팅
- simple_qa → Gemini Flash (60%), legal_analysis → Claude API (15%)
- API 비용 ~60% 절감

---

## Part 5: 단계별 로드맵

### Phase 1: 민원 행정 (현재) ✅ 거의 완료
- 문서24 봇 (v37 완성), 정부24 인증/제출/검색
- 결제/구독/토큰 시스템 (Sprint 1 진행 중)

### Phase 2: 조달/입찰 & 자금 (다음 즉시)
- 나라장터 크롤러 + 입찰 시뮬레이터
- 정책자금/보조금 매칭
- 토스페이먼츠 구독 결제
- Timeline: +1~3개월

### Phase 3: 기업 운영 & 인사 (법인차량 Fleet 추가됨)
- **법인차량 Fleet 관리** (킬러 피처 - 신규)
- R&D 연구노트 & 전자결재
- 노무/4대보험 자동화 (50인 미만 타겟)
- 외국인 채용/비자 (E-7, E-9, D-10)
- Timeline: +3~6개월

### Phase 4: 안전/환경
- 중대재해 TBM 음성인식, 위험성평가 AI
- 올바로시스템 연동
- Timeline: +6~9개월

### Phase 5: 부동산/개발
- 토지 분석 리포트 (LURIS + 조례 + 대장)
- 세움터 건축행정 연동
- Timeline: +9~12개월

### Phase 6: 법무/계약
- AI 계약서 리스크 분석 (독소조항 감지)
- 내용증명/지급명령 자동 작성

---

## 6주 Sprint 상세 일정

### Sprint 1: 결제 + 토큰 + 보조금 (Week 1) - 진행 중
```
Day 1: ✅ Prisma 스키마 + DB push + 시드 데이터
Day 2: ✅ tokenCosts + tokenService + planAccess + withTokenCheck
Day 3: 빌링키 API + 구독 API + 웹훅
Day 4: 토큰 API + PaywallModal + usePaywall
Day 5: Pricing + 구독관리 + 카드관리 UI
Day 6: 보조금 매칭 엔진 + API + 데이터
Day 7: 보조금 UI + Cron + 페이월 적용
```

### Sprint 2: 문서24 안정화 (Week 2) - ✅ v37로 완료
```
✅ 수신기관 jconfirm 모달 완전 수정
✅ 실제 발송 E2E 테스트 성공 (접수번호 수령)
남은 것: 폴백 체인 UI, RPA 증거(스크린샷), withTokenCheck 적용
```

### Sprint 3: RAG & 멀티 라우팅 (Week 3~4)
### Sprint 4: 서류 확장 (Week 4~5)
### Sprint 5: 관리자 + 보안 + 출시 (Week 5~6)

---

## 5대 Bot
| Bot | 시스템 | 우선순위 |
|-----|--------|----------|
| CivilBot | 문서24, 정부24 | 1순위 (v37 완성) |
| G2BBot | 나라장터 | 1순위 (다음) |
| HRBot | 고용산재토탈, 하이코리아 | 2순위 |
| LandBot | LURIS, 세움터 | 3순위 |
| SafetyBot | 자체(음성인식) | 3순위 |

## 환경변수 추가 필요
```
PORTONE_STORE_ID, PORTONE_CHANNEL_KEY, PORTONE_WEBHOOK_SECRET
CRON_SECRET (Vercel cron 인증)
BIZINFO_API_KEY (기업마당 API)
```

## 기술 스택
- Frontend: Next.js 14, Tailwind, Zustand, PortOne V2 SDK
- Backend: Next.js API Routes, Prisma, Supabase (PostgreSQL + pgvector)
- RPA: Railway Docker, Playwright stealth, in-memory queue
- AI: Gemini Flash/Pro (주력) + Claude API (법률분석)
- 결제: 토스페이먼츠 via PortOne V2 빌링키
- 배포: Vercel (프론트) + Railway (Worker)
