/**
 * =============================================================================
 * 통신판매업 신고서 [별지 제1호서식]
 * =============================================================================
 * 전자상거래 등에서의 소비자보호에 관한 법률 시행규칙
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

interface MailOrderSalesData {
  // 신고인 정보
  companyName: string;          // 법인명(상호)
  corporateNumber?: string;     // 법인등록번호
  companyAddress: string;       // 소재지
  companyPhone: string;         // 전화번호
  representativeName: string;   // 대표자 성명
  residentNumber?: string;      // 주민등록번호 (앞 6자리)
  representativeAddress: string; // 대표자 주소
  email: string;                // 전자우편주소
  businessNumber: string;       // 사업자등록번호
  domainName: string;           // 인터넷 도메인 이름
  hostServer?: string;          // 호스트서버 소재지

  // 판매 방식 (체크박스)
  salesMethodTV?: boolean;      // TV홈쇼핑
  salesMethodInternet?: boolean; // 인터넷
  salesMethodCatalog?: boolean; // 카탈로그
  salesMethodNewspaper?: boolean; // 신문·잡지
  salesMethodOther?: boolean;   // 기타
  salesMethodOtherText?: string;

  // 취급 품목 (체크박스)
  productGeneral?: boolean;     // 종합몰
  productEducation?: boolean;   // 교육/도서/완구/오락
  productElectronics?: boolean; // 가전
  productComputer?: boolean;    // 컴퓨터/사무용품
  productFurniture?: boolean;   // 가구/수납용품
  productHealth?: boolean;      // 건강/식품
  productFashion?: boolean;     // 의류/패션/잡화/뷰티
  productLeisure?: boolean;     // 레저/여행/공연
  productAdult?: boolean;       // 성인/성인용품
  productAuto?: boolean;        // 자동차/자동차용품
  productGiftCard?: boolean;    // 상품권
  productOther?: boolean;       // 기타
  productOtherText?: string;
}

// 체크박스 문자 (체크됨/안됨)
const CHECKBOX_CHECKED = "☑";
const CHECKBOX_UNCHECKED = "☐";

// 공통 테이블 셀 스타일
const headerCellStyle = {
  shading: { fill: "F5F5F5" },
};

const borderStyle = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

export async function createMailOrderSalesReport(data: MailOrderSalesData): Promise<Buffer> {
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
          createRightAlignedText("[별지 제1호서식]", 16, "666666"),
          createCenteredTitle("통신판매업 신고서", 32),
          createEmptyParagraph(100),

          // 접수 정보 테이블
          createReceiptInfoTable(),
          createEmptyParagraph(200),

          // 신고인 정보 테이블
          createApplicantInfoTable(data),
          createEmptyParagraph(200),

          // 판매 방식 테이블
          createSalesMethodTable(data),
          createEmptyParagraph(200),

          // 취급 품목 테이블
          createProductCategoryTable(data),
          createEmptyParagraph(200),

          // 신고 문구
          createDeclarationText(),
          createEmptyParagraph(300),

          // 날짜 및 서명
          createDateAndSignature(data.representativeName),
          createEmptyParagraph(300),

          // 수신처
          createRecipient(),
          createEmptyParagraph(300),

          // 안내사항
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
    children: [
      new TextRun({
        text,
        size,
        color,
      }),
    ],
    alignment: AlignmentType.RIGHT,
  });
}

function createCenteredTitle(text: string, size: number): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  });
}

function createEmptyParagraph(spacing: number): Paragraph {
  return new Paragraph({
    children: [],
    spacing: { before: spacing },
  });
}

function createReceiptInfoTable(): Table {
  return new Table({
    width: { size: 9500, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          createHeaderCell("접수번호", 1900),
          createDataCell("", 2850),
          createHeaderCell("접수일", 1900),
          createDataCell("", 2850),
        ],
      }),
      new TableRow({
        children: [
          createHeaderCell("처리기간", 1900),
          createMergedDataCell("3일", 7600, 3),
        ],
      }),
    ],
  });
}

function createApplicantInfoTable(data: MailOrderSalesData): Table {
  // 총 너비 9500 DXA 기준: 15%=1425, 25%=2375, 30%=2850
  return new Table({
    width: { size: 9500, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    rows: [
      // 신고인 헤더
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("신 고 인", true)],
            width: { size: 1425, type: WidthType.DXA },
            rowSpan: 6,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          createHeaderCell("법인명(상호)", 1425),
          createDataCell(data.companyName || "", 2375),
          createHeaderCell("법인등록번호", 1425),
          createDataCell(data.corporateNumber || "", 2850),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("소재지", 1425),
          createMergedDataCell(data.companyAddress || "", 6650, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("전화번호", 1425),
          createMergedDataCell(data.companyPhone || "", 6650, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("대표자 성명", 1425),
          createDataCell(data.representativeName || "", 2375),
          createHeaderCell("주민등록번호", 1425),
          createDataCell(data.residentNumber ? `${data.residentNumber}-*******` : "", 2850),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("주소", 1425),
          createMergedDataCell(data.representativeAddress || "", 6650, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("전자우편주소", 1425),
          createDataCell(data.email || "", 2375),
          createHeaderCell("사업자등록번호", 1425),
          createDataCell(formatBusinessNumber(data.businessNumber || ""), 2850),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      // 인터넷 도메인 정보
      new TableRow({
        children: [
          createHeaderCell("인터넷 도메인 이름", 2850, 2),
          createMergedDataCell(data.domainName || "", 6650, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          createHeaderCell("호스트서버 소재지", 2850, 2),
          createMergedDataCell(data.hostServer || "국내", 6650, 3),
        ],
        height: { value: 400, rule: HeightRule.ATLEAST },
      }),
    ],
  });
}

function createSalesMethodTable(data: MailOrderSalesData): Table {
  const checkbox = (checked?: boolean) => checked ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED;

  return new Table({
    width: { size: 9500, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          createHeaderCell("판 매 방 식", 1900),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${checkbox(data.salesMethodTV)} TV홈쇼핑   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.salesMethodInternet)} 인터넷   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.salesMethodCatalog)} 카탈로그   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.salesMethodNewspaper)} 신문·잡지   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.salesMethodOther)} 기타(${data.salesMethodOtherText || "    "})`, size: 20 }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
            width: { size: 7600, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderStyle,
          }),
        ],
        height: { value: 500, rule: HeightRule.ATLEAST },
      }),
    ],
  });
}

function createProductCategoryTable(data: MailOrderSalesData): Table {
  const checkbox = (checked?: boolean) => checked ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED;

  return new Table({
    width: { size: 9500, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [createCellParagraph("취 급 품 목", true)],
            width: { size: 1900, type: WidthType.DXA },
            rowSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            ...headerCellStyle,
            borders: borderStyle,
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${checkbox(data.productGeneral)} 종합몰   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.productEducation)} 교육/도서/완구/오락   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.productElectronics)} 가전   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.productComputer)} 컴퓨터/사무용품`, size: 20 }),
                ],
                alignment: AlignmentType.LEFT,
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `${checkbox(data.productFurniture)} 가구/수납용품   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.productHealth)} 건강/식품   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.productFashion)} 의류/패션/잡화/뷰티   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.productLeisure)} 레저/여행/공연`, size: 20 }),
                ],
                alignment: AlignmentType.LEFT,
                spacing: { before: 100 },
              }),
            ],
            width: { size: 7600, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderStyle,
          }),
        ],
        height: { value: 500, rule: HeightRule.ATLEAST },
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${checkbox(data.productAdult)} 성인/성인용품   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.productAuto)} 자동차/자동차용품   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.productGiftCard)} 상품권   `, size: 20 }),
                  new TextRun({ text: `${checkbox(data.productOther)} 기타(${data.productOtherText || "    "})`, size: 20 }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
            width: { size: 7600, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderStyle,
          }),
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
        text: "「전자상거래 등에서의 소비자보호에 관한 법률」 제12조제1항 및 같은 법 시행규칙 제8조제1항에 따라 위와 같이 통신판매업을 신고합니다.",
        size: 22,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  });
}

function createDateAndSignature(name: string): Paragraph {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  return new Paragraph({
    children: [
      new TextRun({
        text: `${year}년 ${month}월 ${day}일`,
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
      new TextRun({
        text: "신고인: ",
        size: 22,
      }),
      new TextRun({
        text: "                              ",
        size: 22,
      }),
      new TextRun({
        text: "(서명 또는 인)",
        size: 18,
        color: "666666",
      }),
    ],
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200, after: 400 },
  });
}

function createNotice(): Table {
  return new Table({
    width: { size: 9500, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "유의사항",
                    bold: true,
                    size: 20,
                  }),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "1. 허위의 사실을 신고하거나 신고를 하지 않고 통신판매업을 영위하는 경우에는 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 처벌받을 수 있습니다.",
                    size: 18,
                  }),
                ],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "2. 신고 후 사업자 정보가 변경된 경우에는 변경신고를 하여야 합니다.",
                    size: 18,
                  }),
                ],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "3. 통신판매업 신고증은 사업장의 보기 쉬운 곳에 게시하여야 합니다.",
                    size: 18,
                  }),
                ],
              }),
            ],
            width: { size: 9500, type: WidthType.DXA },
            borders: borderStyle,
            shading: { fill: "FFFDE7" },
          }),
        ],
      }),
    ],
  });
}

// 헬퍼 함수들 - DXA 단위 사용 (1 inch = 1440 DXA, A4 너비 약 9500 DXA)
function createHeaderCell(text: string, width: number, colSpan?: number): TableCell {
  return new TableCell({
    children: [createCellParagraph(text, true)],
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: colSpan,
    ...headerCellStyle,
    borders: borderStyle,
  });
}

function createDataCell(text: string, width: number): TableCell {
  return new TableCell({
    children: [createCellParagraph(text, false)],
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    borders: borderStyle,
  });
}

function createMergedDataCell(text: string, width: number, colSpan: number): TableCell {
  return new TableCell({
    children: [createCellParagraph(text, false)],
    width: { size: width, type: WidthType.DXA },
    columnSpan: colSpan,
    verticalAlign: VerticalAlign.CENTER,
    borders: borderStyle,
  });
}

function createCellParagraph(text: string, bold: boolean): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold,
        size: 20,
      }),
    ],
    alignment: AlignmentType.CENTER,
  });
}

function formatBusinessNumber(num: string): string {
  const digits = num.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  return num;
}
