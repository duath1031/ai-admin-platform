/**
 * =============================================================================
 * 옥외광고물 표시 허가 신청서
 * =============================================================================
 * 옥외광고물 등의 관리와 옥외광고산업 진흥에 관한 법률 시행규칙 [별지 제1호서식]
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

interface OutdoorAdvertisingData {
  applicantName: string;        // 신청인 성명/상호
  representativeName?: string;  // 대표자 (법인인 경우)
  residentNumber?: string;      // 주민등록번호/법인등록번호
  applicantAddress: string;     // 신청인 주소
  phone: string;                // 전화번호
  adType: string;               // 광고물 종류 (간판, 현수막, 옥상광고 등)
  adLocation: string;           // 설치 장소
  adSize: string;               // 규격 (가로×세로)
  adContent: string;            // 광고 내용
  displayPeriod: string;        // 표시 기간
  quantity: string;             // 수량
}

const borderStyle = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

const headerCellStyle = { shading: { fill: "F5F5F5" } };

export async function createOutdoorAdvertising(data: OutdoorAdvertisingData): Promise<Buffer> {
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
          createRightAlignedText("[별지 제1호서식]", 16, "666666"),
          createCenteredTitle("옥외광고물 표시 허가 신청서", 32),
          createEmptyParagraph(100),
          createReceiptInfoTable(),
          createEmptyParagraph(200),
          createApplicantInfoTable(data),
          createEmptyParagraph(200),
          createAdInfoTable(data),
          createEmptyParagraph(200),
          createDeclarationText(),
          createEmptyParagraph(300),
          createDateAndSignature(),
          createRecipient(),
          createEmptyParagraph(300),
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
          createMergedDataCell("10일", 80, 3),
        ],
      }),
    ],
  });
}

function createApplicantInfoTable(data: OutdoorAdvertisingData): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("신 청 인", true)],
            width: { size: 15, type: WidthType.PERCENTAGE },
            rowSpan: 3,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("성명(상호)", 15),
          createDataCell(data.applicantName || "", 25),
          createHeaderCell("대표자", 15),
          createDataCell(data.representativeName || "", 30),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("주 소", 15),
          createMergedDataCell(data.applicantAddress || "", 70, 3),
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

function createAdInfoTable(data: OutdoorAdvertisingData): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("광 고 물", true)],
            width: { size: 15, type: WidthType.PERCENTAGE },
            rowSpan: 5,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("광고물 종류", 15),
          createMergedDataCell(data.adType || "", 70, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("설치 장소", 15),
          createMergedDataCell(data.adLocation || "", 70, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("규 격", 15),
          createDataCell(data.adSize || "", 25),
          createHeaderCell("수 량", 15),
          createDataCell(`${data.quantity || "1"} 개`, 30),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("광고 내용", 15),
          createMergedDataCell(data.adContent || "", 70, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("표시 기간", 15),
          createMergedDataCell(data.displayPeriod || "", 70, 3),
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
        text: "「옥외광고물 등의 관리와 옥외광고산업 진흥에 관한 법률」 제3조 및 같은 법 시행규칙 제4조에 따라 위와 같이 옥외광고물 표시 허가를 신청합니다.",
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
    children: [new TextRun({ text: `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`, size: 22 })],
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
              new Paragraph({ children: [new TextRun({ text: "구비서류", bold: true, size: 20 })], spacing: { after: 100 } }),
              new Paragraph({ children: [new TextRun({ text: "1. 광고물 등의 설계도서 (원색도안 포함)", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "2. 표시 장소의 주변 사진", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "3. 건물 임대차계약서 또는 건물주 동의서", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "※ 제출처: 광고물 설치 장소 관할 시·군·구청", size: 18, color: "666666" })], spacing: { before: 100 } }),
            ],
            borders: borderStyle,
            shading: { fill: "FFFDE7" },
          }),
        ],
      }),
    ],
  });
}

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
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return phone;
}
