/**
 * =============================================================================
 * 숙박업 영업허가 신청서
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
  BorderStyle,
  VerticalAlign,
  HeightRule,
  convertInchesToTwip,
  TableLayoutType,
} from "docx";

interface AccommodationBusinessData {
  businessName: string;         // 업소명
  representativeName: string;   // 대표자 성명
  residentNumber: string;       // 주민등록번호
  businessAddress: string;      // 영업소 소재지
  phone: string;                // 전화번호
  businessType: string;         // 영업 종류 (호텔업/휴양콘도미니엄업/일반숙박업/생활숙박업)
  floorArea: string;            // 영업장 면적
  roomCount: string;            // 객실 수
  facilities: string;           // 주요 시설
  hygieneEducationDate: string; // 위생교육 이수일
}

const borderStyle = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

const headerCellStyle = { shading: { fill: "F5F5F5" } };

const CHECKBOX_CHECKED = "☑";
const CHECKBOX_UNCHECKED = "☐";

export async function createAccommodationBusiness(data: AccommodationBusinessData): Promise<Buffer> {
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
          createCenteredTitle("숙박업 영업허가 신청서", 32),
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

function createApplicantInfoTable(data: AccommodationBusinessData): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("신 청 인", true)],
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

function createBusinessInfoTable(data: AccommodationBusinessData): Table {
  const isHotel = data.businessType?.includes("호텔");
  const isCondo = data.businessType?.includes("콘도");
  const isGeneral = data.businessType?.includes("일반");
  const isLife = data.businessType?.includes("생활");

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("영 업 장", true)],
            width: { size: 15, type: WidthType.PERCENTAGE },
            rowSpan: 4,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("영업 종류", 15),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${isHotel ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 호텔업   `, size: 20 }),
                  new TextRun({ text: `${isCondo ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 휴양콘도미니엄업   `, size: 20 }),
                  new TextRun({ text: `${isGeneral ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 일반숙박업   `, size: 20 }),
                  new TextRun({ text: `${isLife ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED} 생활숙박업`, size: 20 }),
                ],
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
          createDataCell(`${data.floorArea || ""} ㎡`, 25),
          createHeaderCell("객실 수", 15),
          createDataCell(`${data.roomCount || ""} 실`, 30),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("주요 시설", 15),
          createMergedDataCell(data.facilities || "", 70, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("위생교육 이수", 15),
          createMergedDataCell(formatDate(data.hygieneEducationDate), 70, 3),
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
        text: "「공중위생관리법」 제3조제1항 및 같은 법 시행규칙 제3조에 따라 위와 같이 숙박업 영업허가를 신청합니다.",
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
              new Paragraph({ children: [new TextRun({ text: "1. 영업시설 및 설비개요서", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "2. 위생교육 이수 증명서류", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "3. 건물 임대차계약서 사본", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "4. 소방시설완비증명서", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "※ 제출처: 사업장 소재지 관할 시·군·구청", size: 18, color: "666666" })], spacing: { before: 100 } }),
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("-")) {
    const [year, month, day] = dateStr.split("-");
    return `${year}년 ${month}월 ${day}일`;
  }
  return dateStr;
}
