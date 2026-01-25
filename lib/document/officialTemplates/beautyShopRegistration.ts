/**
 * =============================================================================
 * 미용업 신고서
 * =============================================================================
 * 공중위생관리법 시행규칙 [별지 제1호서식]
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
  formatDate,
} from "./tableHelpers";

interface BeautyShopData {
  businessName: string;         // 업소명
  representativeName: string;   // 대표자 성명
  residentNumber: string;       // 주민등록번호
  businessAddress: string;      // 영업소 소재지
  phone: string;                // 전화번호
  beautyType: string;           // 미용 종류 (일반미용/피부미용/네일미용/화장미용/종합미용)
  floorArea: string;            // 영업장 면적
  workerCount: string;          // 종사자 수
  hygieneEducationDate: string; // 위생교육 이수일
  licenseNumber: string;        // 미용사 면허번호
}
const CHECKBOX_CHECKED = "☑";
const CHECKBOX_UNCHECKED = "☐";

export async function createBeautyShopRegistration(data: BeautyShopData): Promise<Buffer> {
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
          createCenteredTitle("미용업 신고서", 32),
          createEmptyParagraph(100),
          createReceiptInfoTable(),
          createEmptyParagraph(200),
          createApplicantInfoTable(data),
          createEmptyParagraph(200),
          createBusinessInfoTable(data),
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
          createMergedDataCell("3일", percentToDxa(80), 3),
        ],
      }),
    ],
  });
}

function createApplicantInfoTable(data: BeautyShopData): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("신 고 인", true)],
            width: { size: percentToDxa(15), type: WidthType.DXA },
            rowSpan: 4,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("업 소 명", percentToDxa(15)),
          createMergedDataCell(data.businessName || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("성 명", percentToDxa(15)),
          createDataCell(data.representativeName || "", percentToDxa(25)),
          createHeaderCell("주민등록번호", percentToDxa(15)),
          createDataCell(data.residentNumber ? `${data.residentNumber}-*******` : "", percentToDxa(30)),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("영업소 소재지", percentToDxa(15)),
          createMergedDataCell(data.businessAddress || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("전화번호", percentToDxa(15)),
          createDataCell(formatPhone(data.phone || ""), percentToDxa(25)),
          createHeaderCell("미용사 면허번호", percentToDxa(15)),
          createDataCell(data.licenseNumber || "", percentToDxa(30)),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
    ],
  });
}

function createBusinessInfoTable(data: BeautyShopData): Table {
  const type = data.beautyType || "";
  const isGeneral = type.includes("일반");
  const isSkin = type.includes("피부");
  const isNail = type.includes("네일");
  const isMakeup = type.includes("화장");
  const isAll = type.includes("종합");

  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("영 업 장", true)],
            width: { size: percentToDxa(15), type: WidthType.DXA },
            rowSpan: 3,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("미용 종류", percentToDxa(15)),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${isGeneral ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 일반미용   `, size: 20 }),
                  new TextRun({ text: `${isSkin ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 피부미용   `, size: 20 }),
                  new TextRun({ text: `${isNail ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 네일미용   `, size: 20 }),
                  new TextRun({ text: `${isMakeup ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 화장미용   `, size: 20 }),
                  new TextRun({ text: `${isAll ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 종합미용`, size: 20 }),
                ],
              }),
            ],
            width: { size: percentToDxa(70), type: WidthType.DXA },
            columnSpan: 3,
            verticalAlign: VerticalAlign.CENTER,
            borders: borderStyle,
          }),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("영업장 면적", percentToDxa(15)),
          createDataCell(`${data.floorArea || ""} ㎡`, percentToDxa(25)),
          createHeaderCell("종사자 수", percentToDxa(15)),
          createDataCell(`${data.workerCount || ""} 명`, percentToDxa(30)),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("위생교육 이수", percentToDxa(15)),
          createMergedDataCell(formatDate(data.hygieneEducationDate), percentToDxa(70), 3),
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
        text: "「공중위생관리법」 제3조제1항 및 같은 법 시행규칙 제3조에 따라 위와 같이 미용업을 신고합니다.",
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
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: "구비서류", bold: true, size: 20 })], spacing: { after: 100 } }),
              new Paragraph({ children: [new TextRun({ text: "1. 미용사 면허증 사본", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "2. 위생교육 이수 증명서류", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "3. 건물 임대차계약서 사본", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "※ 제출처: 사업장 소재지 관할 시·군·구청", size: 18, color: "666666" })], spacing: { before: 100 } }),
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

