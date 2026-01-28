/**
 * 샘플 DOCX 템플릿 생성 스크립트
 * 통신판매업 신고서 템플릿 예시
 *
 * 실행: node scripts/create-sample-template.js
 */

const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, Packer } = require('docx');
const fs = require('fs');
const path = require('path');

async function createMailOrderSalesTemplate() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // 제목
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: '통신판매업 신고서',
                bold: true,
                size: 36,
              }),
            ],
          }),

          // 접수번호/신고일
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: '접수번호: ________________', size: 20 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 },
            children: [
              new TextRun({ text: '신고일: {{today}}', size: 20 }),
            ],
          }),

          // 신고인 정보 테이블
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // 헤더
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    columnSpan: 4,
                    shading: { fill: 'E0E0E0' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: '신 고 인', bold: true, size: 24 })],
                      }),
                    ],
                  }),
                ],
              }),

              // 상호
              new TableRow({
                children: [
                  createLabelCell('상호(법인명)'),
                  createValueCell('{{businessName}}', 3),
                ],
              }),

              // 대표자
              new TableRow({
                children: [
                  createLabelCell('대표자 성명'),
                  createValueCell('{{representativeName}}'),
                  createLabelCell('생년월일'),
                  createValueCell('{{birthDate}}'),
                ],
              }),

              // 사업자등록번호
              new TableRow({
                children: [
                  createLabelCell('사업자등록번호'),
                  createValueCell('{{businessNumber}}', 3),
                ],
              }),

              // 사업장 소재지
              new TableRow({
                children: [
                  createLabelCell('사업장 소재지'),
                  createValueCell('{{businessAddress}}', 3),
                ],
              }),

              // 연락처
              new TableRow({
                children: [
                  createLabelCell('전화번호'),
                  createValueCell('{{phone}}'),
                  createLabelCell('이메일'),
                  createValueCell('{{email}}'),
                ],
              }),
            ],
          }),

          // 간격
          new Paragraph({ spacing: { before: 400, after: 200 } }),

          // 통신판매업 정보 테이블
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // 헤더
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    columnSpan: 4,
                    shading: { fill: 'E0E0E0' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: '통신판매업 정보', bold: true, size: 24 })],
                      }),
                    ],
                  }),
                ],
              }),

              // 인터넷 도메인
              new TableRow({
                children: [
                  createLabelCell('인터넷 도메인'),
                  createValueCell('{{websiteUrl}}', 3),
                ],
              }),

              // 호스팅 서버
              new TableRow({
                children: [
                  createLabelCell('호스팅 서버'),
                  createValueCell('{{hostingProvider}}', 3),
                ],
              }),

              // 주요 취급 품목
              new TableRow({
                children: [
                  createLabelCell('주요 취급 품목'),
                  createValueCell('{{mainProducts}}', 3),
                ],
              }),

              // 판매 방식
              new TableRow({
                children: [
                  createLabelCell('판매 방식'),
                  createValueCell('{{salesMethod}}', 3),
                ],
              }),
            ],
          }),

          // 간격
          new Paragraph({ spacing: { before: 600, after: 200 } }),

          // 서약문
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: '「전자상거래 등에서의 소비자보호에 관한 법률」 제12조 및 같은 법 시행규칙 제8조에 따라 위와 같이 통신판매업을 신고합니다.',
                size: 22,
              }),
            ],
          }),

          // 날짜
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
            children: [
              new TextRun({
                text: '{{todayYear}}년 {{todayMonth}}월 {{todayDay}}일',
                size: 24,
              }),
            ],
          }),

          // 신고인
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
            children: [
              new TextRun({ text: '신고인: {{representativeName}}', size: 24 }),
              new TextRun({ text: '  (인)', size: 24 }),
            ],
          }),

          // 간격
          new Paragraph({ spacing: { before: 400, after: 200 } }),

          // 관할 관청
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: '○○시장/군수/구청장 귀하',
                size: 24,
                bold: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  // 파일 저장
  const outputDir = path.join(process.cwd(), 'public', 'templates', 'docx');

  // 디렉토리 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(outputDir, 'MAIL_ORDER_SALES.docx');
  fs.writeFileSync(outputPath, buffer);

  console.log('✅ 샘플 템플릿 생성 완료:', outputPath);
  console.log('');
  console.log('사용된 플레이스홀더:');
  console.log('  {{businessName}} - 상호(법인명)');
  console.log('  {{representativeName}} - 대표자 성명');
  console.log('  {{birthDate}} - 생년월일');
  console.log('  {{businessNumber}} - 사업자등록번호');
  console.log('  {{businessAddress}} - 사업장 소재지');
  console.log('  {{phone}} - 전화번호');
  console.log('  {{email}} - 이메일');
  console.log('  {{websiteUrl}} - 인터넷 도메인');
  console.log('  {{hostingProvider}} - 호스팅 서버');
  console.log('  {{mainProducts}} - 주요 취급 품목');
  console.log('  {{salesMethod}} - 판매 방식');
  console.log('  {{today}} - 오늘 날짜');
  console.log('  {{todayYear}}, {{todayMonth}}, {{todayDay}} - 연/월/일');
}

// 헬퍼 함수: 라벨 셀 생성
function createLabelCell(text) {
  return new TableCell({
    width: { size: 20, type: WidthType.PERCENTAGE },
    shading: { fill: 'F5F5F5' },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, size: 20 })],
      }),
    ],
  });
}

// 헬퍼 함수: 값 셀 생성
function createValueCell(text, columnSpan = 1) {
  const cell = new TableCell({
    columnSpan,
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 20 })],
      }),
    ],
  });

  if (columnSpan > 1) {
    cell.properties = { ...cell.properties, columnSpan };
  }

  return cell;
}

// 실행
createMailOrderSalesTemplate().catch(console.error);
