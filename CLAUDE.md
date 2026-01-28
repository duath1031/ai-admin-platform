# AI Admin Platform - 작업 메모

## ✅ 완료: The Navigator (정부24 딥링크) - 2026-01-28

### 핵심 변경
- PDF 생성 완료 후 **[🚀 정부24 접수 페이지로 이동]** 버튼 강조 표시
- `serviceRegistry.ts`의 `gov24.directUrl` 필드로 직접 신청 페이지 연결
- 애니메이션 효과로 사용자 주의 유도

### 수정된 파일
- `app/(dashboard)/submit/components/SubmissionActions.tsx` - The Navigator UI
  - PDF 생성 완료 시 성공 메시지 표시
  - 정부24 버튼에 그라디언트, 펄스 애니메이션 적용
  - 필요서류 목록 표시 추가

---

## ✅ 완료: The Brain (대용량 지식 파이프라인) - 2026-01-28

### 핵심 변경
- Vercel 10초 타임아웃 우회 → **RPA Worker로 직접 업로드**
- 500MB 파일 지원, 비동기 처리 + 실시간 상태 폴링

### 수정/생성된 파일
- `app/admin/knowledge/page.tsx` - The Brain 관리자 UI (전면 개편)
  - RPA Worker 상태 표시
  - 드래그&드롭 업로드
  - 실시간 진행률 표시 (텍스트 추출 → 청크 분할 → 임베딩 생성)
- `.env` - `NEXT_PUBLIC_RPA_URL`, `RPA_WORKER_API_KEY` 추가

### RPA Worker RAG 엔드포인트 (기존 구현됨)
- `POST /rag/upload` - 대용량 문서 업로드 (500MB)
- `GET /rag/status/:id` - 처리 상태 조회
- `POST /rag/search` - 벡터 검색
- `GET /rag/health` - 서비스 헬스체크

### 사용법
1. `/admin/knowledge` 접속
2. PDF/DOCX/TXT 파일 드래그&드롭 또는 클릭하여 선택
3. 제목, 카테고리 입력 후 "🚀 업로드 시작"
4. 진행률 확인 (자동 폴링)
5. 완료 후 AI 상담 시 해당 문서 참조

---

## ✅ 완료: DOCX 템플릿 엔진 (The Writer) - 2026-01-27

### 핵심 변경
- **PDF 좌표 매핑 방식 폐기** → **DOCX 플레이스홀더 치환 방식** 도입
- `{{변수명}}` 형태로 수천 개 서식에 즉시 대응 가능

### 생성된 파일
- `lib/document/docxEngine/index.ts` - DOCX 템플릿 엔진 코어
- `app/api/document/generate-docx/route.ts` - 문서 생성 API
- `app/api/admin/templates/upload/route.ts` - 템플릿 업로드 API
- `app/api/admin/templates/metadata/route.ts` - 메타데이터 관리 API
- `app/(dashboard)/admin/tools/template-manager/page.tsx` - 템플릿 관리 UI
- `public/templates/docx/MAIL_ORDER_SALES.docx` - 통신판매업 신고서 샘플 템플릿
- `public/templates/docx/MAIL_ORDER_SALES.json` - 필드 메타데이터
- `scripts/create-sample-template.js` - 샘플 템플릿 생성 스크립트
- `scripts/test-docx-engine.js` - 엔진 테스트 스크립트

### 사용법
1. Word에서 `{{businessName}}`, `{{address}}` 같은 플레이스홀더로 DOCX 작성
2. `/admin/tools/template-manager`에서 업로드
3. 메타데이터 (필드 정의) 설정
4. API 호출 또는 UI에서 문서 생성

### 자동 변수
- `{{today}}` - 오늘 날짜 (2026년 1월 27일)
- `{{todayYear}}`, `{{todayMonth}}`, `{{todayDay}}` - 연/월/일

---

## 🎯 핵심 기능 완성 현황

