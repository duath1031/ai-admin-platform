/**
 * 비자 점수 계산 API v2.0
 * POST /api/analytics/visa-score
 *
 * 지원: F-2-7, E-7, D-10, F-5, F-6, D-2, E-9, D-8 (8종)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  calculateF27Score,
  evaluateE7Eligibility,
  evaluateD10Eligibility,
  evaluateF5Eligibility,
  evaluateF6Eligibility,
  evaluateD2Eligibility,
  evaluateE9Eligibility,
  evaluateD8Eligibility,
  getVisaPathways,
} from '@/lib/analytics/visaCalculator';
import type { F27Input, E7Input, D10Input, F5Input, F6Input, D2Input, E9Input, D8Input } from '@/lib/analytics/visaCalculator';

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
          hasTechnicalCert: Boolean(data.hasTechnicalCert),
          certLevel: data.certLevel || 'none',
          hasRealEstate: Boolean(data.hasRealEstate),
          realEstateValue: Number(data.realEstateValue) || 0,
          regionType: data.regionType || 'metro',
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
          companyEmployees: Number(data.companyEmployees) || 0,
          foreignWorkerRatio: Number(data.foreignWorkerRatio) || 0,
          isSMESpecial: Boolean(data.isSMESpecial),
          hasAwardOrPatent: Boolean(data.hasAwardOrPatent),
        };
        const result = evaluateE7Eligibility(input);
        return NextResponse.json({ success: true, visaType: 'E-7', ...result });
      }

      case 'D-10': {
        const input: D10Input = {
          education: data.education || 'bachelors',
          graduatedFromKorea: Boolean(data.graduatedFromKorea),
          graduationWithinYear: Boolean(data.graduationWithinYear),
          topikLevel: (Number(data.topikLevel) || 0) as D10Input['topikLevel'],
          hasInternExperience: Boolean(data.hasInternExperience),
          fieldOfStudy: data.fieldOfStudy || '',
          hasJobOffer: Boolean(data.hasJobOffer),
          currentVisa: data.currentVisa || '',
          previousVisaViolation: Boolean(data.previousVisaViolation),
          annualIncome: Number(data.annualIncome) || 0,
          gpa: Number(data.gpa) || 0,
          universityRanking: data.universityRanking || 'other',
        };
        const result = evaluateD10Eligibility(input);
        return NextResponse.json({ success: true, visaType: 'D-10', ...result });
      }

      case 'F-5': {
        const input: F5Input = {
          currentVisa: data.currentVisa || '',
          stayYears: Number(data.stayYears) || 0,
          age: Number(data.age) || 30,
          annualIncome: Number(data.annualIncome) || 0,
          realEstateValue: Number(data.realEstateValue) || 0,
          totalAssets: Number(data.totalAssets) || 0,
          education: data.education || 'bachelors',
          topikLevel: (Number(data.topikLevel) || 0) as F5Input['topikLevel'],
          kiipCompleted: Boolean(data.kiipCompleted),
          hasCriminalRecord: Boolean(data.hasCriminalRecord),
          taxPaymentYears: Number(data.taxPaymentYears) || 0,
          hasKoreanSpouse: Boolean(data.hasKoreanSpouse),
          hasMinorChildren: Boolean(data.hasMinorChildren),
          f27ScoreAbove80: Boolean(data.f27ScoreAbove80),
          investmentAmount: Number(data.investmentAmount) || 0,
          healthInsuranceMonths: Number(data.healthInsuranceMonths) || 0,
          pensionMonths: Number(data.pensionMonths) || 0,
        };
        const result = evaluateF5Eligibility(input);
        return NextResponse.json({ success: true, visaType: 'F-5', ...result });
      }

      case 'F-6': {
        const input: F6Input = {
          hasKoreanSpouse: Boolean(data.hasKoreanSpouse),
          marriageRegistered: Boolean(data.marriageRegistered),
          cohabitationMonths: Number(data.cohabitationMonths) || 0,
          spouseAnnualIncome: Number(data.spouseAnnualIncome) || 0,
          combinedIncome: Number(data.combinedIncome) || 0,
          topikLevel: (Number(data.topikLevel) || 0) as F6Input['topikLevel'],
          hasBasicKorean: Boolean(data.hasBasicKorean),
          hasChildren: Boolean(data.hasChildren),
          childrenCount: Number(data.childrenCount) || 0,
          spouseHasNoCriminalRecord: data.spouseHasNoCriminalRecord !== false,
          applicantHasNoCriminalRecord: data.applicantHasNoCriminalRecord !== false,
          previousMarriageCount: Number(data.previousMarriageCount) || 0,
          ageGap: Number(data.ageGap) || 0,
          metInPerson: data.metInPerson !== false,
          spouseResidence: data.spouseResidence || '',
          subType: data.subType || 'F-6-1',
          hasMedicalCheckup: Boolean(data.hasMedicalCheckup),
          hasBackgroundCheck: Boolean(data.hasBackgroundCheck),
        };
        const result = evaluateF6Eligibility(input);
        return NextResponse.json({ success: true, visaType: 'F-6', ...result });
      }

      case 'D-2': {
        const input: D2Input = {
          subType: data.subType || 'D-2-2',
          hasAdmissionLetter: Boolean(data.hasAdmissionLetter),
          universityAccredited: data.universityAccredited !== false,
          financialProof: Number(data.financialProof) || 0,
          topikLevel: (Number(data.topikLevel) || 0) as D2Input['topikLevel'],
          previousEducation: data.previousEducation || 'highschool',
          gpa: Number(data.gpa) || 0,
          tuitionPaid: Boolean(data.tuitionPaid),
          hasScholarship: Boolean(data.hasScholarship),
          scholarshipPercent: Number(data.scholarshipPercent) || 0,
          previousVisaViolation: Boolean(data.previousVisaViolation),
          nationality: data.nationality || '',
          age: Number(data.age) || 20,
          hasHealthInsurance: Boolean(data.hasHealthInsurance),
        };
        const result = evaluateD2Eligibility(input);
        return NextResponse.json({ success: true, visaType: 'D-2', ...result });
      }

      case 'E-9': {
        const input: E9Input = {
          industry: data.industry || 'manufacturing',
          epsTestScore: Number(data.epsTestScore) || 0,
          epsTestPassed: Boolean(data.epsTestPassed),
          age: Number(data.age) || 25,
          hasHealthCheckup: Boolean(data.hasHealthCheckup),
          hasCriminalRecord: Boolean(data.hasCriminalRecord),
          previousKoreaStay: Boolean(data.previousKoreaStay),
          previousE9Holder: Boolean(data.previousE9Holder),
          reentryCount: Number(data.reentryCount) || 0,
          skillTestPassed: Boolean(data.skillTestPassed),
          nationality: data.nationality || '',
          hasEmployerMatch: Boolean(data.hasEmployerMatch),
        };
        const result = evaluateE9Eligibility(input);
        return NextResponse.json({ success: true, visaType: 'E-9', ...result });
      }

      case 'D-8': {
        const input: D8Input = {
          subType: data.subType || 'D-8-1',
          investmentAmount: Number(data.investmentAmount) || 0,
          businessType: data.businessType || '',
          hasBusinessPlan: Boolean(data.hasBusinessPlan),
          hasCompanyRegistration: Boolean(data.hasCompanyRegistration),
          expectedEmployees: Number(data.expectedEmployees) || 0,
          annualRevenue: Number(data.annualRevenue) || 0,
          education: data.education || 'bachelors',
          hasRelatedExperience: Boolean(data.hasRelatedExperience),
          experienceYears: Number(data.experienceYears) || 0,
          hasTechnologyPatent: Boolean(data.hasTechnologyPatent),
          hasVCFunding: Boolean(data.hasVCFunding),
          vcFundingAmount: Number(data.vcFundingAmount) || 0,
          previousVisaViolation: Boolean(data.previousVisaViolation),
          currentVisa: data.currentVisa || '',
          age: Number(data.age) || 30,
        };
        const result = evaluateD8Eligibility(input);
        return NextResponse.json({ success: true, visaType: 'D-8', ...result });
      }

      case 'pathway': {
        const result = getVisaPathways(data.currentVisa || '', data.targetVisa || 'F-5');
        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json(
          { success: false, error: `지원하지 않는 비자 유형: ${visaType}. 지원: F-2-7, E-7, D-10, F-5, F-6, D-2, E-9, D-8` },
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
    version: '2.0',
    reference: '법무부 출입국관리법 시행규칙 (2026년 기준)',
    supportedTypes: [
      { visaType: 'F-2-7', name: '점수제 거주 비자', passingScore: 80, maxScore: 120 },
      { visaType: 'E-7', name: '특정활동 비자', passingScore: 60, maxScore: 100 },
      { visaType: 'D-10', name: '구직 비자', description: '적격성 평가' },
      { visaType: 'F-5', name: '영주 비자', description: '경로별 적격성 평가' },
      { visaType: 'F-6', name: '결혼이민 비자', description: '적격성 + 심사 위험도' },
      { visaType: 'D-2', name: '유학 비자', description: '7개 하위 유형 지원' },
      { visaType: 'E-9', name: '비전문취업 비자', description: 'EPS 고용허가제' },
      { visaType: 'D-8', name: '기업투자 비자', description: '4개 하위 유형 지원' },
      { visaType: 'pathway', name: '비자 전환 경로', description: '현재→목표 비자 전환 안내' },
    ],
    usage: 'POST with { visaType: "F-2-7"|"E-7"|..., data: {...} }',
  });
}
