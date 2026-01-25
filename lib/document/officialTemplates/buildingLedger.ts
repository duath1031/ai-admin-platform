/**
 * =============================================================================
 * 건축물대장 등·초본 발급 신청서
 * =============================================================================
 * 건축법 시행규칙 [별지 제4호서식]
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

interface BuildingLedgerData {
  applicantName: string;        // 신청인 성명
  applicantPhone: string;       // 연락처
  applicantAddress?: string;    // 신청인 주소
  buildingAddress: string;      // 건축물 소재지
  documentType: string;         // 발급 종류
  purpose: string;              // 사용 목적
  copies: string;               // 발급 부수
}

const CHECKBOX_CHECKED = "☑";
const CHECKBOX_UNCHECKED = "☐";

export async function createBuildingLedger(data: BuildingLedgerData): Promise<Buffer> {
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
          createRightAlignedText("[별지 제4호서식]", 16, "666666"),
          createCenteredTitle("건축물대장 등·초본 발급 신청서", 32),
          createEmptyParagraph(100),
          createReceiptInfoTable(),
          createEmptyParagraph(200),
          createApplicantInfoTable(data),
          createEmptyParagraph(200),
          createBuildingInfoTable(data),
          createEmptyParagraph(200),
          createDocumentTypeTable(data),
          createEmptyParagraph(200),
          createDeclarationText(),
          createEmptyParagraph(300),
          createDateAndSignature(),
          createEmptyParagraph(200),
          createRecipient(),
          createEmptyParagraph(300),
          createNotice(),
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
          createMergedDataCell("즉시", percentToDxa(80), 3),
        ],
      }),
    ],
  });
}

function createApplicantInfoTable(data: BuildingLedgerData): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("신 청 인", true)],
            width: { size: percentToDxa(15), type: WidthType.DXA },
            rowSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("성 명", percentToDxa(15)),
          createDataCell(data.applicantName || "", percentToDxa(25)),
          createHeaderCell("연락처", percentToDxa(15)),
          createDataCell(formatPhone(data.applicantPhone || ""), percentToDxa(30)),
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
    ],
  });
}

function createBuildingInfoTable(data: BuildingLedgerData): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          createHeaderCell("건축물 소재지", percentToDxa(30), 1),
          createMergedDataCell(data.buildingAddress || "", percentToDxa(70), 1),
        ],
        height: { value: 500, rule: HeightRule.ATLEAST },
      }),
    ],
  });
}

function createDocumentTypeTable(data: BuildingLedgerData): Table {
  const docType = data.documentType || "";
  const isTitle = docType.includes("표제부");
  const isAll = docType.includes("전체") && !docType.includes("집합");
  const isGeneral = docType.includes("일반건축물");
  const isCollectiveUnit = docType.includes("집합") && docType.includes("전유부");
  const isCollectiveAll = docType.includes("집합") && docType.includes("전체");

  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          createHeaderCell("발급 종류", percentToDxa(20)),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${isTitle ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 표제부   `, size: 20 }),
                  new TextRun({ text: `${isAll ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 전체   `, size: 20 }),
                  new TextRun({ text: `${isGeneral ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 일반건축물   `, size: 20 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `${isCollectiveUnit ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 집합건축물(전유부)   `, size: 20 }),
                  new TextRun({ text: `${isCollectiveAll ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 집합건축물(전체)`, size: 20 }),
                ],
                spacing: { before: 100 },
              }),
            ],
            width: { size: percentToDxa(80), type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderStyle,
          }),
        ],
        height: { value: 600, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("사용 목적", percentToDxa(20)),
          createDataCell(data.purpose || "", percentToDxa(80)),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("발급 부수", percentToDxa(20)),
          createDataCell(`${data.copies || "1"} 부`, percentToDxa(80)),
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
        text: "「건축법」 제38조 및 같은 법 시행규칙 제25조에 따라 위와 같이 건축물대장 등·초본의 발급을 신청합니다.",
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
    spacing: { before: 200, after: 400 },
  });
}

function createNotice(): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "수수료 안내", bold: true, size: 20 })],
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "- 등본: 500원", size: 18 })],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "- 초본: 350원", size: 18 })],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "※ 정부24에서 온라인 발급 시 무료", size: 18, color: "0066CC" })],
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

