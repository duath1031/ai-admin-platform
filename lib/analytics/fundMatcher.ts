// =============================================================================
// 정책자금 매칭 엔진
// 기업 프로필 기반 정책자금 적합도 자동 판정
// =============================================================================

import { FUND_PROGRAMS, type FundProgram } from './fundPrograms';

export interface FundMatchResult {
  program: FundProgram;
  matchScore: number; // 0-100
  matchLevel: 'high' | 'medium' | 'low';
  metRequirements: string[];
  unmetRequirements: string[];
  recommendation: string;
}

export interface CompanyDataForFund {
  foundedDate?: string | Date | null;
  establishmentDate?: string | Date | null;
  employeeCount?: number;
  capital?: number;
  revenueYear1?: number | null;
  revenueYear2?: number | null;
  rndExpenditure?: number | null;
  researcherCount?: number | null;
  hasResearchInstitute?: boolean;
  hasRndDepartment?: boolean;
  isExporter?: boolean;
  exportAmount?: number | null;
  businessSector?: string | null;
  certifications?: { certType: string; isActive: boolean }[];
  patents?: { patentType: string; status: string }[];
}

function yearsSinceDate(date: string | Date | null | undefined): number {
  if (!date) return 0;
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function checkRequirement(field: string, data: CompanyDataForFund): boolean {
  const years = yearsSinceDate(data.foundedDate || data.establishmentDate);

  switch (field) {
    case 'isSmallBiz':
      return (data.employeeCount || 0) < 300 && (data.revenueYear1 || 0) < 150_000_000_000;
    case 'yearsFromFounding':
      return years > 0 && years <= 7;
    case 'hasPatent':
      return (data.patents || []).some(p => p.status === 'registered');
    case 'hasResearchInstitute':
      return !!(data.hasResearchInstitute || data.hasRndDepartment);
    case 'hasVentureCert':
      return (data.certifications || []).some(c => c.certType === 'venture' && c.isActive);
    case 'hasRnd':
      return !!(data.rndExpenditure && data.rndExpenditure > 0) || (data.researcherCount || 0) > 0;
    case 'hasRevenue':
      return (data.revenueYear1 || 0) > 0;
    case 'isExporter':
      return !!data.isExporter || (data.exportAmount || 0) > 0;
    case 'isManufacturing':
      return (data.businessSector || '').includes('제조');
    default:
      return false;
  }
}

function matchProgram(program: FundProgram, data: CompanyDataForFund): FundMatchResult {
  const metRequirements: string[] = [];
  const unmetRequirements: string[] = [];
  let weightedScore = 0;
  let totalWeight = 0;

  for (const req of program.requirements) {
    const weight = req.check === 'required' ? 3 : req.check === 'preferred' ? 2 : 1;
    totalWeight += weight;

    if (checkRequirement(req.field, data)) {
      metRequirements.push(req.label);
      weightedScore += weight;
    } else {
      unmetRequirements.push(`${req.label} (${req.description})`);
      if (req.check !== 'required') {
        // 비필수 항목 미충족은 부분점수
        weightedScore += weight * 0.2;
      }
    }
  }

  const matchScore = Math.round((weightedScore / totalWeight) * 100);
  const matchLevel = matchScore >= 70 ? 'high' : matchScore >= 40 ? 'medium' : 'low';

  // 필수 요건 미충족 시 강제 low
  const hasUnmetRequired = program.requirements.some(
    r => r.check === 'required' && !checkRequirement(r.field, data)
  );

  const finalLevel = hasUnmetRequired ? 'low' : matchLevel;
  const finalScore = hasUnmetRequired ? Math.min(matchScore, 30) : matchScore;

  let recommendation = '';
  if (finalLevel === 'high') {
    recommendation = `${program.name}에 높은 적합도를 보입니다. 공모 시기를 확인하고 사전 준비를 시작하세요.`;
  } else if (finalLevel === 'medium') {
    recommendation = `일부 보완 후 신청이 가능합니다. 미충족 항목을 확인하세요.`;
  } else {
    recommendation = hasUnmetRequired
      ? `필수 요건이 미충족되어 현재 신청이 어렵습니다.`
      : `현재 기업 조건과 매칭도가 낮습니다.`;
  }

  return {
    program,
    matchScore: finalScore,
    matchLevel: finalLevel,
    metRequirements,
    unmetRequirements,
    recommendation,
  };
}

export function runFundMatching(data: CompanyDataForFund): FundMatchResult[] {
  return FUND_PROGRAMS
    .map(program => matchProgram(program, data))
    .sort((a, b) => b.matchScore - a.matchScore);
}
