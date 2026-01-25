/**
 * =============================================================================
 * 사업자등록 신청서 [별지 제2호서식]
 * =============================================================================
 * 부가가치세법 시행규칙
 * 국가법령정보센터 공식 양식 기반
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalAlign,
  HeightRule,
  convertInchesToTwip,
} from "docx";

import {
  borderStyle,
  headerCellStyle,
  getTableOptions,
  percentToDxa,
  createCellParagraph,
  createHeaderCell,
  createDataCell,
  createMergedDataCell,
  formatPhone,
  formatResidentNumber,
  formatDate,
} from "./tableHelpers";

interface BusinessRegistrationData {
  businessName: string;       // 상호
  representativeName: string; // 대표자 성명
  residentNumber: string;     // 주민등록번호
  businessAddress: string;    // 사업장 소재지
  homeAddress: string;        // 자택 주소
  phone: string;              // 전화번호
  email: string;              // 이메일
  businessType: string;       // 업태
  businessItem: string;       // 종목
  startDate: string;          // 개업일
}

export async function createBusinessRegistration(data: BusinessRegistrationData): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.7),
              bottom: convertInchesToTwip(0.7),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
            },
          },
        },
        children: [
          // 문서 번호
          createRightAlignedText("[별지 제2호서식]", 16, "666666"),
          createCenteredTitle("사업자등록 신청서", 32),
          createSubTitle("(개인사업자용)"),
          createEmptyParagraph(100),

          // 접수 정보 테이블
          createReceiptInfoTable(),
          createEmptyParagraph(200),

          // 인적사항 테이블
          createPersonalInfoTable(data),
          createEmptyParagraph(200),

          // 사업장 정보 테이블
          createBusinessInfoTable(data),
          createEmptyParagraph(200),

          // 사업 내용 테이블
          createBusinessContentTable(data),
          createEmptyParagraph(200),

          // 신고 문구
          createDeclarationText(),
          createEmptyParagraph(300),

          // 날짜 및 서명
          createDateAndSignature(),
          createEmptyParagraph(200),

          // 수신처
          createRecipient(),
          createEmptyParagraph(300),

          // 구비서류 안내
          createRequiredDocuments(),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

function createRightAlignedText(text: string, size: number, color: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size, color })],
    alignment: AlignmentType.RIGHT,
  });
}

function createCenteredTitle(text: string, size: number): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 },
  });
}

function createSubTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: "666666" })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  });
}

function createEmptyParagraph(spacing: number): Paragraph {
  return new Paragraph({ children: [], spacing: { before: spacing } });
}

function createReceiptInfoTable(): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          createHeaderCell("접수번호", percentToDxa(20)),
          createDataCell("", percentToDxa(30)),
          createHeaderCell("접수일", percentToDxa(20)),
          createDataCell("", percentToDxa(30)),
        ],
      }),
      new TableRow({
        children: [
          createHeaderCell("처리기간", percentToDxa(20)),
          createMergedDataCell("3일", percentToDxa(80), 3),
        ],
      }),
    ],
  });
}

function createPersonalInfoTable(data: BusinessRegistrationData): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("인 적 사 항", true)],
            width: { size: percentToDxa(15), type: WidthType.DXA },
            rowSpan: 4,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("성 명", percentToDxa(15)),
          createDataCell(data.representativeName || "", percentToDxa(25)),
          createHeaderCell("주민등록번호", percentToDxa(15)),
          createDataCell(formatResidentNumber(data.residentNumber || ""), percentToDxa(30)),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("자택 주소", percentToDxa(15)),
          createMergedDataCell(data.homeAddress || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("전화번호", percentToDxa(15)),
          createDataCell(formatPhone(data.phone || ""), percentToDxa(25)),
          createHeaderCell("이메일", percentToDxa(15)),
          createDataCell(data.email || "", percentToDxa(30)),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("상 호", percentToDxa(15)),
          createMergedDataCell(data.businessName || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
    ],
  });
}

function createBusinessInfoTable(data: BusinessRegistrationData): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("사 업 장", true)],
            width: { size: percentToDxa(15), type: WidthType.DXA },
            rowSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("소 재 지", percentToDxa(15)),
          createMergedDataCell(data.businessAddress || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("개업일", percentToDxa(15)),
          createMergedDataCell(formatDate(data.startDate || ""), percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
    ],
  });
}

function createBusinessContentTable(data: BusinessRegistrationData): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("사 업 내 용", true)],
            width: { size: percentToDxa(15), type: WidthType.DXA },
            rowSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("업 태", percentToDxa(15)),
          createMergedDataCell(data.businessType || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("종 목", percentToDxa(15)),
          createMergedDataCell(data.businessItem || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
    ],
  });
}

function createDeclarationText(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: "「부가가치세법」 제8조 및 같은 법 시행령 제11조에 따라 위와 같이 사업자등록을 신청합니다.",
        size: 22,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  });
}

function createDateAndSignature(): Paragraph {
  const today = new Date();
  return new Paragraph({
    children: [
      new TextRun({
        text: `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`,
        size: 22,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  });
}

function createRecipient(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: "신청인: ", size: 22 }),
      new TextRun({ text: "                              ", size: 22 }),
      new TextRun({ text: "(서명 또는 인)", size: 18, color: "666666" }),
    ],
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200, after: 200 },
  });
}

function createRequiredDocuments(): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "구비서류", bold: true, size: 20 })],
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "1. 임대차계약서 사본 (사업장을 임차한 경우)", size: 18 })],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "2. 신분증 사본", size: 18 })],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "3. 자금출처 확인서류 (일정 규모 이상인 경우)", size: 18 })],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "※ 제출처: 사업장 관할 세무서", size: 18, color: "666666" })],
                spacing: { before: 100 },
              }),
            ],
            width: { size: percentToDxa(100), type: WidthType.DXA },
            borders: borderStyle,
            shading: { fill: "FFFDE7" },
          }),
        ],
      }),
    ],
  });
}

