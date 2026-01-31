/**
 * 비자 점수 계산 API
 * POST /api/analytics/visa-score
 *
 * 지원: F-2-7 (점수제 거주), E-7 (특정활동)
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateF27Score, evaluateE7Eligibility } from '@/lib/analytics/visaCalculator';
import type { F27Input, E7Input } from '@/lib/analytics/visaCalculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { visaType, data } = body;

    if (!visaType || !data) {
      return NextResponse.json(
        { success: false, error: 'visaType과 data는 필수입니다.' },
        { status: 400 }
      );
    }

    switch (visaType) {
      case 'F-2-7': {
        const input: F27Input = {
          age: Number(data.age) || 30,
          annualIncome: Number(data.annualIncome) || 0,
          education: data.education || 'bachelors',
          koreanDegree: Boolean(data.koreanDegree),
          topikLevel: (Number(data.topikLevel) || 0) as F27Input['topikLevel'],
          kiipLevel: (Number(data.kiipLevel) || 0) as F27Input['kiipLevel'],
          workExperienceYears: Number(data.workExperienceYears) || 0,
          hasKoreanSpouse: Boolean(data.hasKoreanSpouse),
          hasMinorChild: Boolean(data.hasMinorChild),
          volunteerHours: Number(data.volunteerHours) || 0,
          taxPaymentYears: Number(data.taxPaymentYears) || 0,
          hasSpecialMerit: Boolean(data.hasSpecialMerit),
          currentVisa: data.currentVisa || '',
          stayYears: Number(data.stayYears) || 0,
        };

        const result = calculateF27Score(input);
        return NextResponse.json({ success: true, visaType: 'F-2-7', ...result });
      }

      case 'E-7': {
        const input: E7Input = {
          education: data.education || 'bachelors',
          fieldMatchesDegree: Boolean(data.fieldMatchesDegree),
          workExperienceYears: Number(data.workExperienceYears) || 0,
          annualSalary: Number(data.annualSalary) || 0,
          companySize: data.companySize || 'small',
          hasNationalCert: Boolean(data.hasNationalCert),
          occupationCode: data.occupationCode || '',
          isInnopolisCompany: Boolean(data.isInnopolisCompany),
          koreanLanguage: data.koreanLanguage || 'none',
        };

        const result = evaluateE7Eligibility(input);
        return NextResponse.json({ success: true, visaType: 'E-7', ...result });
      }

      default:
        return NextResponse.json(
          { success: false, error: `지원하지 않는 비자 유형: ${visaType}. 지원: F-2-7, E-7` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[Visa Score API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    supportedTypes: [
      {
        visaType: 'F-2-7',
        name: '점수제 거주 비자',
        passingScore: 80,
        maxScore: 120,
        categories: ['나이', '학력', '한국어(TOPIK)', '소득', '경력', '사회기여'],
      },
      {
        visaType: 'E-7',
        name: '특정활동 비자',
        passingScore: 60,
        maxScore: 100,
        categories: ['학력', '경력', '연봉', '기업규모', '자격증', '한국어'],
      },
    ],
    usage: 'POST /api/analytics/visa-score with { visaType: "F-2-7" | "E-7", data: {...} }',
  });
}
