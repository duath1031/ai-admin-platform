export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";

// Vercel 타임아웃
export const maxDuration = 30;

/**
 * AI 서류 검증 API
 * 제출 전 서류 완성도 검사 + 반려 위험 예측
 *
 * POST /api/document/validate
 * Body: { templateCode, fields: Record<string, string>, submissionTarget?: string }
 *
 * 응답: { score, issues[], warnings[], recommendation }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const userId = session.user.id as string;

    // 플랜 체크: document_review 기능 필요
    const access = await checkFeatureAccess(userId, "document_review");
    if (!access.allowed) {
      return NextResponse.json(
        { error: "서류 검증은 Standard 이상 플랜에서 이용 가능합니다.", requiredPlan: access.requiredPlan },
        { status: 403 }
      );
    }

    // 토큰 차감 (1,000 토큰)
    const deducted = await deductTokens(userId, "document_review");
    if (!deducted) {
      return NextResponse.json(
        { error: "토큰이 부족합니다.", redirect: "/token-charge" },
        { status: 402 }
      );
    }

    const { templateCode, fields, submissionTarget } = await req.json();

    if (!templateCode || !fields || typeof fields !== 'object') {
      return NextResponse.json(
        { error: "templateCode와 fields 파라미터가 필요합니다." },
        { status: 400 }
      );
    }

    // 서류 검증 로직
    const result = validateDocument(templateCode, fields, submissionTarget);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Document Validate] 오류:", error);
    return NextResponse.json(
      { error: "서류 검증 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// =============================================================================
// 검증 규칙 엔진
// =============================================================================

interface ValidationResult {
  score: number;           // 0~100 완성도 점수
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: ValidationIssue[];    // 필수 수정 사항
  warnings: ValidationIssue[];  // 권장 수정 사항
  recommendation: string;       // 종합 소견
}

interface ValidationIssue {
  field: string;
  type: 'missing' | 'format' | 'length' | 'value';
  message: string;
  severity: 'error' | 'warning';
}

// 서식별 필수 필드 정의
const REQUIRED_FIELDS: Record<string, RequiredFieldDef[]> = {
  // 사업자등록 관련
  hwpx_사업자등록신청서: [
    { name: '상호', label: '상호(법인명)', rule: 'notEmpty' },
    { name: '대표자', label: '대표자 성명', rule: 'notEmpty' },
    { name: '사업장소재지', label: '사업장 소재지', rule: 'notEmpty' },
    { name: '업태', label: '업태', rule: 'notEmpty' },
    { name: '종목', label: '종목', rule: 'notEmpty' },
    { name: '사업개시일', label: '사업개시일', rule: 'date' },
    { name: '주민등록번호', label: '주민등록번호', rule: 'notEmpty' },
  ],
  // 식품영업 관련
  hwpx_식품영업신고서: [
    { name: '영업소명칭', label: '영업소 명칭', rule: 'notEmpty' },
    { name: '영업자', label: '영업자 성명', rule: 'notEmpty' },
    { name: '소재지', label: '영업소 소재지', rule: 'notEmpty' },
    { name: '영업의종류', label: '영업의 종류', rule: 'notEmpty' },
    { name: '시설면적', label: '시설 총면적', rule: 'number' },
  ],
  // 건축허가 관련
  hwpx_건축허가신청서: [
    { name: '대지위치', label: '대지 위치', rule: 'notEmpty' },
    { name: '건축주', label: '건축주 성명', rule: 'notEmpty' },
    { name: '용도', label: '건축물 용도', rule: 'notEmpty' },
    { name: '연면적', label: '연면적', rule: 'number' },
    { name: '건축면적', label: '건축면적', rule: 'number' },
    { name: '층수', label: '층수', rule: 'number' },
  ],
};

interface RequiredFieldDef {
  name: string;
  label: string;
  rule: 'notEmpty' | 'date' | 'number' | 'phone' | 'bizRegNo';
}

// 공통 검증 규칙
const COMMON_RULES: RequiredFieldDef[] = [
  { name: '신청일', label: '신청일자', rule: 'date' },
  { name: '신청인', label: '신청인 성명', rule: 'notEmpty' },
];

function validateDocument(
  templateCode: string,
  fields: Record<string, string>,
  submissionTarget?: string
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // 서식별 필수 필드 검증
  const requiredFields = REQUIRED_FIELDS[templateCode] || [];
  const allRules = [...requiredFields, ...COMMON_RULES];

  let totalChecks = allRules.length;
  let passedChecks = 0;

  for (const rule of allRules) {
    const value = fields[rule.name]?.trim() || '';
    const result = checkFieldRule(rule, value);

    if (result === null) {
      passedChecks++;
    } else {
      if (requiredFields.some(r => r.name === rule.name)) {
        issues.push(result);
      } else {
        warnings.push(result);
      }
    }
  }

  // 빈 필드가 아닌데 입력된 필드의 형식 검증
  for (const [key, value] of Object.entries(fields)) {
    if (!value?.trim()) continue;

    // 전화번호 형식
    if (key.includes('전화') || key.includes('연락처') || key.includes('휴대폰')) {
      if (!/^[\d-]+$/.test(value.trim())) {
        warnings.push({
          field: key,
          type: 'format',
          message: `${key}: 숫자와 하이픈만 입력 가능합니다.`,
          severity: 'warning',
        });
      }
    }

    // 사업자등록번호 형식
    if (key.includes('사업자등록번호') || key === 'bizRegNo') {
      const cleaned = value.replace(/[^0-9]/g, '');
      if (cleaned.length !== 10) {
        issues.push({
          field: key,
          type: 'format',
          message: '사업자등록번호는 10자리 숫자여야 합니다.',
          severity: 'error',
        });
      }
    }
  }

  // 점수 계산
  if (totalChecks === 0) totalChecks = 1;
  const filledFields = Object.values(fields).filter(v => v?.trim()).length;
  const totalFields = Object.keys(fields).length || 1;
  const fieldCompleteness = filledFields / totalFields;
  const ruleScore = passedChecks / totalChecks;
  const errorPenalty = issues.length * 10;
  const warningPenalty = warnings.length * 3;

  let score = Math.round((ruleScore * 60 + fieldCompleteness * 40) - errorPenalty - warningPenalty);
  score = Math.max(0, Math.min(100, score));

  // 등급
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  // 종합 소견
  let recommendation: string;
  if (grade === 'A') {
    recommendation = '서류가 잘 작성되었습니다. 제출해도 좋습니다.';
  } else if (grade === 'B') {
    recommendation = '대부분 완성되었으나 일부 항목을 보완하면 좋겠습니다.';
  } else if (grade === 'C') {
    recommendation = '필수 항목 누락이 있습니다. 수정 후 제출하세요.';
  } else if (grade === 'D') {
    recommendation = '많은 항목이 누락되었습니다. 반려 가능성이 높으니 보완이 필요합니다.';
  } else {
    recommendation = '서류가 매우 불완전합니다. 필수 항목을 모두 작성해주세요.';
  }

  if (submissionTarget) {
    recommendation += ` (제출처: ${submissionTarget})`;
  }

  return { score, grade, issues, warnings, recommendation };
}

function checkFieldRule(rule: RequiredFieldDef, value: string): ValidationIssue | null {
  if (rule.rule === 'notEmpty') {
    if (!value) {
      return {
        field: rule.name,
        type: 'missing',
        message: `${rule.label}: 필수 입력 항목입니다.`,
        severity: 'error',
      };
    }
  }

  if (rule.rule === 'date') {
    if (!value) return null; // 날짜는 비어있어도 OK (warning으로 처리)
    // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD 형식 검증
    if (!/^\d{4}[\-\.\/]\d{1,2}[\-\.\/]\d{1,2}$/.test(value) && !/^\d{8}$/.test(value)) {
      return {
        field: rule.name,
        type: 'format',
        message: `${rule.label}: 날짜 형식이 올바르지 않습니다. (예: 2026-01-15)`,
        severity: 'warning',
      };
    }
  }

  if (rule.rule === 'number') {
    if (!value) {
      return {
        field: rule.name,
        type: 'missing',
        message: `${rule.label}: 필수 입력 항목입니다.`,
        severity: 'error',
      };
    }
    if (isNaN(Number(value.replace(/[,\s]/g, '')))) {
      return {
        field: rule.name,
        type: 'format',
        message: `${rule.label}: 숫자를 입력해야 합니다.`,
        severity: 'error',
      };
    }
  }

  return null;
}
