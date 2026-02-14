# AI Admin Platform - 작업 메모리

## 프로젝트 정보
- **경로**: `E:\염현수행정사\주식회사어드미니\ai-admin-platform`
- **프론트엔드**: Next.js 14 (Vercel 배포, maxDuration: 60초, vercel.json 설정)
- **RPA Worker**: Railway Docker (Playwright stealth), `admini-rpa-worker-production.up.railway.app`
- **Worker API Key**: `admini-rpa-worker-2024-secure-key`
- **Vercel 도메인**: `aiadminplatform.vercel.app`

## 현재 상태 (2026-02-13, Sprint 2 진행 중)
- **Worker**: v37 (CACHE_BUST=20260211_v37_JCONFIRM_MODAL), Railway 배포 완료
- **Vercel**: 최신 배포 완료 (보조금 API 확장 + 크론 추가)
- **Git**: 최신 커밋 `1394842` "보조금 API 확장 + 크론 작업 추가", push 완료
- **문서24 발송 테스트 성공**: 접수번호 M00050-014314
- **API 헬스체크**: Worker 200, Vercel 200 (전체 정상)

## 관리자(ADMIN) 토큰 정책 (2026-02-13 확정)
- **ADMIN role이면 무조건 토큰 무제한** (DB credits 값과 무관)
- `deductTokens()` — ADMIN이면 차감 없이 통과
- `checkFeatureAccess()` — ADMIN이면 모든 기능 접근 (enterprise 레벨)
- `getBalance()` — ADMIN이면 항상 -1(무제한) 반환
- 역할 ADMIN 변경 시 credits = -1 자동 설정
- 일반 사용자: 플랜 변경 시 해당 플랜 tokenQuota 자동 충전

## 요금제별 토큰 할당
| planCode | 가격 | tokenQuota |
|---|---|---|
| starter | 무료 | 1,000 |
| standard | 90,000원/월 | 1,000,000 |
| pro | 150,000원/월 | 3,000,000 |
| pro_plus | 220,000원/월 | 5,000,000 |
| enterprise | 250,000원/월 | -1 (무제한) |

## Sprint 1 완료 (2026-02-11~12)
1. Prisma 스키마 + 시드 데이터 (5개 요금제)
2. 토큰 서비스 + API + planAccess
3. 랜딩페이지 + 모바일 반응형
4. 문서24 검색+발송 (v37 jconfirm 모달)
5. 토큰 미들웨어 - 유료 API 10개
6. 플랜 적용 수정 - getUserPlanCode()
7. RAG 고도화 - 멀티 AI 라우터
8. 관리자 보안 강화 + 대시보드 8개 KPI

## Sprint 2 진행 (2026-02-13~)
### 완료
9. **입찰 시뮬레이터** - 엔진+API+UI (4탭)
10. **관리자 토큰/플랜 수정** - ADMIN 무제한
11. **결제/구독 시스템** (이전에 구현 완료 확인)
    - PortOne V2 빌링키 결제 (`lib/billing/portoneClient.ts`)
    - 구독 서비스 (`lib/billing/subscriptionService.ts`)
    - 페이월 훅 (`lib/billing/usePaywall.ts`) + 모달 (`components/billing/PaywallModal.tsx`)
    - 결제 API 3개: prepare, complete, cancel
    - 구독 API 4개: billing, subscription(GET/PATCH), cancel-subscription
    - 웹훅: `/api/payments/webhook` (Standard Webhooks)
    - 토큰 API 3개: consume, balance, history
    - 토큰 충전 API: `/api/token/purchase`
    - 플랜 API: `/api/plans`
    - 구독 결제 크론: `/api/cron/subscription-billing` (매일 02:00 UTC)
    - Pricing 페이지 + Subscription 페이지 + Token Charge 페이지
12. **보조금 매칭 시스템** (이전에 구현 완료 + 이번 세션 확장)
    - 매칭 엔진: `lib/analytics/fundMatcher.ts` + `fundPrograms.ts` (7개 정책자금)
    - API 5개: match, consulting, generate-application, bookmark(신규), deadlines(신규)
    - UI: `/fund-matching` 페이지
    - DB: SubsidyProgram + SubsidyMatch + DeadlineAlert 모델
13. **크론 작업 완성** (이번 세션)
    - 월간 토큰 리셋: `/api/cron/token-reset` (매월 1일 00:00 UTC)
    - 보조금 동기화: `/api/cron/subsidy-sync` (매일 06:00 UTC, 기업마당 API)
    - 마감 알림: `/api/cron/deadline-alerts` (매일 23:00 UTC, D-30/7/3/1)

### 남은 작업
1. 문서24/정부24 E2E 테스트 (사용자 직접)
2. PortOne 웹훅 URL 등록 (Vercel 배포 후)
3. 기업마당 API 키 발급 (BIZINFO_API_KEY 환경변수)
4. Phase 3 기능들 (법인차량 Fleet, 토지분석 등)

