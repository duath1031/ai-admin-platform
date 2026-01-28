/**
 * DOCX 엔진 테스트 스크립트
 * 실행: node scripts/test-docx-engine.js
 */

const createReport = require('docx-templates').default;
const fs = require('fs');
const path = require('path');

async function testDocxEngine() {
  console.log('📄 DOCX 엔진 테스트 시작...\n');

  // 템플릿 경로
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'docx', 'MAIL_ORDER_SALES.docx');

  if (!fs.existsSync(templatePath)) {
    console.error('❌ 템플릿 파일을 찾을 수 없습니다:', templatePath);
    return;
  }

  console.log('✅ 템플릿 파일 발견:', templatePath);

  // 테스트 데이터
  const testData = {
    businessName: '주식회사 어드미니',
    representativeName: '홍길동',
    birthDate: '1990-01-15',
    businessNumber: '123-45-67890',
    businessAddress: '서울특별시 강남구 테헤란로 123',
    phone: '02-1234-5678',
    email: 'admin@admini.co.kr',
    websiteUrl: 'www.admini.co.kr',
    hostingProvider: '(주)가비아 (서울시 서초구)',
    mainProducts: '행정 대행 서비스, AI 컨설팅',
    salesMethod: '인터넷',
  };

  // 날짜 자동 추가
  const now = new Date();
  testData.today = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
  testData.todayYear = now.getFullYear().toString();
  testData.todayMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  testData.todayDay = now.getDate().toString().padStart(2, '0');

  console.log('\n📋 테스트 데이터:');
  Object.entries(testData).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  try {
    // 템플릿 로드
    const template = fs.readFileSync(templatePath);

    // 문서 생성
    console.log('\n🔄 문서 생성 중...');
    const buffer = await createReport({
      template,
      data: testData,
      cmdDelimiter: ['{{', '}}'],
      processLineBreaks: true,
      failFast: false,
    });

    // 결과 저장
    const outputPath = path.join(process.cwd(), 'public', 'templates', 'docx', 'TEST_OUTPUT.docx');
    fs.writeFileSync(outputPath, buffer);

    console.log('\n✅ 문서 생성 완료!');
    console.log('📁 출력 파일:', outputPath);
    console.log('\n이 파일을 열어서 플레이스홀더가 올바르게 치환되었는지 확인하세요.');

  } catch (error) {
    console.error('\n❌ 문서 생성 실패:', error.message);
    console.error(error);
  }
}

testDocxEngine();
