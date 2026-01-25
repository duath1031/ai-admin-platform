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
} from "./tableHelpers";

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
          createMergedDataCell("10일", percentToDxa(80), 3),
        ],
      }),
    ],
  });
}

function createApplicantInfoTable(data: OutdoorAdvertisingData): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("신 청 인", true)],
            width: { size: percentToDxa(15), type: WidthType.DXA },
            rowSpan: 3,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("성명(상호)", percentToDxa(15)),
          createDataCell(data.applicantName || "", percentToDxa(25)),
          createHeaderCell("대표자", percentToDxa(15)),
          createDataCell(data.representativeName || "", percentToDxa(30)),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("주 소", percentToDxa(15)),
          createMergedDataCell(data.applicantAddress || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("전화번호", percentToDxa(15)),
          createMergedDataCell(formatPhone(data.phone || ""), percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
    ],
  });
}

function createAdInfoTable(data: OutdoorAdvertisingData): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("광 고 물", true)],
            width: { size: percentToDxa(15), type: WidthType.DXA },
            rowSpan: 5,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("광고물 종류", percentToDxa(15)),
          createMergedDataCell(data.adType || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("설치 장소", percentToDxa(15)),
          createMergedDataCell(data.adLocation || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("규 격", percentToDxa(15)),
          createDataCell(data.adSize || "", percentToDxa(25)),
          createHeaderCell("수 량", percentToDxa(15)),
          createDataCell(`${data.quantity || "1"} 개`, percentToDxa(30)),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("광고 내용", percentToDxa(15)),
          createMergedDataCell(data.adContent || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("표시 기간", percentToDxa(15)),
          createMergedDataCell(data.displayPeriod || "", percentToDxa(70), 3),
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
    ...getTableOptions(),
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
            width: { size: percentToDxa(100), type: WidthType.DXA },
            borders: borderStyle,
            shading: { fill: "FFFDE7" },
          }),
        ],
      }),
    ],
  });
}