## 전체 API 현황 (Sprint 2 완료 기준)
### 결제/구독
- `POST /api/payment/prepare` - 결제 준비
- `POST /api/payment/complete` - 결제 완료 (PortOne 검증)
- `POST /api/payment/cancel` - 결제 취소
- `POST /api/payments/billing` - 빌링키 등록 + 구독 생성
- `GET /api/payments/subscription` - 구독 조회
- `PATCH /api/payments/subscription` - 플랜 변경
- `POST /api/payments/cancel-subscription` - 구독 해지
- `POST /api/payments/webhook` - PortOne 웹훅
### 토큰
- `POST /api/tokens/consume` - 토큰 차감 (페이월 체크)
- `GET /api/tokens/balance` - 잔액 조회
- `GET /api/tokens/history` - 사용 내역
- `GET /api/token/purchase` - 충전 패키지 목록
- `POST /api/token/purchase` - 토큰 충전 결제
### 보조금
- `POST /api/subsidy/match` - 매칭 실행 (2,000 토큰)
- `POST /api/subsidy/consulting` - AI 전략 분석 (3,000 토큰)
- `POST /api/subsidy/generate-application` - 신청서 자동 생성 (5,000 토큰)
- `PATCH /api/subsidy/bookmark` - 즐겨찾기 토글
- `GET /api/subsidy/bookmark` - 즐겨찾기 목록
- `GET /api/subsidy/deadlines` - 마감임박 목록 (30일 이내)
### 크론 (7개)
- `/api/cron/keep-alive` - 5분마다
- `/api/cron/renew-knowledge` - 6시간마다
- `/api/cron/procurement` - 매일 00:00, 09:00 (입찰+낙찰+예비가격)
- `/api/cron/subscription-billing` - 매일 02:00 (자동결제)
- `/api/cron/subsidy-sync` - 매일 06:00 (보조금 동기화)
- `/api/cron/deadline-alerts` - 매일 23:00 (마감 알림)
- `/api/cron/token-reset` - 매월 1일 00:00 (토큰 리셋)

## 핵심 파일
### 결제/구독
- `lib/billing/portoneClient.ts` - PortOne V2 API 클라이언트
- `lib/billing/subscriptionService.ts` - 구독 라이프사이클 관리
- `lib/billing/usePaywall.ts` - 페이월 훅 (클라이언트)
- `hooks/usePayment.ts` - 결제 훅 (PortOne SDK)
- `components/billing/PaywallModal.tsx` - 페이월 모달 UI
- `app/(dashboard)/pricing/page.tsx` - 요금제 페이지
- `app/(dashboard)/subscription/page.tsx` - 구독 관리 페이지
- `app/(dashboard)/token-charge/page.tsx` - 토큰 충전 페이지
### 보조금
- `lib/analytics/fundMatcher.ts` - 정책자금 매칭 엔진
- `lib/analytics/fundPrograms.ts` - 7개 정책자금 프로그램 데이터
- `app/(dashboard)/fund-matching/page.tsx` - 보조금 매칭 UI
- `app/api/subsidy/bookmark/route.ts` - 즐겨찾기 API
- `app/api/subsidy/deadlines/route.ts` - 마감임박 API
### 입찰
- `lib/analytics/bidSimulator.ts` - 입찰 시뮬레이션 엔진
- `app/api/analytics/bid-simulation/route.ts` - 시뮬레이션 API
- `app/(dashboard)/bid-simulation/page.tsx` - 시뮬레이터 페이지
### 핵심
- `lib/token/tokenService.ts` - 토큰 (ADMIN 무제한)
- `lib/token/planAccess.ts` - 플랜별 접근 제어
- `prisma/schema.prisma` - DB 스키마
- `lib/ai/multiRouter.ts` - 멀티 AI 라우터
- `rpa-worker/doc24Logic.js` - 문서24 Bot (v37)

## 장기 로드맵
- **Admini 5.0 통합개발계획**: `memory/admini-5.0-plan.md`
- **HWPX 서식 목록**: `memory/government-forms-master-list.md` (206개)
- Phase 3: 법인차량 Fleet 관리, 토지분석, 안전관리(TBM)

## 주의사항
- **모든 CLI 명령에 --yes 자동 적용**
- **ADMIN role = 토큰 무제한**
- Railway 배포: Dockerfile CACHE_BUST 변경 필수
- Vercel: `npx vercel --prod --yes`
- Supabase: connection_limit=1 필수
- `prisma migrate dev` 안됨 → `prisma db push` 사용
- jconfirm 모달: `.jconfirm-box` 셀렉터
- Company profile BigInt 필드: JSON 직렬화 시 Number() 변환
- 관리자 플랜 변경 시: credits 안 보내야 tokenQuota 자동 적용됨
- SubsidyProgram: source+externalId 복합 유니크 제약조건 (upsert용)
