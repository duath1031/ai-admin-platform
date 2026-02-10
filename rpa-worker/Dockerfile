# =============================================================================
# RPA Worker Server - Playwright 기반 정부24 자동화
# =============================================================================
# Base: Microsoft Playwright 공식 이미지 (브라우저 내장)
FROM mcr.microsoft.com/playwright:v1.50.0-noble

# 작업 디렉토리 설정
WORKDIR /app

# 한글 폰트 + Tesseract OCR 설치
RUN apt-get update && apt-get install -y \
    fonts-nanum \
    fonts-nanum-coding \
    fonts-nanum-extra \
    fontconfig \
    tesseract-ocr \
    tesseract-ocr-kor \
    && fc-cache -fv \
    && rm -rf /var/lib/apt/lists/*

# 환경변수 설정
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CACHE_BUST=20260211_v23_LOGIN_DEBUG
ENV PHASE25_5_REAL_SUBMIT=true

# package.json 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --omit=dev

# 소스 코드 복사
COPY . .

# 스크린샷 저장 디렉토리 생성
RUN mkdir -p /app/screenshots

# 포트 노출
EXPOSE 3001

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# 서버 실행 (메모리 제한 증가: 8GB - 대용량 PDF 500MB+ 처리용)
CMD ["node", "--max-old-space-size=8192", "server.js"]