| 미션 | 이름 | 상태 | 설명 |
|------|------|------|------|
| 1 | The Writer | ✅ 완료 | DOCX 템플릿 엔진 |
| 2 | The Brain | ✅ 완료 | 대용량 지식 파이프라인 (500MB) |
| 3 | The Navigator | ✅ 완료 | 정부24 딥링크 시스템 |

### 테스트 방법
```bash
# 엔진 테스트
node scripts/test-docx-engine.js

# 개발 서버 실행 후 관리자 페이지 접속
npm run dev
# http://localhost:3000/admin/tools/template-manager
```

---

## 🚀 다음 작업: 관리자 페이지 구축 (우선순위 1)

### 관리자 페이지 기능 요구사항
1. **시스템 프롬프트 관리**
   - DB에 시스템 프롬프트 저장 (Supabase)
   - 관리자 페이지에서 실시간 수정 가능
   - 코드 배포 없이 AI 지침 변경 가능하도록
   - Google AI Studio "나의 지침"과 동기화 불필요 (플랫폼에서 직접 관리)

2. **UI 설정 관리**
   - 사이트 설정 (로고, 색상, 푸터 문구 등)
   - 메뉴 구성 변경
   - 공지사항/배너 관리

3. **회원 관리**
   - 가입 회원 목록
   - 회원 등급 관리 (Guest/VIP/Admin)
   - 구독 상태 관리

4. **통계 대시보드**
   - 일별/월별 사용량
   - 인기 질문 유형
   - 민원 접수 현황

### 구현 계획 (완료됨 - 2026-01-24)
- [x] Prisma 스키마에 SystemPrompt, SiteSettings 테이블 추가
- [x] `/admin` 라우트 생성 (관리자 전용)
- [x] 관리자 권한 체크 미들웨어
- [x] 시스템 프롬프트 CRUD API (`/api/admin/prompts`)
- [x] 시스템 프롬프트 편집 UI (`/admin/prompts`)
- [x] 사용자 관리 페이지 (`/admin/users`)
- [x] 사이트 설정 관리 페이지 (`/admin/settings`)
- [x] gemini.ts에서 DB의 시스템 프롬프트 조회하도록 수정 (`lib/systemPromptService.ts`)

---

## ⚠️ 이메일 알림 제한사항
- Resend 무료 플랜: 본인 이메일(duath1031@gmail.com)로만 발송 가능
- 다른 이메일로 발송하려면 도메인 인증 필요 (Wix에서 어려움)
- 임시 해결: ADMIN_EMAIL을 Gmail로 설정

## 🚨 다음 작업 (2026-01-24 중단 지점)

### 즉시 해야 할 일: Playwright 버전 수정 후 재배포
1. **Dockerfile 수정 완료** - `v1.41.0` → `v1.50.0-noble`로 변경함
2. **커밋 & 푸시 필요**:
   ```bash
   cd "E:\염현수행정사\주식회사어드미니\ai-admin-platform"
   git add rpa-worker/Dockerfile
   git commit -m "fix: Playwright Docker 이미지 버전 업데이트 (v1.50.0)"
   git push origin main
   ```
3. **Railway 재배포**:
   ```bash
   cd rpa-worker && railway up
   ```
4. **테스트**:
   ```bash
   curl -X POST https://admini-rpa-worker-production.up.railway.app/gov24/auth/request \
     -H "Content-Type: application/json" \
     -H "X-API-Key: admini-rpa-worker-2024-secure-key" \
     -d '{"name":"본인이름","birthDate":"YYYYMMDD","phoneNumber":"010XXXXXXXX","carrier":"SKT"}'
   ```

### 현재 에러
- Playwright 버전 불일치: Docker 이미지 v1.41.0 vs npm 설치 v1.58.0
- 브라우저 실행 파일 없음 에러

---

