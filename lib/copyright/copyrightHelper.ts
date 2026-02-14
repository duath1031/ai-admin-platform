/**
 * SW 저작권 등록을 위한 헬퍼 함수들
 * - 비밀정보 마스킹
 * - 30페이지 추출 (한국저작권위원회 요구)
 * - 창작의도 기술서 프롬프트 생성
 * - 등록 절차 가이드
 */

// ─── 비밀정보 마스킹 패턴 ───

const MASKING_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]+['"]/gi, label: "API 키" },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi, label: "비밀번호" },
  { pattern: /(?:secret|token|auth)\s*[:=]\s*['"][^'"]+['"]/gi, label: "시크릿/토큰" },
  { pattern: /(?:aws_access_key|aws_secret)\s*[:=]\s*['"][^'"]+['"]/gi, label: "AWS 키" },
  { pattern: /(?:database_url|db_url|connection_string)\s*[:=]\s*['"][^'"]+['"]/gi, label: "DB URL" },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, label: "IP 주소" },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: "이메일" },
  {
    pattern: /-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |DSA |EC )?PRIVATE KEY-----/g,
    label: "개인키",
  },
];

export interface MaskingResult {
  maskedCode: string;
  maskedCount: number;
  maskedItems: { label: string; count: number }[];
}

/**
 * 소스코드에서 비밀정보를 마스킹
 */
export function maskSecrets(sourceCode: string): MaskingResult {
  let maskedCode = sourceCode;
  const itemCounts: Record<string, number> = {};
  let totalCount = 0;

  for (const { pattern, label } of MASKING_PATTERNS) {
    // 새 RegExp로 매번 리셋 (글로벌 플래그 lastIndex 문제 방지)
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = maskedCode.match(regex);
    if (matches && matches.length > 0) {
      itemCounts[label] = (itemCounts[label] || 0) + matches.length;
      totalCount += matches.length;
      maskedCode = maskedCode.replace(regex, `[*** ${label} 마스킹됨 ***]`);
    }
  }

  const maskedItems = Object.entries(itemCounts).map(([label, count]) => ({
    label,
    count,
  }));

  return {
    maskedCode,
    maskedCount: totalCount,
    maskedItems,
  };
}

// ─── 30페이지 추출 ───

export interface ExtractionResult {
  extractedCode: string;
  totalLines: number;
  extractedLines: number;
  sections: { label: string; startLine: number; endLine: number }[];
  pageCount: number;
}

/**
 * 한국저작권위원회 요구: 처음 10페이지 + 중간 10페이지 + 끝 10페이지 추출
 * 1페이지 = 약 50줄 기준
 */
export function extractPages(sourceCode: string, linesPerPage = 50): ExtractionResult {
  const lines = sourceCode.split("\n");
  const totalLines = lines.length;
  const linesPerSection = 10 * linesPerPage; // 10페이지 = 500줄

  // 전체가 30페이지 이하이면 그대로 반환
  if (totalLines <= linesPerSection * 3) {
    return {
      extractedCode: sourceCode,
      totalLines,
      extractedLines: totalLines,
      sections: [
        { label: "전체", startLine: 1, endLine: totalLines },
      ],
      pageCount: Math.ceil(totalLines / linesPerPage),
    };
  }

  // 처음 10페이지
  const startSection = lines.slice(0, linesPerSection);

  // 중간 10페이지
  const middleStart = Math.floor((totalLines - linesPerSection) / 2);
  const middleSection = lines.slice(middleStart, middleStart + linesPerSection);

  // 끝 10페이지
  const endSection = lines.slice(totalLines - linesPerSection);

  const separator = "\n\n/* ════════════════════════════════════════════════ */\n";

  const extractedCode = [
    `/* ═══ 처음 10페이지 (1줄 ~ ${linesPerSection}줄) ═══ */`,
    startSection.join("\n"),
    separator,
    `/* ═══ 중간 10페이지 (${middleStart + 1}줄 ~ ${middleStart + linesPerSection}줄) ═══ */`,
    middleSection.join("\n"),
    separator,
    `/* ═══ 끝 10페이지 (${totalLines - linesPerSection + 1}줄 ~ ${totalLines}줄) ═══ */`,
    endSection.join("\n"),
  ].join("\n");

  const sections = [
    { label: "처음 10페이지", startLine: 1, endLine: linesPerSection },
    { label: "중간 10페이지", startLine: middleStart + 1, endLine: middleStart + linesPerSection },
    { label: "끝 10페이지", startLine: totalLines - linesPerSection + 1, endLine: totalLines },
  ];

  return {
    extractedCode,
    totalLines,
    extractedLines: linesPerSection * 3,
    sections,
    pageCount: 30,
  };
}

// ─── 프로그램 정보 인터페이스 ───

export interface ProgramInfo {
  programName: string;
  programNameEn?: string;
  version: string;
  creationDate: string;
  publicDate?: string;
  programmingLanguages: string[];
  operatingSystem: string;
  programSize?: string;
  category: string;
  description: string;
  features: string[];
  techStack?: string[];
  authorName: string;
  authorType: "individual" | "corporation";
  companyName?: string;
  bizRegNo?: string;
}

// ─── 창작의도 기술서 프롬프트 생성 ───

