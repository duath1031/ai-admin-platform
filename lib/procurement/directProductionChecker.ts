// =============================================================================
// 직접생산확인 자가진단 엔진
// 조달청 직접생산확인증명 취득을 위한 사전 점검 도구
// 5개 카테고리 (생산설비/생산인력/품질관리/생산실적/기타) 100점 만점 평가
// =============================================================================

export interface DiagnosisInput {
  // 기본 정보
  companyName: string;
  bizRegNo?: string;
  productName: string;
  productCategory: string;

  // 1. 생산설비 (30점)
  hasFactory: boolean;
  factoryOwnership: 'owned' | 'leased' | 'none';
  hasProductionEquipment: boolean;
  equipmentList?: string;
  hasRawMaterialStorage: boolean;

  // 2. 생산인력 (20점)
  totalEmployees: number;
  productionWorkers: number;
  hasTechnician: boolean;

  // 3. 품질관리 (25점)
  hasQualitySystem: boolean;
  hasQualityInspector: boolean;
  hasTestEquipment: boolean;
  hasISO9001: boolean;
  hasKSCertification: boolean;

  // 4. 생산실적 (15점)
  hasProductionRecord: boolean;
  recentYearRevenue: number;

  // 5. 기타 (10점)
  hasBizRegistration: boolean;
  hasFactoryRegistration: boolean;
  hasEnvironmentPermit: boolean;
}

export interface DiagnosisItem {
  label: string;
  score: number;
  maxScore: number;
  status: 'pass' | 'fail' | 'warning';
  advice?: string;
}

export interface DiagnosisCategory {
  name: string;
  score: number;
  maxScore: number;
  items: DiagnosisItem[];
}

export interface DiagnosisResult {
  totalScore: number;
  passed: boolean;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  categories: DiagnosisCategory[];
  recommendations: string[];
  requiredDocuments: string[];
}

