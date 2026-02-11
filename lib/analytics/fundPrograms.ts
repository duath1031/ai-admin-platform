// =============================================================================
// 정책자금 프로그램 데이터베이스
// =============================================================================

export interface FundProgram {
  id: string;
  name: string;
  agency: string;           // 운영기관
  category: string;         // 분류 (R&D, 사업화, 수출, 정책자금 등)
  maxAmount: string;        // 최대 지원 금액 표시
  maxAmountNum: number;     // 비교용 숫자 (원)
  supportType: string;      // 지원 유형 (출연금, 융자, 보증 등)
  period: string;           // 지원 기간
  requirements: FundRequirement[];
  website: string;
  description: string;
}

export interface FundRequirement {
  field: string;
  label: string;
  check: 'required' | 'preferred' | 'bonus';
  description: string;
}

export const FUND_PROGRAMS: FundProgram[] = [
  {
    id: 'tips',
    name: 'TIPS (민간투자주도형 기술창업지원)',
    agency: '중소벤처기업부',
    category: 'R&D',
    maxAmount: '최대 10억원',
    maxAmountNum: 1_000_000_000,
    supportType: '출연금(R&D) + 엔젤매칭',
    period: '3년',
    requirements: [
      { field: 'yearsFromFounding', label: '업력 7년 이내', check: 'required', description: '설립 후 7년 이내 기업' },
      { field: 'isSmallBiz', label: '중소기업', check: 'required', description: '중소기업기본법상 중소기업' },
      { field: 'hasPatent', label: '기술력 보유', check: 'preferred', description: '특허, 기술 등 핵심 기술 보유' },
      { field: 'hasResearchInstitute', label: '연구소/전담부서', check: 'bonus', description: '기업부설연구소 또는 R&D 전담부서' },
      { field: 'hasVentureCert', label: '벤처기업 인증', check: 'bonus', description: '벤처기업 확인서 보유 시 가산' },
    ],
    website: 'https://www.jointips.or.kr',
    description: 'TIPS 운영사의 투자를 받은 기업에 R&D 자금을 매칭 지원. 민간 엔젤투자 연계 필수.',
  },
  {
    id: 'startup_growth',
    name: '창업성장기술개발사업',
    agency: '중소벤처기업부',
    category: 'R&D',
    maxAmount: '최대 3억원',
    maxAmountNum: 300_000_000,
    supportType: '출연금',
    period: '2년',
    requirements: [
      { field: 'yearsFromFounding', label: '업력 7년 이내', check: 'required', description: '창업 7년 이내 중소기업' },
      { field: 'isSmallBiz', label: '중소기업', check: 'required', description: '중소기업기본법상 중소기업' },
      { field: 'hasRnd', label: 'R&D 역량', check: 'preferred', description: 'R&D 투자실적 또는 연구인력 보유' },
      { field: 'hasPatent', label: '기술력 보유', check: 'bonus', description: '특허, 논문 등 기술성과물' },
    ],
    website: 'https://www.smtech.go.kr',
    description: '창업 초기 기술개발을 지원하는 정부 R&D 과제. 디딤돌/전략형 트랙.',
  },
  {
    id: 'export_voucher',
    name: '수출바우처',
    agency: '중소벤처기업부 / KOTRA',
    category: '수출',
    maxAmount: '최대 1억원',
    maxAmountNum: 100_000_000,
    supportType: '바우처(수출활동비)',
    period: '1년',
    requirements: [
      { field: 'isSmallBiz', label: '중소기업', check: 'required', description: '중소기업기본법상 중소기업' },
      { field: 'isExporter', label: '수출 의지/실적', check: 'preferred', description: '수출 실적 또는 수출 계획 보유' },
      { field: 'hasRevenue', label: '매출 실적', check: 'required', description: '일정 매출 실적 보유' },
      { field: 'hasVentureCert', label: '벤처/이노비즈', check: 'bonus', description: '인증기업 가산점' },
    ],
    website: 'https://www.exportvoucher.com',
    description: '해외마케팅, 통번역, 해외인증 등 수출활동에 바우처 지원.',
  },
  {
    id: 'sme_policy_fund',
    name: '중소기업 정책자금 (직접대출)',
    agency: '중소벤처기업진흥공단',
    category: '정책자금',
    maxAmount: '최대 100억원',
    maxAmountNum: 10_000_000_000,
    supportType: '저금리 융자',
    period: '최대 8년 (거치 3년)',
    requirements: [
      { field: 'isSmallBiz', label: '중소기업', check: 'required', description: '중소기업기본법상 중소기업' },
      { field: 'hasRevenue', label: '매출 실적', check: 'required', description: '사업 영위 실적' },
      { field: 'yearsFromFounding', label: '업력', check: 'preferred', description: '업력에 따라 지원 유형 상이' },
      { field: 'hasVentureCert', label: '벤처/이노비즈', check: 'bonus', description: '인증기업 우대 금리' },
    ],
    website: 'https://www.kosmes.or.kr',
    description: '중소기업진흥공단의 저금리 정책자금. 혁신성장형, 긴급경영안정자금 등.',
  },
  {
    id: 'small_biz_tech',
    name: '중소기업기술혁신개발사업',
    agency: '중소벤처기업부',
    category: 'R&D',
    maxAmount: '최대 5억원',
    maxAmountNum: 500_000_000,
    supportType: '출연금',
    period: '2~3년',
    requirements: [
      { field: 'isSmallBiz', label: '중소기업', check: 'required', description: '중소기업기본법상 중소기업' },
      { field: 'hasRnd', label: 'R&D 역량', check: 'required', description: 'R&D 투자실적 및 연구인력' },
      { field: 'hasResearchInstitute', label: '연구소', check: 'preferred', description: '기업부설연구소 보유 우대' },
      { field: 'hasPatent', label: '기술력', check: 'preferred', description: '특허 등 기술성과물 보유' },
    ],
    website: 'https://www.smtech.go.kr',
    description: '기존 중소기업의 기술혁신을 위한 R&D 지원. 시장확대형, 공정개선형 등.',
  },
  {
    id: 'credit_guarantee',
    name: '기술보증기금 보증',
    agency: '기술보증기금(KIBO)',
    category: '보증',
    maxAmount: '최대 30억원',
    maxAmountNum: 3_000_000_000,
    supportType: '신용보증',
    period: '1~5년',
    requirements: [
      { field: 'isSmallBiz', label: '중소기업', check: 'required', description: '중소기업기본법상 중소기업' },
      { field: 'hasRnd', label: '기술역량', check: 'preferred', description: 'R&D 역량 또는 기술성 보유' },
      { field: 'hasPatent', label: '지식재산권', check: 'bonus', description: '특허, 실용신안 등 기술 IP' },
      { field: 'hasVentureCert', label: '벤처/이노비즈', check: 'bonus', description: '인증기업 보증 우대' },
    ],
    website: 'https://www.kibo.or.kr',
    description: '기술 기반 중소기업에 대한 신용보증 제공. 은행 대출 시 담보 역할.',
  },
  {
    id: 'manufacturing_innovation',
    name: '스마트공장 구축지원',
    agency: '중소벤처기업부 / 스마트제조혁신추진단',
    category: '사업화',
    maxAmount: '최대 1.5억원',
    maxAmountNum: 150_000_000,
    supportType: '보조금 (자부담 50%)',
    period: '1년',
    requirements: [
      { field: 'isSmallBiz', label: '중소기업', check: 'required', description: '중소기업기본법상 중소기업' },
      { field: 'isManufacturing', label: '제조업', check: 'required', description: '제조업 영위 기업' },
      { field: 'hasRevenue', label: '매출 실적', check: 'required', description: '사업 영위 실적' },
    ],
    website: 'https://www.smart-factory.kr',
    description: '제조 중소기업의 스마트공장 도입을 위한 보조금 지원.',
  },
];
