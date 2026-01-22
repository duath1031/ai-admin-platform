# AI Admin Platform - 작업 메모

## 다음 작업 목록 (2025-01-22)

### ✅ 완료: 모바일 반응형 UI 수정
- ✅ 채팅창 모바일 레이아웃 수정됨
- ✅ 사이드바 오버레이 방식으로 변경
- ✅ 민원 접수 탭 모바일 최적화

### ⚠️ 이메일 알림 제한사항
- Resend 무료 플랜: 본인 이메일(duath1031@gmail.com)로만 발송 가능
- 다른 이메일로 발송하려면 도메인 인증 필요 (Wix에서 어려움)
- 임시 해결: ADMIN_EMAIL을 Gmail로 설정

### 추후 작업
- 결제 시스템 (토스페이먼츠)
- 회원 관리 대시보드
- 결제 여부에 따른 기능 활성화
- Resend 도메인 인증 (별도 도메인 필요)

## 완료된 작업

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