// ---------------------------------------------------------------------------
// 등급 산정
// ---------------------------------------------------------------------------
function calcGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// 진단 실행
// ---------------------------------------------------------------------------
export function runDiagnosis(input: DiagnosisInput): DiagnosisResult {
  const categories: DiagnosisCategory[] = [];
  const recommendations: string[] = [];
  const requiredDocuments: string[] = [];

  // =========================================================================
  // 1. 생산설비 (30점)
  // =========================================================================
  const equipItems: DiagnosisItem[] = [];

  // 공장 보유 (12점)
  if (input.hasFactory) {
    if (input.factoryOwnership === 'owned') {
      equipItems.push({ label: '공장 보유 (자가)', score: 12, maxScore: 12, status: 'pass' });
    } else if (input.factoryOwnership === 'leased') {
      equipItems.push({
        label: '공장 보유 (임차)',
        score: 9,
        maxScore: 12,
        status: 'warning',
        advice: '자가 공장 확보 시 가점이 있습니다. 임대차계약서(잔여기간 1년 이상)를 준비하세요.',
      });
      recommendations.push('공장을 자가로 확보하면 생산설비 항목 만점이 가능합니다.');
    } else {
      equipItems.push({
        label: '공장 보유 (소유형태 미상)',
        score: 6,
        maxScore: 12,
        status: 'warning',
        advice: '공장 소유형태(자가/임차)를 명확히 해주세요.',
      });
    }
    requiredDocuments.push('공장등록증명서');
    if (input.factoryOwnership === 'leased') {
      requiredDocuments.push('공장 임대차계약서 (잔여기간 1년 이상 권장)');
    }
  } else {
    equipItems.push({
      label: '공장 보유',
      score: 0,
      maxScore: 12,
      status: 'fail',
      advice: '직접생산확인을 위해 공장(생산시설)은 필수입니다. 공장등록을 먼저 완료하세요.',
    });
    recommendations.push('[필수] 공장(생산시설) 확보 및 공장등록증명서 취득이 필요합니다.');
  }

  // 생산설비 보유 (12점)
  if (input.hasProductionEquipment) {
    equipItems.push({ label: '주요 생산설비 보유', score: 12, maxScore: 12, status: 'pass' });
    requiredDocuments.push('생산설비 목록표 (설비명, 규격, 수량, 취득일)');
  } else {
    equipItems.push({
      label: '주요 생산설비 보유',
      score: 0,
      maxScore: 12,
      status: 'fail',
      advice: '해당 물품을 직접 생산할 수 있는 주요 설비(핵심 공정 설비)를 갖추어야 합니다.',
    });
    recommendations.push('[필수] 납품 물품의 핵심 공정에 필요한 생산설비를 확보하세요.');
  }

  // 원자재 보관시설 (6점)
  if (input.hasRawMaterialStorage) {
    equipItems.push({ label: '원자재 보관시설', score: 6, maxScore: 6, status: 'pass' });
  } else {
    equipItems.push({
      label: '원자재 보관시설',
      score: 0,
      maxScore: 6,
      status: 'warning',
      advice: '원자재 및 부자재를 보관할 수 있는 창고/보관시설이 있으면 가점입니다.',
    });
    recommendations.push('원자재 보관시설(창고)을 확보하면 생산설비 점수를 높일 수 있습니다.');
  }

  const equipScore = equipItems.reduce((s, i) => s + i.score, 0);
  categories.push({ name: '생산설비', score: equipScore, maxScore: 30, items: equipItems });

  // =========================================================================
  // 2. 생산인력 (20점)
  // =========================================================================
  const hrItems: DiagnosisItem[] = [];

  // 총 종업원수 (6점)
  if (input.totalEmployees >= 10) {
    hrItems.push({ label: '총 종업원 수 (10인 이상)', score: 6, maxScore: 6, status: 'pass' });
  } else if (input.totalEmployees >= 5) {
    hrItems.push({
      label: `총 종업원 수 (${input.totalEmployees}인)`,
      score: 4,
      maxScore: 6,
      status: 'warning',
      advice: '10인 이상이면 만점입니다. 현재 규모에서도 진행은 가능하나 인력 보강을 권장합니다.',
    });
  } else if (input.totalEmployees >= 1) {
    hrItems.push({
      label: `총 종업원 수 (${input.totalEmployees}인)`,
      score: 2,
      maxScore: 6,
      status: 'warning',
      advice: '종업원 수가 적으면 생산 능력 입증이 어려울 수 있습니다.',
    });
  } else {
    hrItems.push({
      label: '총 종업원 수 (0인)',
      score: 0,
      maxScore: 6,
      status: 'fail',
      advice: '최소 1인 이상의 종업원이 있어야 합니다.',
    });
    recommendations.push('[필수] 최소 1인 이상의 생산 인력을 확보하세요.');
  }

  // 생산직 근로자 (8점)
  if (input.productionWorkers >= 5) {
    hrItems.push({ label: '생산직 근로자 (5인 이상)', score: 8, maxScore: 8, status: 'pass' });
  } else if (input.productionWorkers >= 3) {
    hrItems.push({
      label: `생산직 근로자 (${input.productionWorkers}인)`,
      score: 6,
      maxScore: 8,
      status: 'warning',
      advice: '생산직 근로자 5인 이상이면 만점입니다.',
    });
  } else if (input.productionWorkers >= 1) {
    hrItems.push({
      label: `생산직 근로자 (${input.productionWorkers}인)`,
      score: 3,
      maxScore: 8,
      status: 'warning',
      advice: '생산직 근로자를 추가 확보하면 인력 항목 점수가 올라갑니다.',
    });
    recommendations.push('생산직 근로자를 최소 3인 이상으로 확보하면 인력 점수 향상됩니다.');
  } else {
    hrItems.push({
      label: '생산직 근로자 (0인)',
      score: 0,
      maxScore: 8,
      status: 'fail',
      advice: '직접생산을 위해 최소 1인 이상의 생산직 근로자가 필요합니다.',
    });
    recommendations.push('[필수] 생산직 근로자를 최소 1인 이상 고용하세요.');
  }

  // 기술인력 (6점)
  if (input.hasTechnician) {
    hrItems.push({ label: '기술인력 보유 (기사/산업기사 등)', score: 6, maxScore: 6, status: 'pass' });
    requiredDocuments.push('기술자격증 사본 (기사, 산업기사, 기능사 등)');
  } else {
    hrItems.push({
      label: '기술인력 보유',
      score: 0,
      maxScore: 6,
      status: 'warning',
      advice: '관련 분야 기사/산업기사/기능사 자격 보유 인력이 있으면 가점입니다.',
    });
    recommendations.push('관련 기술자격(기사/산업기사) 보유 인력을 확보하면 인력 점수가 높아집니다.');
  }

  const hrScore = hrItems.reduce((s, i) => s + i.score, 0);
  categories.push({ name: '생산인력', score: hrScore, maxScore: 20, items: hrItems });

  // =========================================================================
  // 3. 품질관리 (25점)
  // =========================================================================
  const qcItems: DiagnosisItem[] = [];

  // 품질관리체계 (7점)
  if (input.hasQualitySystem) {
    qcItems.push({ label: '품질관리체계 구축', score: 7, maxScore: 7, status: 'pass' });
    requiredDocuments.push('품질관리 규정/매뉴얼');
  } else {
    qcItems.push({
      label: '품질관리체계 구축',
      score: 0,
      maxScore: 7,
      status: 'fail',
      advice: '체계적인 품질관리 규정(입고검사, 공정검사, 출하검사 절차)을 마련하세요.',
    });
    recommendations.push('[중요] 품질관리 규정/매뉴얼을 마련하세요 (입고-공정-출하 검사 절차).');
  }

  // 품질검사 전담인력 (6점)
  if (input.hasQualityInspector) {
    qcItems.push({ label: '품질검사 전담인력', score: 6, maxScore: 6, status: 'pass' });
  } else {
    qcItems.push({
      label: '품질검사 전담인력',
      score: 0,
      maxScore: 6,
      status: 'warning',
      advice: '품질검사를 전담하는 인력(또는 겸직)을 지정하세요.',
    });
    recommendations.push('품질검사 전담(또는 겸직) 인력을 지정하면 품질관리 점수가 높아집니다.');
  }

  // 시험/검사 장비 (6점)
  if (input.hasTestEquipment) {
    qcItems.push({ label: '시험/검사 장비 보유', score: 6, maxScore: 6, status: 'pass' });
    requiredDocuments.push('시험/검사 장비 목록 (장비명, 규격, 교정일)');
  } else {
    qcItems.push({
      label: '시험/검사 장비 보유',
      score: 0,
      maxScore: 6,
      status: 'warning',
      advice: '제품 품질을 검증할 수 있는 시험/검사 장비를 보유하면 가점입니다.',
    });
    recommendations.push('시험/검사 장비를 확보하면 품질관리 점수를 높일 수 있습니다.');
  }

  // ISO 9001 (4점)
  if (input.hasISO9001) {
    qcItems.push({ label: 'ISO 9001 인증', score: 4, maxScore: 4, status: 'pass' });
    requiredDocuments.push('ISO 9001 인증서 사본');
  } else {
    qcItems.push({
      label: 'ISO 9001 인증',
      score: 0,
      maxScore: 4,
      status: 'warning',
      advice: 'ISO 9001 품질경영시스템 인증이 있으면 품질관리 신뢰도가 크게 상승합니다.',
    });
  }

  // KS 인증 (2점)
  if (input.hasKSCertification) {
    qcItems.push({ label: 'KS 인증', score: 2, maxScore: 2, status: 'pass' });
    requiredDocuments.push('KS 인증서 사본');
  } else {
    qcItems.push({
      label: 'KS 인증',
      score: 0,
      maxScore: 2,
      status: 'warning',
      advice: 'KS 인증이 있으면 추가 가점을 받을 수 있습니다.',
    });
  }

  const qcScore = qcItems.reduce((s, i) => s + i.score, 0);
  categories.push({ name: '품질관리', score: qcScore, maxScore: 25, items: qcItems });

  // =========================================================================
  // 4. 생산실적 (15점)
  // =========================================================================
  const recordItems: DiagnosisItem[] = [];

  // 생산실적 존재 (8점)
  if (input.hasProductionRecord) {
    recordItems.push({ label: '생산실적 보유', score: 8, maxScore: 8, status: 'pass' });
    requiredDocuments.push('생산실적 증빙 (세금계산서, 거래명세서 등)');
  } else {
    recordItems.push({
      label: '생산실적 보유',
      score: 0,
      maxScore: 8,
      status: 'fail',
      advice: '해당 물품 또는 유사 물품의 생산/납품 실적이 필요합니다.',
    });
    recommendations.push('[중요] 해당 물품(또는 유사 물품)의 생산실적을 확보하세요.');
  }

  // 매출액 (7점)
  const rev = input.recentYearRevenue;
  if (rev >= 500_000_000) {
    recordItems.push({ label: '최근 1년 매출 (5억 이상)', score: 7, maxScore: 7, status: 'pass' });
  } else if (rev >= 100_000_000) {
    recordItems.push({
      label: `최근 1년 매출 (${formatKRW(rev)})`,
      score: 5,
      maxScore: 7,
      status: 'warning',
      advice: '매출 5억 이상이면 만점입니다. 현재 수준에서도 신청 가능합니다.',
    });
  } else if (rev >= 10_000_000) {
    recordItems.push({
      label: `최근 1년 매출 (${formatKRW(rev)})`,
      score: 3,
      maxScore: 7,
      status: 'warning',
      advice: '매출이 적은 경우 실사 시 불리할 수 있습니다.',
    });
  } else {
    recordItems.push({
      label: '최근 1년 매출 (1천만원 미만)',
      score: 0,
      maxScore: 7,
      status: 'fail',
      advice: '최소한의 매출 실적이 필요합니다.',
    });
    recommendations.push('매출 실적이 부족합니다. 납품 실적을 확보한 뒤 신청하세요.');
  }

  requiredDocuments.push('부가가치세 과세표준증명원 (최근 1년)');

  const recordScore = recordItems.reduce((s, i) => s + i.score, 0);
  categories.push({ name: '생산실적', score: recordScore, maxScore: 15, items: recordItems });

  // =========================================================================
  // 5. 기타 (10점)
  // =========================================================================
  const etcItems: DiagnosisItem[] = [];

  // 사업자등록증 (제조업) (4점)
  if (input.hasBizRegistration) {
    etcItems.push({ label: '사업자등록증 (제조업 업종)', score: 4, maxScore: 4, status: 'pass' });
    requiredDocuments.push('사업자등록증 사본 (업종: 제조업)');
  } else {
    etcItems.push({
      label: '사업자등록증 (제조업)',
      score: 0,
      maxScore: 4,
      status: 'fail',
      advice: '사업자등록증에 \"제조업\"이 포함되어 있어야 합니다. 업종 추가/변경을 하세요.',
    });
    recommendations.push('[필수] 사업자등록증의 업종에 \"제조업\"이 포함되어야 합니다.');
  }

  // 공장등록증명서 (4점)
  if (input.hasFactoryRegistration) {
    etcItems.push({ label: '공장등록증명서', score: 4, maxScore: 4, status: 'pass' });
    requiredDocuments.push('공장등록증명서');
  } else {
    etcItems.push({
      label: '공장등록증명서',
      score: 0,
      maxScore: 4,
      status: 'fail',
      advice: '공장등록증명서가 필요합니다. 해당 지자체에서 공장등록을 진행하세요.',
    });
    recommendations.push('[필수] 공장등록증명서를 취득하세요 (관할 시/군/구청 공장등록).');
  }

  // 환경관련 인허가 (2점)
  if (input.hasEnvironmentPermit) {
    etcItems.push({ label: '환경관련 인허가', score: 2, maxScore: 2, status: 'pass' });
    requiredDocuments.push('환경관련 인허가 서류 (배출시설허가 등, 해당 시)');
  } else {
    etcItems.push({
      label: '환경관련 인허가',
      score: 0,
      maxScore: 2,
      status: 'warning',
      advice: '업종에 따라 대기/수질/소음 등 환경 인허가가 필요할 수 있습니다. 해당 여부를 확인하세요.',
    });
  }

  const etcScore = etcItems.reduce((s, i) => s + i.score, 0);
  categories.push({ name: '기타 서류', score: etcScore, maxScore: 10, items: etcItems });

  // =========================================================================
  // 종합
  // =========================================================================
  const totalScore = categories.reduce((s, c) => s + c.score, 0);
  const passed = totalScore >= 70;
  const grade = calcGrade(totalScore);

  // 기본 서류 항상 추가
  const baseDocuments = [
    '중소기업확인서',
    '법인등기부등본 (법인) 또는 사업자등록증 사본',
    '직접생산확인증명 신청서 (조달청 양식)',
    '직접생산 물품 설명서 (제조공정도 포함)',
    '4대 사회보험 가입 확인서 (사업장 단위)',
  ];

  // 중복 제거
  const allDocs = Array.from(new Set([...baseDocuments, ...requiredDocuments]));

  // 요약 권고
  if (passed) {
    recommendations.unshift(
      `총점 ${totalScore}점으로 직접생산확인 신청 기준(70점)을 충족합니다. 서류를 갖추어 조달청에 신청하세요.`,
    );
  } else {
    recommendations.unshift(
      `총점 ${totalScore}점으로 기준 미달(70점 이상 필요)입니다. 아래 개선사항을 보완한 뒤 신청하세요.`,
    );
  }

  return {
    totalScore,
    passed,
    grade,
    categories,
    recommendations,
    requiredDocuments: allDocs,
  };
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------
function formatKRW(amount: number): string {
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(1)}억원`;
  }
  if (amount >= 10_000) {
    return `${(amount / 10_000).toFixed(0)}만원`;
  }
  return `${amount.toLocaleString()}원`;
}
