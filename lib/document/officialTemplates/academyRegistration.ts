/**
 * =============================================================================
 * 학원 설립·운영 등록 신청서
 * =============================================================================
 * 학원의 설립·운영 및 과외교습에 관한 법률 시행규칙 [별지 제1호서식]
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

interface AcademyRegistrationData {
  academyName: string;          // 학원명
  representativeName: string;   // 설립·운영자 성명
  residentNumber: string;       // 주민등록번호
  representativeAddress: string; // 설립·운영자 주소
  academyAddress: string;       // 학원 소재지
  phone: string;                // 전화번호
  academyType: string;          // 학원 종류 (입시, 보습, 외국어, 예능, 직업기술 등)
  subjects: string;             // 교습 과목
  floorArea: string;            // 시설 면적
  capacity: string;             // 정원
  teacherCount: string;         // 강사 수
}

export async function createAcademyRegistration(data: AcademyRegistrationData): Promise<Buffer> {
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
          createCenteredTitle("학원 설립·운영 등록 신청서", 32),
          createEmptyParagraph(100),
          createReceiptInfoTable(),
          createEmptyParagraph(200),
          createApplicantInfoTable(data),
          createEmptyParagraph(200),
          createAcademyInfoTable(data),
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

function createApplicantInfoTable(data: AcademyRegistrationData): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("설립·운영자", true)],
            width: { size: percentToDxa(15), type: WidthType.DXA },
            rowSpan: 3,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("성 명", percentToDxa(15)),
          createDataCell(data.representativeName || "", percentToDxa(25)),
          createHeaderCell("주민등록번호", percentToDxa(15)),
          createDataCell(data.residentNumber ? `${data.residentNumber}-*******` : "", percentToDxa(30)),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("주 소", percentToDxa(15)),
          createMergedDataCell(data.representativeAddress || "", percentToDxa(70), 3),
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

function createAcademyInfoTable(data: AcademyRegistrationData): Table {
  return new Table({
    ...getTableOptions(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("학 원", true)],
            width: { size: percentToDxa(15), type: WidthType.DXA },
            rowSpan: 6,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("학 원 명", percentToDxa(15)),
          createMergedDataCell(data.academyName || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("소 재 지", percentToDxa(15)),
          createMergedDataCell(data.academyAddress || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("학원 종류", percentToDxa(15)),
          createMergedDataCell(data.academyType || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("교습 과목", percentToDxa(15)),
          createMergedDataCell(data.subjects || "", percentToDxa(70), 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("시설 면적", percentToDxa(15)),
          createDataCell(`${data.floorArea || ""} ㎡`, percentToDxa(25)),
          createHeaderCell("정 원", percentToDxa(15)),
          createDataCell(`${data.capacity || ""} 명`, percentToDxa(30)),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("강사 수", percentToDxa(15)),
          createMergedDataCell(`${data.teacherCount || ""} 명`, percentToDxa(70), 3),
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
        text: "「학원의 설립·운영 및 과외교습에 관한 법률」 제6조 및 같은 법 시행규칙 제5조에 따라 위와 같이 학원의 설립·운영 등록을 신청합니다.",
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
              new Paragraph({ children: [new TextRun({ text: "1. 시설 및 설비의 현황서", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "2. 강사 명부 및 자격증 사본", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "3. 건물 임대차계약서 사본", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "4. 건축물대장 및 소방시설완비증명서", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "5. 교습비용 등 표시 계획서", size: 18 })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: "※ 제출처: 사업장 소재지 관할 교육청", size: 18, color: "666666" })], spacing: { before: 100 } }),
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