## 추후 작업
- 결제 시스템 (토스페이먼츠)
- 결제 여부에 따른 기능 활성화 (Guest/VIP 분기)
- Resend 도메인 인증 (별도 도메인 필요)
- ~~RPA Worker Railway 배포 및 연동 테스트~~ ⚠️ 배포 완료, 버전 수정 필요

---

## 완료된 작업 - RPA Worker Railway 배포 (2026-01-24)

### 배포 정보
- **Railway URL**: https://admini-rpa-worker-production.up.railway.app
- **Railway 프로젝트**: admini-rpa-worker
- **API Key**: admini-rpa-worker-2024-secure-key

### Vercel 환경변수 (설정 필요)
```
RPA_WORKER_URL=https://admini-rpa-worker-production.up.railway.app
RPA_WORKER_API_KEY=admini-rpa-worker-2024-secure-key
```

### RPA Worker 엔드포인트
- `GET /health` - 헬스체크
- `POST /gov24/auth/request` - 간편인증 요청
- `POST /gov24/auth/confirm` - 간편인증 확인
- `POST /gov24/submit` - 민원 제출

### 현재 구현 상태
| 기능 | 상태 |
|------|------|
| 간편인증 요청/확인 | ✅ 구현 완료 (테스트 필요) |
| 민원 제출 | ⚠️ 기본 프레임만 (실제 정부24 테스트 필요) |

---

## 완료된 작업 - 부동산 정보 자동 조회 (2026-01-24)

### 주소 기반 자동 조회 기능
- 사용자가 주소와 함께 허가/인허가 질문 시 자동으로 조회
- 예: "용종로123 호스텔 허가 가능하니?" → 토지이용계획 + 건축물대장 자동 조회

### 생성/수정 파일
- `lib/buildingApi.ts` - 공공데이터포털 건축물대장 API 연동 (신규)
- `app/api/chat/route.ts` - 주소 패턴 매칭 강화 + 건축물대장 조회 통합

### 기능 상세
1. **주소 패턴 매칭 강화**
   - 간단한 도로명 주소 인식: "용종로123", "세종대로 100" 등
   - 기존 패턴 + 새 패턴 추가

2. **토지이용계획 조회** (V-World API)
   - 용도지역/지구 정보
   - 허용/제한 업종 정보

3. **건축물대장 조회** (공공데이터포털 API)
   - 주용도, 세부용도
   - 구조, 층수
   - 면적 (대지/건축/연면적)
   - 건폐율, 용적률
   - 사용승인일
   - 위반건축물 여부
   - 주차대수

4. **용도변경 가능성 분석**
   - 현재 용도 → 목표 업종 변경 가능성 간이 분석
   - 허가/신고 여부 안내

### 환경변수
- `VWORLD_KEY` - V-World API 키 (토지이용계획)
- `PUBLIC_DATA_KEY` - 공공데이터포털 API 키 (건축물대장)

---

## 완료된 작업 - RPA Worker 서버 (2026-01-24)

### 하이브리드 마이크로서비스 아키텍처
- Main Server (Vercel/Next.js): UI, DB, AI 채팅, 문서 생성
- Worker Server (Railway/Express): Playwright RPA (정부24 자동화)

### 생성된 파일
- `rpa-worker/Dockerfile` - Playwright 및 한글 폰트 설정
- `rpa-worker/server.js` - Express API 서버
- `rpa-worker/gov24Logic.js` - 정부24 간편인증 및 민원 제출 로직
- `rpa-worker/package.json` - 의존성 정의
- `rpa-worker/.env.example` - 환경변수 템플릿
- `app/api/rpa/delegate/route.ts` - Vercel→Railway 작업 위임 API

### RpaTask 스키마 확장
- `workerId` - Worker 서버 ID
- `workerTaskId` - Worker 내부 작업 ID
- `sessionCookies` - 로그인 세션 쿠키
- `authPhase` - 인증 단계 (waiting/confirmed/expired)

