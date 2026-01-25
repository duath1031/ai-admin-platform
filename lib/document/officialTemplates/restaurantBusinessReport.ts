/**
 * =============================================================================
 * 일반음식점 영업신고서 [별지 제37호서식]
 * =============================================================================
 * 식품위생법 시행규칙
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
  BorderStyle,
  VerticalAlign,
  HeightRule,
  convertInchesToTwip,
  TableLayoutType,
} from "docx";

interface RestaurantBusinessData {
  businessName: string;         // 업소명
  representativeName: string;   // 대표자 성명
  residentNumber: string;       // 주민등록번호 (앞 6자리)
  businessAddress: string;      // 영업소 소재지
  phone: string;                // 전화번호
  businessType: string;         // 영업의 종류 (일반음식점/휴게음식점/제과점)
  floorArea: string;            // 영업장 면적(㎡)
  menuItems: string;            // 주요 취급 음식
  hygieneEducationDate: string; // 위생교육 이수일
  hygieneEducationOrg: string;  // 위생교육 기관
}

const borderStyle = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

const headerCellStyle = {
  shading: { fill: "F5F5F5" },
};

export async function createRestaurantBusinessReport(data: RestaurantBusinessData): Promise<Buffer> {
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
          createRightAlignedText("[별지 제37호서식]", 16, "666666"),
          createCenteredTitle("영업신고서(일반음식점·휴게음식점·제과점)", 28),
          createEmptyParagraph(100),

          // 접수 정보 테이블
          createReceiptInfoTable(),
          createEmptyParagraph(200),

          // 신고인 정보 테이블
          createApplicantInfoTable(data),
          createEmptyParagraph(200),

          // 영업장 정보 테이블
          createBusinessInfoTable(data),
          createEmptyParagraph(200),

          // 위생교육 정보
          createHygieneInfoTable(data),
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
    spacing: { before: 200, after: 200 },
  });
}

function createEmptyParagraph(spacing: number): Paragraph {
  return new Paragraph({ children: [], spacing: { before: spacing } });
}

function createReceiptInfoTable(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          createHeaderCell("접수번호", 20),
          createDataCell("", 30),
          createHeaderCell("접수일", 20),
          createDataCell("", 30),
        ],
      }),
      new TableRow({
        children: [
          createHeaderCell("처리기간", 20),
          createMergedDataCell("3일", 80, 3),
        ],
      }),
    ],
  });
}

function createApplicantInfoTable(data: RestaurantBusinessData): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("신 고 인", true)],
            width: { size: 15, type: WidthType.PERCENTAGE },
            rowSpan: 4,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("업 소 명", 15),
          createMergedDataCell(data.businessName || "", 70, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("성 명", 15),
          createDataCell(data.representativeName || "", 25),
          createHeaderCell("주민등록번호", 15),
          createDataCell(data.residentNumber ? `${data.residentNumber}-*******` : "", 30),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("영업소 소재지", 15),
          createMergedDataCell(data.businessAddress || "", 70, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("전화번호", 15),
          createMergedDataCell(formatPhone(data.phone || ""), 70, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
    ],
  });
}

function createBusinessInfoTable(data: RestaurantBusinessData): Table {
  // 영업 종류 체크박스
  const isGeneral = data.businessType === "일반음식점";
  const isRest = data.businessType === "휴게음식점";
  const isBakery = data.businessType === "제과점";
  const CHECKED = "☑";
  const UNCHECKED = "☐";

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("영 업 장", true)],
            width: { size: 15, type: WidthType.PERCENTAGE },
            rowSpan: 3,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("영업의 종류", 15),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${isGeneral ? CHECKED : UNCHECKED} 일반음식점   `, size: 20 }),
                  new TextRun({ text: `${isRest ? CHECKED : UNCHECKED} 휴게음식점   `, size: 20 }),
                  new TextRun({ text: `${isBakery ? CHECKED : UNCHECKED} 제과점`, size: 20 }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
            width: { size: 70, type: WidthType.PERCENTAGE },
            columnSpan: 3,
            verticalAlign: VerticalAlign.CENTER,
            borders: borderStyle,
          }),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("영업장 면적", 15),
          createMergedDataCell(`${data.floorArea || ""} ㎡`, 70, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("주요 취급 음식", 15),
          createMergedDataCell(data.menuItems || "", 70, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
    ],
  });
}

function createHygieneInfoTable(data: RestaurantBusinessData): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          createHeaderCell("위생교육 이수", 30, 1),
          createDataCell(`${formatDate(data.hygieneEducationDate)} (${data.hygieneEducationOrg || "한국식품산업협회"})`, 70),
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
        text: "「식품위생법」 제37조제4항 및 같은 법 시행규칙 제42조에 따라 위와 같이 영업을 신고합니다.",
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
      new TextRun({ text: "신고인: ", size: 22 }),
      new TextRun({ text: "                              ", size: 22 }),
      new TextRun({ text: "(서명 또는 인)", size: 18, color: "666666" }),
    ],
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200, after: 400 },
  });
}

function createRequiredDocuments(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
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
                children: [new TextRun({ text: "1. 영업시설의 구조를 기록한 서류(영업시설배치도)", size: 18 })],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "2. 위생교육 이수 증명서류", size: 18 })],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "3. 건물 임대차계약서 사본(해당자에 한함)", size: 18 })],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "※ 담당공무원 확인사항: 건물등기부등본 또는 건축물대장", size: 18, color: "666666" })],
              }),
            ],
            borders: borderStyle,
            shading: { fill: "FFFDE7" },
          }),
        ],
      }),
    ],
  });
}

// 헬퍼 함수들
function createHeaderCell(text: string, width: number, colSpan?: number): TableCell {
  return new TableCell({
    children: [createCellParagraph(text, true)],
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: colSpan,
    ...headerCellStyle,
    borders: borderStyle,
  });
}

function createDataCell(text: string, width: number): TableCell {
  return new TableCell({
    children: [createCellParagraph(text, false)],
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: borderStyle,
  });
}

function createMergedDataCell(text: string, width: number, colSpan: number): TableCell {
  return new TableCell({
    children: [createCellParagraph(text, false)],
    width: { size: width, type: WidthType.PERCENTAGE },
    columnSpan: colSpan,
    verticalAlign: VerticalAlign.CENTER,
    borders: borderStyle,
  });
}

function createCellParagraph(text: string, bold: boolean): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, size: 20 })],
    alignment: AlignmentType.CENTER,
  });
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("-")) {
    const [year, month, day] = dateStr.split("-");
    return `${year}년 ${month}월 ${day}일`;
  }
  return dateStr;
}
