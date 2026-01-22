// 하이코리아(출입국관리) 서식 고정 링크 설정
// 하이코리아 API/링크는 자주 변경되므로 검증된 고정 URL을 수동 관리

// =============================================================================
// 타입 정의
// =============================================================================

export interface HikoreaFormLink {
  name: string;           // 서식명
  nameEn?: string;        // 영문명
  url: string;            // 다운로드 URL (검증됨)
  fallbackUrl: string;    // 대체 URL
  description: string;    // 설명
  keywords: string[];     // 검색 키워드
  visaTypes?: string[];   // 관련 비자 유형
  lastVerified: string;   // 마지막 검증일
  fileFormat: 'hwp' | 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx';
}

// =============================================================================
// 주요 출입국 서식 링크 (수동 관리)
// =============================================================================

export const HIKOREA_LINKS: Record<string, HikoreaFormLink> = {
  // 통합신청서 (가장 많이 사용)
  unified_application: {
    name: '통합신청서',
    nameEn: 'Unified Application Form',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=65&dcSeq=1',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: '체류자격 변경, 연장, 외국인등록 등 통합 신청서',
    keywords: ['통합신청서', '체류자격', '변경', '연장', '외국인등록'],
    visaTypes: ['모든 비자'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 사증발급인정서 신청서
  visa_issuance_confirmation: {
    name: '사증발급인정신청서',
    nameEn: 'Application for Confirmation of Visa Issuance',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=65&dcSeq=2',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: '해외에서 비자 발급을 위한 인정서 신청',
    keywords: ['사증발급인정', '비자인정서', '초청장', 'VIC'],
    visaTypes: ['D-8', 'E-7', 'F-2', 'F-4', 'F-5', 'F-6'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 고용추천서 (E-7)
  employment_recommendation: {
    name: '특정활동(E-7) 고용추천서',
    nameEn: 'Employment Recommendation for E-7',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=67&dcSeq=1',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: 'E-7 특정활동 비자 신청을 위한 고용추천서',
    keywords: ['고용추천서', 'E-7', 'E7', '특정활동', '전문인력'],
    visaTypes: ['E-7'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 재외동포 신청서 (F-4)
  overseas_korean_f4: {
    name: '재외동포(F-4) 체류자격 신청서',
    nameEn: 'Application for F-4 Status',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=66&dcSeq=1',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: '재외동포 F-4 비자 신청/변경/연장',
    keywords: ['재외동포', 'F-4', 'F4', '동포비자', '교포'],
    visaTypes: ['F-4'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 영주권 신청서 (F-5)
  permanent_residence_f5: {
    name: '영주(F-5) 체류자격 신청서',
    nameEn: 'Application for Permanent Residence F-5',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=66&dcSeq=2',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: '영주권 F-5 비자 신청',
    keywords: ['영주권', 'F-5', 'F5', '영주비자', 'permanent'],
    visaTypes: ['F-5'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 결혼이민자 (F-6)
  marriage_immigrant_f6: {
    name: '결혼이민(F-6) 체류자격 신청서',
    nameEn: 'Application for F-6 Marriage Immigrant',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=66&dcSeq=3',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: '결혼이민자 F-6 비자 신청',
    keywords: ['결혼이민', 'F-6', 'F6', '배우자비자', '국제결혼'],
    visaTypes: ['F-6'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 거소신고서
  residence_report: {
    name: '거소신고서',
    nameEn: 'Residence Report Form',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=65&dcSeq=3',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: '재외국민 및 외국국적동포 거소신고',
    keywords: ['거소신고', '거소이전', '국내거소'],
    visaTypes: ['F-4'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 체류지 변경신고서
  address_change: {
    name: '체류지(거소) 변경신고서',
    nameEn: 'Address Change Report',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=65&dcSeq=4',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: '외국인 체류지 변경 신고',
    keywords: ['체류지변경', '주소변경', '거소변경', '이사'],
    visaTypes: ['모든 비자'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 근무처 변경/추가 허가 신청서
  workplace_change: {
    name: '근무처 변경/추가 허가 신청서',
    nameEn: 'Workplace Change Application',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=65&dcSeq=5',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: '취업비자 소지자 근무처 변경/추가',
    keywords: ['근무처변경', '직장변경', '이직', '추가근무'],
    visaTypes: ['E-1', 'E-2', 'E-3', 'E-4', 'E-5', 'E-6', 'E-7', 'E-9', 'H-2'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 재입국허가 신청서
  reentry_permit: {
    name: '재입국허가 신청서',
    nameEn: 'Re-entry Permit Application',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=65&dcSeq=6',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: '재입국허가 신청 (단수/복수)',
    keywords: ['재입국허가', '재입국', '출국'],
    visaTypes: ['모든 비자'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 체류자격외 활동허가 신청서
  extra_activity_permit: {
    name: '체류자격외 활동허가 신청서',
    nameEn: 'Extra Activity Permit Application',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadFile.pt?bbsSeq=1&bcIdx=65&dcSeq=7',
    fallbackUrl: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    description: '체류자격 외 활동(아르바이트 등) 허가',
    keywords: ['체류자격외', '아르바이트', '시간제취업', '부업'],
    visaTypes: ['D-2', 'D-4', 'F-1'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },

  // 기본 서식 목록 페이지
  default: {
    name: '하이코리아 서식 목록',
    nameEn: 'Hi Korea Form List',
    url: 'https://www.hikorea.go.kr/board/BoardDownloadList.pt',
    fallbackUrl: 'https://www.hikorea.go.kr',
    description: '하이코리아 공식 서식 다운로드 페이지',
    keywords: ['하이코리아', '출입국', '서식', '양식'],
    lastVerified: '2025-01-22',
    fileFormat: 'hwp',
  },
};

// =============================================================================
// 비자 유형별 필수 서식 매핑
// =============================================================================

export const VISA_REQUIRED_FORMS: Record<string, string[]> = {
  'E-7': ['unified_application', 'employment_recommendation'],
  'E-9': ['unified_application', 'workplace_change'],
  'F-4': ['unified_application', 'overseas_korean_f4', 'residence_report'],
  'F-5': ['unified_application', 'permanent_residence_f5'],
  'F-6': ['unified_application', 'marriage_immigrant_f6'],
  'D-2': ['unified_application', 'extra_activity_permit'],
  'H-2': ['unified_application', 'workplace_change'],
};

// =============================================================================
// 헬퍼 함수
// =============================================================================

/**
 * 키워드로 하이코리아 서식 검색
 */
export function getHikoreaLink(keyword: string): HikoreaFormLink | null {
  const lowerKeyword = keyword.toLowerCase();

  for (const form of Object.values(HIKOREA_LINKS)) {
    // 키워드 매칭
    if (form.keywords.some(k => lowerKeyword.includes(k.toLowerCase()))) {
      return form;
    }
    // 이름 매칭
    if (form.name.toLowerCase().includes(lowerKeyword)) {
      return form;
    }
    // 영문명 매칭
    if (form.nameEn && form.nameEn.toLowerCase().includes(lowerKeyword)) {
      return form;
    }
  }

  return null;
}

/**
 * 비자 유형으로 필요 서식 조회
 */
export function getFormsForVisa(visaType: string): HikoreaFormLink[] {
  const normalizedVisa = visaType.toUpperCase().replace(/\s/g, '');
  const formKeys = VISA_REQUIRED_FORMS[normalizedVisa] || ['unified_application'];

  return formKeys
    .map(key => HIKOREA_LINKS[key])
    .filter((form): form is HikoreaFormLink => form !== undefined);
}

/**
 * 모든 서식 목록 반환
 */
export function getAllHikoreaForms(): HikoreaFormLink[] {
  return Object.values(HIKOREA_LINKS);
}

/**
 * 서식 정보를 마크다운 형식으로 포맷팅
 */
export function formatHikoreaFormInfo(form: HikoreaFormLink): string {
  return `
📋 **${form.name}**
${form.nameEn ? `(${form.nameEn})` : ''}

${form.description}

🔗 **다운로드 링크**
- [서식 다운로드](${form.url})
- [서식 목록 페이지](${form.fallbackUrl})

${form.visaTypes ? `📌 **관련 비자**: ${form.visaTypes.join(', ')}` : ''}

⚠️ 링크가 작동하지 않을 경우 [하이코리아 서식 페이지](https://www.hikorea.go.kr/board/BoardDownloadList.pt)에서 직접 검색하세요.
`;
}

/**
 * 비자 유형별 필요 서식 안내 생성
 */
export function generateVisaFormGuide(visaType: string): string {
  const forms = getFormsForVisa(visaType);

  if (forms.length === 0) {
    return `${visaType} 비자 관련 서식 정보가 없습니다. [하이코리아](https://www.hikorea.go.kr)에서 확인하세요.`;
  }

  let guide = `📑 **${visaType} 비자 관련 서식**\n\n`;

  for (const form of forms) {
    guide += `- **${form.name}**\n`;
    guide += `  [다운로드](${form.url})\n\n`;
  }

  guide += `\n🔗 [하이코리아 서식 전체 목록](https://www.hikorea.go.kr/board/BoardDownloadList.pt)`;

  return guide;
}