### 배포 가이드
1. Railway에서 rpa-worker 폴더 배포
2. 환경변수 설정: `WORKER_API_KEY`, `ALLOWED_ORIGINS`
3. Vercel에서 `RPA_WORKER_URL`, `RPA_WORKER_API_KEY` 설정

## 완료된 작업

### Google AI Studio "나의 지침" 연동 (2026-01-22)
- ✅ `lib/gemini.ts` - systemInstruction 파라미터 사용으로 변경
- ✅ Gemini Chat API를 startChat 방식으로 변경 (대화 히스토리 지원)
- ✅ `lib/systemPrompts.ts` - Google AI Studio 지침과 기존 RAG 지침 통합
- ✅ 2026년 정책자금(중진공/소진공), 관광기금, 식품위생 등 상세 지침 추가
- ⚠️ 참고: Google AI Studio 웹에서 설정한 "나의 지침"은 API에 자동 연동되지 않음
  - 동일한 API 키를 사용해도 별도로 systemInstruction 파라미터로 전달해야 함
  - 현재 코드에서는 systemPrompts.ts의 내용을 systemInstruction으로 전달

### 맥락 인식형 RAG 시스템 (2025-01-22)
- ✅ `lib/rag/intentClassifier.ts` - 질문 의도 분류기 (절차/분쟁 구분)
- ✅ `lib/rag/lawService.ts` - Intent 기반 법령 검색 (판례는 분쟁 질문에서만)
- ✅ `lib/utils/linkValidator.ts` - 링크 유효성 검사 및 대체 링크 생성
- ✅ `lib/config/hikoreaLinks.ts` - 하이코리아 서식 고정 링크
- ✅ `app/api/admin/system-check/route.ts` - 시스템 상태 점검 API

### 모바일 반응형 UI (2025-01-22)
- ✅ 사이드바: 모바일에서 오버레이로 표시, 백드롭 추가
- ✅ 레이아웃: 모바일에서 컨텐츠 전체 너비 사용
- ✅ 채팅 페이지: 모바일 높이/여백/폰트 크기 조정
- ✅ 민원 접수: 탭 네비게이션 모바일 최적화

### 인허가 자가진단 V-World API 연동 (2025-01-22)
- ✅ `app/api/permit-check/route.ts`에서 estimateZone 키워드 기반 추정 함수 제거
- ✅ `lib/landUseApi.ts`의 searchLandUse 함수로 실제 V-World API 조회 연동
- ✅ zoneSource 필드 추가로 데이터 출처 표시 ("V-World API" 또는 "추정")
- ✅ V-World 도메인 설정: aiadminplatform.vercel.app 등록 완료

### 버그 수정 (2025-01-22)
- ✅ 법령 링크 URL 인코딩 → 검색 URL로 변경
- ✅ 이메일 에러 로깅 개선 (Resend 무료 플랜 제한 안내)

---

## 현재 설정 정보

### Vercel
- URL: https://aiadminplatform.vercel.app
- 프로젝트명: aiadminplatform

### 데이터베이스 (Supabase)
- PostgreSQL
- Connection: Session pooler 사용

### 환경변수 (Vercel에 설정됨)
- DATABASE_URL: Supabase PostgreSQL
- NEXTAUTH_URL: https://aiadminplatform.vercel.app
- NEXTAUTH_SECRET: 설정됨
- GOOGLE_CLIENT_ID: 설정됨
- GOOGLE_CLIENT_SECRET: 설정됨
- GOOGLE_AI_API_KEY: 설정됨
- RESEND_API_KEY: 설정됨
- ADMIN_EMAIL: duath1031@gmail.com
- ADMIN_EMAILS: duath1031@gmail.com,Lawyeom@naver.com

### 알림 시스템
- 이메일: Resend (onboarding@resend.dev에서 발송)
- SMS/카카오: 미설정 (유료라서 제외)

### 도메인
- jungeui.com: Wix에서 관리 (Resend 도메인 인증 불가)