/**
 * ProgramInfo 기반으로 Gemini에게 보낼 창작의도 기술서 프롬프트 생성
 */
export function buildCreationDescriptionPrompt(info: ProgramInfo): string {
  const languageList = info.programmingLanguages.join(", ");
  const featureList = info.features.map((f, i) => `${i + 1}. ${f}`).join("\n");
  const techStackList = info.techStack?.join(", ") || "미입력";

  return `당신은 한국저작권위원회(CROS)에 제출할 SW 프로그램 명세서(창작의도 기술서)를 작성하는 전문가입니다.
아래 프로그램 정보를 바탕으로 1500~2000자 분량의 창작의도 기술서를 작성해주세요.

[작성 구성]
1. 프로그램 개요 (200~300자)
2. 창작 목적 및 의도 (300~400자)
3. 프로그램의 특징 (200~300자)
4. 주요 기능 설명 (300~400자)
5. 기술적 특성 (200~300자)
6. 활용 분야 및 기대 효과 (200~300자)

[프로그램 정보]
- 프로그램명: ${info.programName}
- 영문명: ${info.programNameEn || "미입력"}
- 버전: ${info.version}
- 창작일: ${info.creationDate}
- 공표일: ${info.publicDate || "미공표"}
- 분류: ${info.category}
- 프로그래밍 언어: ${languageList}
- 동작 OS: ${info.operatingSystem}
- 프로그램 규모: ${info.programSize || "미입력"}
- 기술 스택: ${techStackList}
- 저작자: ${info.authorName} (${info.authorType === "individual" ? "개인" : `법인 - ${info.companyName || ""}`})

[프로그램 설명]
${info.description}

[주요 기능 목록]
${featureList}

[작성 지침]
- 전문적이고 격식 있는 문체로 작성
- 기술적 내용을 비전문가도 이해할 수 있도록 서술
- 프로그램의 독창성과 창작성을 강조
- 각 섹션 제목을 포함하여 구조적으로 작성
- 한글 1500~2000자 분량
- 마크다운이나 특수 포맷 없이 일반 텍스트로 작성`;
}

// ─── 등록 절차 가이드 ───

export interface RegistrationStep {
  step: number;
  title: string;
  description: string;
  documents?: string[];
  link?: string;
  fee?: string;
}

export function getRegistrationGuide(): RegistrationStep[] {
  return [
    {
      step: 1,
      title: "한국저작권위원회 회원가입",
      description: "cros.or.kr에서 회원가입 후 로그인합니다. 공인인증서 또는 간편인증으로 본인확인이 필요합니다.",
      link: "https://www.cros.or.kr",
    },
    {
      step: 2,
      title: "프로그램 등록 신청서 작성",
      description: "프로그램명, 창작일, 공표일, 저작자 정보를 입력합니다. 법인의 경우 사업자등록번호가 필요합니다.",
      documents: ["프로그램 등록 신청서"],
    },
    {
      step: 3,
      title: "프로그램 명세서 첨부",
      description: "창작의도 기술서(프로그램 설명서)를 업로드합니다. AI가 자동 생성한 내용을 검토 후 제출하세요.",
      documents: ["프로그램 명세서 (창작의도 기술서)"],
    },
    {
      step: 4,
      title: "소스코드 복제물 제출",
      description: "마스킹 처리된 소스코드 30페이지를 PDF로 변환하여 업로드합니다. 비밀 유지가 필요한 부분은 마스킹 처리됩니다.",
      documents: ["소스코드 복제물 (30페이지, 비밀정보 마스킹)"],
    },
    {
      step: 5,
      title: "수수료 납부",
      description: "온라인 결제 또는 계좌이체로 등록 수수료를 납부합니다.",
      fee: "개인: 25,000원 / 법인: 50,000원 (부가세 별도)",
    },
    {
      step: 6,
      title: "등록증 발급",
      description: "심사 후 1~2주 내 등록증이 발급됩니다. 온라인에서 등록증을 확인하고 출력할 수 있습니다.",
      documents: ["SW 저작권 등록증"],
    },
  ];
}

// ─── SW 저작권 분류 ───

export const SW_CATEGORIES = [
  "응용 소프트웨어",
  "시스템 소프트웨어",
  "임베디드 소프트웨어",
  "게임 소프트웨어",
  "모바일 앱",
  "웹 애플리케이션",
  "데이터베이스",
  "인공지능/머신러닝",
  "보안 소프트웨어",
  "교육용 소프트웨어",
  "의료용 소프트웨어",
  "기타",
];

export const PROGRAMMING_LANGUAGES = [
  "Java",
  "Python",
  "JavaScript",
  "TypeScript",
  "C",
  "C++",
  "C#",
  "Go",
  "Rust",
  "Swift",
  "Kotlin",
  "PHP",
  "Ruby",
  "Dart",
  "R",
  "MATLAB",
  "SQL",
  "HTML/CSS",
  "Shell/Bash",
  "기타",
];

export const OPERATING_SYSTEMS = [
  "Windows",
  "macOS",
  "Linux",
  "iOS",
  "Android",
  "Web (크로스플랫폼)",
  "임베디드/IoT",
  "서버/클라우드",
  "기타",
];
