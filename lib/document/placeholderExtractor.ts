/**
 * DOCX Placeholder 추출기
 * 업로드된 DOCX 파일에서 {{fieldName}} 패턴을 자동 추출하여
 * FormField 기본 구조를 생성
 */

import mammoth from "mammoth";

export interface ExtractedField {
  id: string;
  label: string;
  type: "text" | "date" | "number" | "select" | "textarea" | "phone" | "address";
  required: boolean;
  placeholder?: string;
}

// 필드명 → 타입 자동 추론 규칙
const TYPE_HINTS: Record<string, ExtractedField["type"]> = {
  date: "date",
  날짜: "date",
  일자: "date",
  phone: "phone",
  전화: "phone",
  연락처: "phone",
  tel: "phone",
  address: "address",
  주소: "address",
  소재지: "address",
  area: "number",
  면적: "number",
  count: "number",
  수량: "number",
  금액: "number",
  amount: "number",
  price: "number",
  description: "textarea",
  설명: "textarea",
  내용: "textarea",
  품목: "textarea",
  시설: "textarea",
};

/**
 * DOCX 파일에서 {{placeholder}} 패턴 추출
 */
export async function extractPlaceholders(docxBuffer: Buffer): Promise<{
  placeholders: string[];
  suggestedFields: ExtractedField[];
}> {
  // mammoth로 DOCX → 텍스트 변환
  const result = await mammoth.extractRawText({ buffer: docxBuffer });
  const text = result.value;

  // {{fieldName}} 패턴 추출 (중복 제거)
  const regex = /\{\{([^}]+)\}\}/g;
  const found = new Set<string>();
  let match;

  while ((match = regex.exec(text)) !== null) {
    const fieldName = match[1].trim();
    // docx-templates 명령어 제외 (IF, END-IF, FOR, END-FOR 등)
    if (!/^(IF|END-IF|FOR|END-FOR|INS|QUERY|CMD)/i.test(fieldName)) {
      found.add(fieldName);
    }
  }

  const placeholders = Array.from(found);

  // 필드명 → FormField 자동 생성
  const suggestedFields: ExtractedField[] = placeholders.map((name) => ({
    id: name,
    label: guessLabel(name),
    type: guessType(name),
    required: true,
    placeholder: guessPlaceholder(name),
  }));

  return { placeholders, suggestedFields };
}

/**
 * 필드명에서 표시 라벨 추론
 * camelCase → 띄어쓰기, 한글은 그대로
 */
function guessLabel(fieldName: string): string {
  // 한글이 포함되어 있으면 그대로 사용
  if (/[가-힣]/.test(fieldName)) {
    return fieldName;
  }
  // camelCase → 단어 분리
  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * 필드명에서 타입 추론
 */
function guessType(fieldName: string): ExtractedField["type"] {
  const lower = fieldName.toLowerCase();
  for (const [hint, type] of Object.entries(TYPE_HINTS)) {
    if (lower.includes(hint)) {
      return type;
    }
  }
  return "text";
}

/**
 * 필드명에서 placeholder 추론
 */
function guessPlaceholder(fieldName: string): string | undefined {
  const type = guessType(fieldName);
  switch (type) {
    case "date":
      return "YYYY-MM-DD";
    case "phone":
      return "010-0000-0000";
    case "address":
      return "시/도 구/군 동/읍/면";
    case "number":
      return "숫자 입력";
    default:
      return undefined;
  }
}
