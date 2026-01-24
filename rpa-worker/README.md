# RPA Worker Server

정부24 자동화를 위한 Playwright 기반 RPA Worker 서버입니다.

## 아키텍처

```
┌─────────────────────┐       ┌─────────────────────┐
│   Main Server       │       │   Worker Server     │
│   (Vercel/Next.js)  │◄─────►│   (Railway/Express) │
│                     │       │                     │
│ - UI                │       │ - Playwright RPA    │
│ - DB (Supabase)     │       │ - 정부24 인증       │
│ - AI Chat (Gemini)  │       │ - 민원 제출         │
└─────────────────────┘       └─────────────────────┘
```

## 주요 기능

1. **정부24 간편인증**
   - 카카오/PASS/삼성패스/네이버 인증 지원
   - iframe 처리 및 팝업 핸들링
   - 세션 쿠키 추출

2. **민원 자동 제출**
   - 폼 데이터 자동 입력
   - 첨부파일 업로드 지원
   - 접수번호 추출

## Railway 배포

### 1. Railway 프로젝트 생성

```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 프로젝트 생성
railway init
```

### 2. 환경변수 설정

Railway 대시보드에서 다음 환경변수를 설정:

- `PORT`: 3001 (Railway에서 자동 할당)
- `WORKER_API_KEY`: Main 서버와 통신용 API 키
- `ALLOWED_ORIGINS`: https://aiadminplatform.vercel.app

### 3. 배포

```bash
# Docker 배포 (Dockerfile 사용)
railway up
```

## 로컬 개발

### 1. 의존성 설치

```bash
cd rpa-worker
npm install
npx playwright install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
# .env 파일 수정
```

### 3. 서버 실행

```bash
npm run dev
```

## API 엔드포인트

### 헬스체크

```http
GET /health
```

### 작업 실행

```http
POST /execute-task
Content-Type: application/json
X-API-Key: your-api-key

{
  "taskType": "gov24_auth_request",
  "taskData": {
    "name": "홍길동",
    "birthDate": "900101",
    "phoneNumber": "01012345678",
    "carrier": "SKT",
    "authMethod": "pass"
  }
}
```

### 인증 요청

```http
POST /gov24/auth/request
```

### 인증 확인

```http
POST /gov24/auth/confirm
```

### 민원 제출

```http
POST /gov24/submit
```

## 보안 주의사항

- API 키는 환경변수로만 관리
- 개인정보(주민번호 등)는 해시 처리
- 스크린샷은 주기적으로 삭제
- HTTPS 필수 사용

## 트러블슈팅

### 한글 깨짐

Docker 이미지에 나눔폰트가 포함되어 있습니다. 깨지는 경우:

```bash
fc-cache -fv
```

### 브라우저 충돌

```bash
# 모든 크롬 프로세스 종료
pkill -f chromium
```

### 메모리 부족

Railway에서 메모리 제한 증가:
- Starter Plan: 512MB
- 권장: 1GB 이상
