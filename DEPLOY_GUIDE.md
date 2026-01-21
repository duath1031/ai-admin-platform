# AI 행정사 플랫폼 배포 가이드

## 🚀 Vercel 배포 (무료, 권장)

컴퓨터가 꺼져도 24시간 작동하려면 Vercel에 배포하세요.

### 1단계: Vercel 계정 생성
1. https://vercel.com 접속
2. GitHub 계정으로 가입

### 2단계: GitHub에 코드 업로드
```bash
cd E:\염현수행정사\주식회사어드미니\ai-admin-platform
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/ai-admin-platform.git
git push -u origin main
```

### 3단계: Vercel에서 배포
1. Vercel 대시보드에서 "New Project" 클릭
2. GitHub 저장소 선택
3. 환경 변수 설정 (아래 참고)
4. Deploy 클릭

### 4단계: 환경 변수 설정 (Vercel)
Vercel 프로젝트 설정 → Environment Variables에 추가:

```
# 필수
DATABASE_URL=your-production-database-url
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Google AI
GOOGLE_AI_API_KEY=AIzaSyDVZjt-tCNDL-xHdrC_E4uxT1rDuPxykHw

# V-World API
VWORLD_KEY=B595A377-A8DE-3691-82FD-14C738EAF36B

# 알림 설정 (중요!)
ADMIN_EMAIL=Lawyeom@naver.com
ADMIN_PHONE=01012345678
ADMIN_EMAILS=Lawyeom@naver.com
```

---

## 📧 알림 서비스 설정

### 이메일 알림 (Resend - 무료 3,000건/월)
1. https://resend.com 가입
2. API Key 생성
3. 환경 변수에 추가:
```
RESEND_API_KEY=re_xxxxxxxxxxxx
```

### SMS/카카오 알림톡 (알리고)
1. https://smartsms.aligo.in 가입
2. API 설정에서 키 발급
3. 환경 변수에 추가:
```
ALIGO_API_KEY=your-api-key
ALIGO_USER_ID=your-user-id
ALIGO_SENDER=07086571888
ALIGO_SENDER_KEY=kakao-sender-key  # 카카오 알림톡용
```

---

## 🗄️ 데이터베이스 설정

### 옵션 1: Vercel Postgres (권장)
1. Vercel 대시보드 → Storage → Create Database
2. Postgres 선택
3. 자동으로 DATABASE_URL 환경 변수 설정됨

### 옵션 2: Supabase (무료)
1. https://supabase.com 가입
2. 새 프로젝트 생성
3. Database URL 복사
4. prisma/schema.prisma 수정:
```prisma
datasource db {
  provider = "postgresql"  // sqlite에서 변경
  url      = env("DATABASE_URL")
}
```

---

## 🔧 배포 후 설정

1. Prisma 마이그레이션 실행:
```bash
npx prisma db push
```

2. Google OAuth 콜백 URL 업데이트:
- Google Cloud Console → OAuth 2.0 Client
- Authorized redirect URIs에 추가:
  `https://your-domain.vercel.app/api/auth/callback/google`

3. 도메인 연결 (선택):
- Vercel 프로젝트 설정 → Domains
- 커스텀 도메인 추가 (예: app.jungeui.com)

---

## 📱 테스트

배포 완료 후:
1. https://your-domain.vercel.app 접속
2. 로그인 테스트
3. 민원 접수 페이지에서 테스트 신청
4. 이메일/SMS 수신 확인

---

## 💡 문의
행정사합동사무소 정의
- 전화: 070-8657-1888
- 이메일: Lawyeom@naver.com
- 카카오: https://pf.kakao.com/_jWfwb
