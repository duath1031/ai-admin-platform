/**
 * 기능별 토큰 비용 맵
 * 각 기능 호출 시 차감되는 토큰 수
 */
export const TOKEN_COSTS: Record<string, number> = {
  // AI 상담
  ai_chat: 1000,

  // 서류 작성
  document_create: 3000,

  // 서류 검토
  document_review: 2000,

  // RPA 민원 접수 (정부24)
  rpa_submission: 5000,

  // 문서24 공문 발송
  doc24_submission: 5000,

  // 인허가 자가진단
  permit_check: 2000,

  // 비자 계산기
  visa_calculator: 1000,

  // 입찰 분석
  bid_analysis: 2000,

  // 계약서 AI 분석
  contract_analysis: 4000,

  // 인증 진단
  certification_check: 2000,

  // 정책자금 매칭
  fund_matching: 2000,

  // 보조금 매칭
  subsidy_matching: 2000,

  // 토지이용계획 조회
  land_use_check: 1500,

  // 법령 검색
  law_search: 2000,

  // HWPX 서식 다운로드
  template_download: 500,
};

/**
 * 기능명 한글 맵 (토큰 내역 표시용)
 */
export const TOKEN_FEATURE_NAMES: Record<string, string> = {
  ai_chat: "AI 상담",
  document_create: "서류 작성",
  document_review: "서류 검토",
  rpa_submission: "민원 자동접수",
  doc24_submission: "문서24 발송",
  permit_check: "인허가 진단",
  visa_calculator: "비자 계산기",
  bid_analysis: "입찰 분석",
  contract_analysis: "계약서 AI 분석",
  certification_check: "인증 진단",
  fund_matching: "정책자금 매칭",
  subsidy_matching: "보조금 매칭",
  land_use_check: "토지이용계획 조회",
  law_search: "법령 검색",
  template_download: "서식 다운로드",
};
