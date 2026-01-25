/**
 * =============================================================================
 * 서식 생성기 (Document Generator)
 * =============================================================================
 * AI가 수집한 정보를 바탕으로 완성된 서식 문서를 생성
 * - PDF 생성 (react-pdf)
 * - DOCX 생성 (docx)
 */

import { FormTemplate, FormField, FORM_TEMPLATES } from "./templates";
import { Gov24Service, GOV24_SERVICES } from "./gov24Links";

// 문서 생성 결과
export interface GeneratedDocument {
  success: boolean;
  fileName: string;
  fileType: "pdf" | "docx";
  fileData: Buffer | null;
  templateName: string;
  gov24Link?: string;
  requiredDocs?: string[];
  tips?: string[];
  error?: string;
}

// 사용자 입력 데이터
export interface FormData {
  [key: string]: string | number | undefined;
}

/**
 * 서식 데이터 검증
 */
export function validateFormData(
  template: FormTemplate,
  data: FormData
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  for (const field of template.fields) {
    if (field.required && !data[field.id]) {
      missingFields.push(field.label);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * 파일명 생성 (템플릿 치환)
 */
export function generateFileName(template: FormTemplate, data: FormData): string {
  let fileName = template.outputFileName;

  // {fieldId} 형태의 플레이스홀더 치환
  for (const [key, value] of Object.entries(data)) {
    fileName = fileName.replace(`{${key}}`, String(value || ""));
  }

  // 날짜 추가
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  fileName = fileName.replace("{date}", dateStr);

  return fileName;
}

/**
 * 필드값 포맷팅
 */
export function formatFieldValue(field: FormField, value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") {
    return field.defaultValue || "";
  }

  const strValue = String(value);

  switch (field.type) {
    case "date":
      // YYYY-MM-DD -> YYYY년 MM월 DD일
      if (strValue.includes("-")) {
        const [year, month, day] = strValue.split("-");
        return `${year}년 ${month}월 ${day}일`;
      }
      return strValue;

    case "phone":
      // 010-1234-5678 형태로 포맷
      const digits = strValue.replace(/\D/g, "");
      if (digits.length === 11) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
      }
      if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      return strValue;

    case "number":
      // 숫자에 천단위 콤마
      const num = Number(strValue);
      if (!isNaN(num)) {
        return num.toLocaleString("ko-KR");
      }
      return strValue;

    default:
      return strValue;
  }
}

/**
 * DOCX 문서 생성 (서버사이드용)
 */
export async function generateDocx(
  templateKey: string,
  data: FormData
): Promise<GeneratedDocument> {
  const template = FORM_TEMPLATES[templateKey];

  if (!template) {
    return {
      success: false,
      fileName: "",
      fileType: "docx",
      fileData: null,
      templateName: "",
      error: `템플릿을 찾을 수 없습니다: ${templateKey}`,
    };
  }

  // 필수 필드 검증
  const validation = validateFormData(template, data);
  if (!validation.valid) {
    return {
      success: false,
      fileName: "",
      fileType: "docx",
      fileData: null,
      templateName: template.name,
      error: `필수 항목이 누락되었습니다: ${validation.missingFields.join(", ")}`,
    };
  }

  try {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } = await import("docx");

    // 문서 헤더
    const headerParagraphs = [
      new Paragraph({
        children: [
          new TextRun({
            text: template.name,
            bold: true,
            size: 36, // 18pt
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `(${template.category})`,
            size: 24,
            color: "666666",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      }),
    ];

    // 필드별 테이블 행 생성
    const tableRows: InstanceType<typeof TableRow>[] = [];

    for (const field of template.fields) {
      const value = formatFieldValue(field, data[field.id]);
      const isRequired = field.required ? " *" : "";

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: field.label + isRequired,
                      bold: true,
                      size: 22,
                    }),
                  ],
                }),
              ],
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: { fill: "F5F5F5" },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: value,
                      size: 22,
                    }),
                  ],
                }),
              ],
              width: { size: 70, type: WidthType.PERCENTAGE },
            }),
          ],
        })
      );
    }

    const table = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });

    // 푸터 (날짜, 서명란)
    const today = new Date();
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    const footerParagraphs = [
      new Paragraph({
        children: [],
        spacing: { before: 600 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `작성일: ${dateStr}`,
            size: 22,
          }),
        ],
        alignment: AlignmentType.RIGHT,
      }),
      new Paragraph({
        children: [],
        spacing: { before: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `신청인: ${data.representativeName || data.applicantName || ""} (서명 또는 인)`,
            size: 22,
          }),
        ],
        alignment: AlignmentType.RIGHT,
      }),
      new Paragraph({
        children: [],
        spacing: { before: 800 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "※ 본 서류는 AI 행정 비서가 작성을 도와드린 문서입니다.",
            size: 18,
            color: "888888",
            italics: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "※ 정부24 등 관할 기관에 제출하기 전 내용을 반드시 확인해 주세요.",
            size: 18,
            color: "888888",
            italics: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ];

    const doc = new Document({
      sections: [
        {
          children: [...headerParagraphs, table, ...footerParagraphs],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const fileName = generateFileName(template, data).replace(".pdf", ".docx");

    // 정부24 링크 정보
    const gov24Service = template.gov24ServiceKey
      ? GOV24_SERVICES[template.gov24ServiceKey]
      : null;

    return {
      success: true,
      fileName,
      fileType: "docx",
      fileData: Buffer.from(buffer),
      templateName: template.name,
      gov24Link: gov24Service?.applyUrl,
      requiredDocs: gov24Service?.requiredDocs,
      tips: gov24Service?.tips,
    };
  } catch (error) {
    console.error("[Document Generator] DOCX Error:", error);
    return {
      success: false,
      fileName: "",
      fileType: "docx",
      fileData: null,
      templateName: template.name,
      error: error instanceof Error ? error.message : "DOCX 생성 중 오류 발생",
    };
  }
}

/**
 * 서식 필드 정보 조회 (AI가 사용자에게 질문할 때 사용)
 */
export function getTemplateFields(templateKey: string): FormField[] | null {
  const template = FORM_TEMPLATES[templateKey];
  return template ? template.fields : null;
}

/**
 * 누락된 필드 조회
 */
export function getMissingFields(templateKey: string, data: FormData): FormField[] {
  const template = FORM_TEMPLATES[templateKey];
  if (!template) return [];

  return template.fields.filter(
    (field) => field.required && !data[field.id]
  );
}

/**
 * 서식 생성 응답 메시지 생성 (AI 응답용)
 */
export function generateResponseMessage(result: GeneratedDocument): string {
  if (!result.success) {
    return `서류 생성에 실패했습니다: ${result.error}`;
  }

  let message = `**${result.templateName}** 서류가 생성되었습니다.\n\n`;
  message += `📄 파일명: ${result.fileName}\n`;

  if (result.gov24Link) {
    message += `\n🔗 **정부24 신청 페이지:**\n${result.gov24Link}\n`;
  }

  if (result.requiredDocs && result.requiredDocs.length > 0) {
    message += `\n📋 **필요 서류:**\n`;
    result.requiredDocs.forEach((doc) => {
      message += `- ${doc}\n`;
    });
  }

  if (result.tips && result.tips.length > 0) {
    message += `\n💡 **팁:**\n`;
    result.tips.forEach((tip) => {
      message += `- ${tip}\n`;
    });
  }

  message += `\n위 파일을 다운로드하여 정부24에 제출해 주세요.`;

  return message;
}

/**
 * 템플릿 키로 정부24 서비스 정보 조회
 */
export function getGov24ServiceInfo(templateKey: string): Gov24Service | null {
  const template = FORM_TEMPLATES[templateKey];
  if (!template?.gov24ServiceKey) return null;
  return GOV24_SERVICES[template.gov24ServiceKey] || null;
}
