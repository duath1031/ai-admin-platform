# AI Admin Platform - 작업 메모

## 다음 작업 목록 (2025-01-22)

### 1. 모바일 반응형 UI 수정
- 채팅창이 모바일에서 세로로 깨짐
- 전체적인 모바일 레이아웃 점검 필요

### 2. 이메일 알림 확인
- Gmail 스팸함에서 관리자 알림 확인
- Resend에서 발송은 되고 있음 (To: duath1031@gmail.com)

### 3. 추후 작업
- 결제 시스템 (토스페이먼츠)
- 회원 관리 대시보드
- 결제 여부에 따른 기능 활성화

## 완료된 작업

### 인허가 자가진단 V-World API 연동 (2025-01-22)
- ✅ `app/api/permit-check/route.ts`에서 estimateZone 키워드 기반 추정 함수 제거
- ✅ `lib/landUseApi.ts`의 searchLandUse 함수로 실제 V-World API 조회 연동
- ✅ zoneSource 필드 추가로 데이터 출처 표시 ("V-World API" 또는 "추정")
- ✅ V-World 도메인 설정: aiadminplatform.vercel.app 등록 완료

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
