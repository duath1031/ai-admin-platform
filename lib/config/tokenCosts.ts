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

  // 건축행정AI
  permit_check: 2000,

  // 비자AI
  visa_calculator: 1000,

  // 입찰 분석
  bid_analysis: 2000,

  // 입찰 시뮬레이션
  bid_simulation: 3000,

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

  // 노동행정 AI
  insurance_calc: 500,
  payslip_generate: 1500,
  severance_calc: 500,
  annual_leave_calc: 300,
  weekly_holiday_calc: 300,
  labor_contract: 3000,
  employee_management: 0,
  insurance_report: 1000,

  // 내용증명
  legal_notice: 3000,

  // 거래처 관리
  client_management: 0,

  // 회의록/녹취록
  meeting_minutes: 3000,

  // 뿌리기업 확인
  root_company_check: 2000,

  // 기업부설연구소
  research_institute: 2000,
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
  permit_check: "건축행정AI",
  visa_calculator: "비자AI",
  bid_analysis: "입찰 분석",
  bid_simulation: "입찰 시뮬레이션",
  contract_analysis: "계약서 AI 분석",
  certification_check: "인증 진단",
  fund_matching: "정책자금 매칭",
  subsidy_matching: "보조금 매칭",
  land_use_check: "토지이용계획 조회",
  law_search: "법령 검색",
  template_download: "서식 다운로드",
  insurance_calc: "4대보험 계산",
  payslip_generate: "급여명세서 생성",
  severance_calc: "퇴직금 계산",
  annual_leave_calc: "연차 계산",
  weekly_holiday_calc: "주휴수당 계산",
  labor_contract: "근로계약서 AI",
  employee_management: "직원 관리",
  insurance_report: "4대보험 신고서",
  legal_notice: "내용증명 작성",
  client_management: "거래처 관리",
  meeting_minutes: "회의록/녹취록 AI",
  root_company_check: "뿌리기업 확인",
  research_institute: "기업부설연구소",
};
