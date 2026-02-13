"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui";

type VisaTab = "F-2-7" | "E-7" | "D-10" | "F-5" | "F-6";

const VISA_TABS: { id: VisaTab; label: string; desc: string }[] = [
  { id: "F-2-7", label: "F-2-7 점수제 거주", desc: "120점 만점, 80점 합격" },
  { id: "E-7", label: "E-7 특정활동", desc: "100점 만점, 60점 적격" },
  { id: "D-10", label: "D-10 구직", desc: "적격성 평가" },
  { id: "F-5", label: "F-5 영주", desc: "경로별 적격성" },
  { id: "F-6", label: "F-6 결혼이민", desc: "적격성 + 심사 위험도" },
];

interface RequirementItem {
  item: string;
  met: boolean;
  note?: string;
}

interface ScoreBreakdown {
  category: string;
  item: string;
  score: number;
  maxScore: number;
  note?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VisaResult = Record<string, any>;

export default function VisaCalculatorPage() {
  const [activeTab, setActiveTab] = useState<VisaTab>("F-2-7");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VisaResult | null>(null);
  const [error, setError] = useState("");

  // F-2-7
  const [f27, setF27] = useState({
    age: 30, annualIncome: 3000, education: "bachelors", koreanDegree: false,
    topikLevel: 0, kiipLevel: 0, workExperienceYears: 0, hasKoreanSpouse: false,
    hasMinorChild: false, volunteerHours: 0, taxPaymentYears: 0, hasSpecialMerit: false,
  });

  // E-7
  const [e7, setE7] = useState({
    education: "bachelors", fieldMatchesDegree: false, workExperienceYears: 0,
    annualSalary: 3000, companySize: "small", hasNationalCert: false,
    occupationCode: "", isInnopolisCompany: false, koreanLanguage: "none",
  });

  // D-10
  const [d10, setD10] = useState({
    education: "bachelors", graduatedFromKorea: true, graduationWithinYear: true,
    topikLevel: 0, hasInternExperience: false, fieldOfStudy: "",
    hasJobOffer: false, currentVisa: "D-2", previousVisaViolation: false, annualIncome: 1500,
  });

  // F-5
  const [f5, setF5] = useState({
    currentVisa: "F-2-7", stayYears: 5, age: 35, annualIncome: 5000,
    realEstateValue: 0, totalAssets: 10000, education: "bachelors",
    topikLevel: 4, kiipCompleted: false, hasCriminalRecord: false,
    taxPaymentYears: 3, hasKoreanSpouse: false, hasMinorChildren: false,
    f27ScoreAbove80: false, investmentAmount: 0,
  });

  // F-6
  const [f6, setF6] = useState({
    hasKoreanSpouse: true, marriageRegistered: true, cohabitationMonths: 6,
    spouseAnnualIncome: 4000, combinedIncome: 5000, topikLevel: 0,
    hasBasicKorean: true, hasChildren: false, spouseHasNoCriminalRecord: true,
    applicantHasNoCriminalRecord: true, previousMarriageCount: 0,
    ageGap: 3, metInPerson: true, spouseResidence: "", subType: "F-6-1",
  });

  const handleCalculate = async () => {
    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const dataMap: Record<VisaTab, unknown> = {
        "F-2-7": f27, "E-7": e7, "D-10": d10, "F-5": f5, "F-6": f6,
      };

      const res = await fetch("/api/analytics/visa-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visaType: activeTab, data: dataMap[activeTab] }),
      });

      if (!res.ok) throw new Error("API 요청 실패");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "계산 실패");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">비자AI</h1>
        <p className="text-gray-500 mt-1">
          출입국 비자 적격성 평가 및 점수 분석 - 5개 비자 유형 지원
        </p>
      </div>

      {/* 탭 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {VISA_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setResult(null); setError(""); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 현재 탭 설명 */}
      <div className="mb-4 px-4 py-2 bg-indigo-50 rounded-lg">
        <p className="text-sm text-indigo-700">
          {VISA_TABS.find(t => t.id === activeTab)?.desc}
        </p>
      </div>

      {/* 입력 폼 */}
      <Card>
        <CardContent className="p-6">
          {activeTab === "F-2-7" && <F27Form data={f27} onChange={setF27} />}
          {activeTab === "E-7" && <E7Form data={e7} onChange={setE7} />}
          {activeTab === "D-10" && <D10Form data={d10} onChange={setD10} />}
          {activeTab === "F-5" && <F5Form data={f5} onChange={setF5} />}
          {activeTab === "F-6" && <F6Form data={f6} onChange={setF6} />}

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <button
            onClick={handleCalculate}
            disabled={isLoading}
            className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                분석 중...
              </span>
            ) : (
              activeTab === "F-2-7" || activeTab === "E-7" ? "점수 계산하기" : "적격성 평가하기"
            )}
          </button>
        </CardContent>
      </Card>

      {/* 결과 */}
      {result && <ResultSection result={result} visaType={activeTab} />}

      {/* 면책조항 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-500">
          본 분석 결과는 참고용이며, 실제 비자 심사 결과와 다를 수 있습니다.
          정확한 안내는 관할 출입국관리사무소 또는 전문 행정사에게 상담하세요.
          법무부 출입국관리법 시행규칙 기준 (2024년).
        </p>
      </div>
    </div>
  );
}

/* ─── F-2-7 입력 폼 ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function F27Form({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">F-2-7 점수제 거주비자</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <FormField label="만 나이">
          <input type="number" value={data.age} onChange={(e) => set("age", Number(e.target.value))} className={inputCls} min={18} max={65} />
        </FormField>
        <FormField label="학력">
          <select value={data.education} onChange={(e) => set("education", e.target.value)} className={inputCls}>
            <option value="doctorate">박사</option>
            <option value="masters">석사</option>
            <option value="bachelors">학사</option>
            <option value="associate">전문학사</option>
            <option value="highschool">고졸</option>
            <option value="below">고졸 미만</option>
          </select>
        </FormField>
        <FormField label="연간 소득 (만원)">
          <input type="number" value={data.annualIncome} onChange={(e) => set("annualIncome", Number(e.target.value))} className={inputCls} min={0} step={100} />
        </FormField>
        <FormField label="TOPIK 급수">
          <select value={data.topikLevel} onChange={(e) => set("topikLevel", Number(e.target.value))} className={inputCls}>
            {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n === 0 ? "없음" : `${n}급`}</option>)}
          </select>
        </FormField>
        <FormField label="사회통합프로그램 단계">
          <select value={data.kiipLevel} onChange={(e) => set("kiipLevel", Number(e.target.value))} className={inputCls}>
            {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? "미이수" : `${n}단계`}</option>)}
          </select>
        </FormField>
        <FormField label="한국 내 근무경력 (년)">
          <input type="number" value={data.workExperienceYears} onChange={(e) => set("workExperienceYears", Number(e.target.value))} className={inputCls} min={0} />
        </FormField>
        <FormField label="봉사활동 시간">
          <input type="number" value={data.volunteerHours} onChange={(e) => set("volunteerHours", Number(e.target.value))} className={inputCls} min={0} />
        </FormField>
        <FormField label="납세 실적 (년)">
          <input type="number" value={data.taxPaymentYears} onChange={(e) => set("taxPaymentYears", Number(e.target.value))} className={inputCls} min={0} />
        </FormField>
      </div>
      <div className="grid md:grid-cols-2 gap-3 pt-2">
        <CheckboxField label="한국 대학 학위" checked={data.koreanDegree} onChange={(v) => set("koreanDegree", v)} />
        <CheckboxField label="한국인 배우자" checked={data.hasKoreanSpouse} onChange={(v) => set("hasKoreanSpouse", v)} />
        <CheckboxField label="한국 출생 미성년 자녀" checked={data.hasMinorChild} onChange={(v) => set("hasMinorChild", v)} />
        <CheckboxField label="특별공로 (정부표창 등)" checked={data.hasSpecialMerit} onChange={(v) => set("hasSpecialMerit", v)} />
      </div>
    </div>
  );
}

/* ─── E-7 입력 폼 ─── */
function E7Form({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">E-7 특정활동비자</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <FormField label="최종 학력">
          <select value={data.education} onChange={(e) => set("education", e.target.value)} className={inputCls}>
            <option value="doctorate">박사</option>
            <option value="masters">석사</option>
            <option value="bachelors">학사</option>
            <option value="associate">전문학사</option>
            <option value="highschool">고졸</option>
          </select>
        </FormField>
        <FormField label="관련 경력 (년)">
          <input type="number" value={data.workExperienceYears} onChange={(e) => set("workExperienceYears", Number(e.target.value))} className={inputCls} min={0} />
        </FormField>
        <FormField label="연봉 (만원)">
          <input type="number" value={data.annualSalary} onChange={(e) => set("annualSalary", Number(e.target.value))} className={inputCls} min={0} step={100} />
        </FormField>
        <FormField label="고용 기업 규모">
          <select value={data.companySize} onChange={(e) => set("companySize", e.target.value)} className={inputCls}>
            <option value="large">대기업</option>
            <option value="medium">중견기업</option>
            <option value="small">중소기업</option>
            <option value="startup">스타트업</option>
          </select>
        </FormField>
        <FormField label="한국어 능력">
          <select value={data.koreanLanguage} onChange={(e) => set("koreanLanguage", e.target.value)} className={inputCls}>
            <option value="none">없음</option>
            <option value="topik2">TOPIK 2급</option>
            <option value="topik3+">TOPIK 3급 이상</option>
            <option value="kiip3+">사회통합 3단계 이상</option>
          </select>
        </FormField>
        <FormField label="직업분류코드 (선택)">
          <input type="text" value={data.occupationCode} onChange={(e) => set("occupationCode", e.target.value)} placeholder="예: E-7-1" className={inputCls} />
        </FormField>
      </div>
      <div className="grid md:grid-cols-2 gap-3 pt-2">
        <CheckboxField label="전공-직종 일치" checked={data.fieldMatchesDegree} onChange={(v) => set("fieldMatchesDegree", v)} />
        <CheckboxField label="국가기술자격증 보유" checked={data.hasNationalCert} onChange={(v) => set("hasNationalCert", v)} />
        <CheckboxField label="이노폴리스 입주기업" checked={data.isInnopolisCompany} onChange={(v) => set("isInnopolisCompany", v)} />
      </div>
    </div>
  );
}

/* ─── D-10 입력 폼 ─── */
function D10Form({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">D-10 구직비자</h3>
      <p className="text-sm text-gray-500">한국에서 구직 활동을 위한 체류자격</p>
      <div className="grid md:grid-cols-2 gap-4">
        <FormField label="최종 학력">
          <select value={data.education} onChange={(e) => set("education", e.target.value)} className={inputCls}>
            <option value="doctorate">박사</option>
            <option value="masters">석사</option>
            <option value="bachelors">학사</option>
            <option value="associate">전문학사</option>
            <option value="highschool">고졸</option>
          </select>
        </FormField>
        <FormField label="TOPIK 급수">
          <select value={data.topikLevel} onChange={(e) => set("topikLevel", Number(e.target.value))} className={inputCls}>
            {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n === 0 ? "없음" : `${n}급`}</option>)}
          </select>
        </FormField>
        <FormField label="전공 분야">
          <input type="text" value={data.fieldOfStudy} onChange={(e) => set("fieldOfStudy", e.target.value)} placeholder="예: 컴퓨터공학, 경영학" className={inputCls} />
        </FormField>
        <FormField label="현재 비자">
          <select value={data.currentVisa} onChange={(e) => set("currentVisa", e.target.value)} className={inputCls}>
            <option value="D-2">D-2 (유학)</option>
            <option value="D-2-1">D-2-1 (전문학사)</option>
            <option value="D-2-2">D-2-2 (학사)</option>
            <option value="D-2-3">D-2-3 (석사)</option>
            <option value="D-2-4">D-2-4 (박사)</option>
            <option value="E-7">E-7 (특정활동)</option>
            <option value="E-9">E-9 (비전문취업)</option>
            <option value="">기타</option>
          </select>
        </FormField>
        <FormField label="체류비용 증명 (만원)">
          <input type="number" value={data.annualIncome} onChange={(e) => set("annualIncome", Number(e.target.value))} className={inputCls} min={0} step={100} />
        </FormField>
      </div>
      <div className="grid md:grid-cols-2 gap-3 pt-2">
        <CheckboxField label="한국 대학 졸업" checked={data.graduatedFromKorea} onChange={(v) => set("graduatedFromKorea", v)} />
        <CheckboxField label="졸업 후 1년 이내" checked={data.graduationWithinYear} onChange={(v) => set("graduationWithinYear", v)} />
        <CheckboxField label="한국 내 인턴/연수 경험" checked={data.hasInternExperience} onChange={(v) => set("hasInternExperience", v)} />
        <CheckboxField label="구직 활동 증빙 (초청장/추천서)" checked={data.hasJobOffer} onChange={(v) => set("hasJobOffer", v)} />
        <CheckboxField label="비자 위반 이력" checked={data.previousVisaViolation} onChange={(v) => set("previousVisaViolation", v)} />
      </div>
    </div>
  );
}

/* ─── F-5 입력 폼 ─── */
function F5Form({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">F-5 영주비자</h3>
      <p className="text-sm text-gray-500">대한민국 영주권 취득 자격 평가</p>
      <div className="grid md:grid-cols-2 gap-4">
        <FormField label="현재 비자">
          <select value={data.currentVisa} onChange={(e) => set("currentVisa", e.target.value)} className={inputCls}>
            <option value="F-2-7">F-2-7 (점수제 거주)</option>
            <option value="F-2">F-2 (거주)</option>
            <option value="E-7">E-7 (특정활동)</option>
            <option value="D-8">D-8 (투자)</option>
            <option value="F-6">F-6 (결혼이민)</option>
            <option value="">기타</option>
          </select>
        </FormField>
        <FormField label="한국 체류 기간 (년)">
          <input type="number" value={data.stayYears} onChange={(e) => set("stayYears", Number(e.target.value))} className={inputCls} min={0} />
        </FormField>
        <FormField label="만 나이">
          <input type="number" value={data.age} onChange={(e) => set("age", Number(e.target.value))} className={inputCls} min={19} max={80} />
        </FormField>
        <FormField label="연간 소득 (만원)">
          <input type="number" value={data.annualIncome} onChange={(e) => set("annualIncome", Number(e.target.value))} className={inputCls} min={0} step={100} />
        </FormField>
        <FormField label="학력">
          <select value={data.education} onChange={(e) => set("education", e.target.value)} className={inputCls}>
            <option value="doctorate">박사</option>
            <option value="masters">석사</option>
            <option value="bachelors">학사</option>
            <option value="associate">전문학사</option>
            <option value="highschool">고졸</option>
            <option value="below">고졸 미만</option>
          </select>
        </FormField>
        <FormField label="TOPIK 급수">
          <select value={data.topikLevel} onChange={(e) => set("topikLevel", Number(e.target.value))} className={inputCls}>
            {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n === 0 ? "없음" : `${n}급`}</option>)}
          </select>
        </FormField>
        <FormField label="총 자산 (만원)">
          <input type="number" value={data.totalAssets} onChange={(e) => set("totalAssets", Number(e.target.value))} className={inputCls} min={0} step={1000} />
        </FormField>
        <FormField label="부동산 자산 (만원)">
          <input type="number" value={data.realEstateValue} onChange={(e) => set("realEstateValue", Number(e.target.value))} className={inputCls} min={0} step={1000} />
        </FormField>
        <FormField label="납세 실적 (년)">
          <input type="number" value={data.taxPaymentYears} onChange={(e) => set("taxPaymentYears", Number(e.target.value))} className={inputCls} min={0} />
        </FormField>
        <FormField label="투자 금액 (만원, 해당시)">
          <input type="number" value={data.investmentAmount} onChange={(e) => set("investmentAmount", Number(e.target.value))} className={inputCls} min={0} step={10000} />
        </FormField>
      </div>
      <div className="grid md:grid-cols-2 gap-3 pt-2">
        <CheckboxField label="사회통합프로그램 5단계 이수" checked={data.kiipCompleted} onChange={(v) => set("kiipCompleted", v)} />
        <CheckboxField label="한국인 배우자" checked={data.hasKoreanSpouse} onChange={(v) => set("hasKoreanSpouse", v)} />
        <CheckboxField label="미성년 자녀" checked={data.hasMinorChildren} onChange={(v) => set("hasMinorChildren", v)} />
        <CheckboxField label="F-2-7 점수 80점 이상" checked={data.f27ScoreAbove80} onChange={(v) => set("f27ScoreAbove80", v)} />
        <CheckboxField label="범죄 이력" checked={data.hasCriminalRecord} onChange={(v) => set("hasCriminalRecord", v)} />
      </div>
    </div>
  );
}

/* ─── F-6 입력 폼 ─── */
function F6Form({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">F-6 결혼이민비자</h3>
      <p className="text-sm text-gray-500">한국인 배우자와의 결혼을 통한 체류자격</p>

      <FormField label="비자 하위 유형">
        <select value={data.subType} onChange={(e) => set("subType", e.target.value)} className={inputCls}>
          <option value="F-6-1">F-6-1 국민의 배우자</option>
          <option value="F-6-2">F-6-2 미성년 자녀 양육</option>
          <option value="F-6-3">F-6-3 혼인파탄 (귀책 없음)</option>
        </select>
      </FormField>

      <div className="grid md:grid-cols-2 gap-4">
        <FormField label="동거 기간 (개월)">
          <input type="number" value={data.cohabitationMonths} onChange={(e) => set("cohabitationMonths", Number(e.target.value))} className={inputCls} min={0} />
        </FormField>
        <FormField label="배우자(초청인) 연소득 (만원)">
          <input type="number" value={data.spouseAnnualIncome} onChange={(e) => set("spouseAnnualIncome", Number(e.target.value))} className={inputCls} min={0} step={100} />
        </FormField>
        <FormField label="부부 합산 소득 (만원)">
          <input type="number" value={data.combinedIncome} onChange={(e) => set("combinedIncome", Number(e.target.value))} className={inputCls} min={0} step={100} />
        </FormField>
        <FormField label="TOPIK 급수">
          <select value={data.topikLevel} onChange={(e) => set("topikLevel", Number(e.target.value))} className={inputCls}>
            {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n === 0 ? "없음" : `${n}급`}</option>)}
          </select>
        </FormField>
        <FormField label="이전 결혼 횟수">
          <input type="number" value={data.previousMarriageCount} onChange={(e) => set("previousMarriageCount", Number(e.target.value))} className={inputCls} min={0} />
        </FormField>
        <FormField label="나이 차이 (세)">
          <input type="number" value={data.ageGap} onChange={(e) => set("ageGap", Number(e.target.value))} className={inputCls} min={0} />
        </FormField>
      </div>
      <div className="grid md:grid-cols-2 gap-3 pt-2">
        <CheckboxField label="한국인 배우자" checked={data.hasKoreanSpouse} onChange={(v) => set("hasKoreanSpouse", v)} />
        <CheckboxField label="혼인신고 완료" checked={data.marriageRegistered} onChange={(v) => set("marriageRegistered", v)} />
        <CheckboxField label="기초 한국어 소통 가능" checked={data.hasBasicKorean} onChange={(v) => set("hasBasicKorean", v)} />
        <CheckboxField label="자녀 있음" checked={data.hasChildren} onChange={(v) => set("hasChildren", v)} />
        <CheckboxField label="배우자 범죄 이력 없음" checked={data.spouseHasNoCriminalRecord} onChange={(v) => set("spouseHasNoCriminalRecord", v)} />
        <CheckboxField label="신청인 범죄 이력 없음" checked={data.applicantHasNoCriminalRecord} onChange={(v) => set("applicantHasNoCriminalRecord", v)} />
        <CheckboxField label="직접 만남 (중개업체 아닌 경우)" checked={data.metInPerson} onChange={(v) => set("metInPerson", v)} />
      </div>
    </div>
  );
}

/* ─── 결과 섹션 ─── */
function ResultSection({ result, visaType }: { result: VisaResult; visaType: VisaTab }) {
  const hasScore = visaType === "F-2-7" || visaType === "E-7";

  return (
    <div className="mt-6 space-y-4">
      {/* 점수 요약 (F-2-7, E-7) */}
      {hasScore && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">{result.visaType} 점수 결과</h3>
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                result.isPassing ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {result.isPassing ? "합격 예상" : "기준 미달"}
              </span>
            </div>
            <div className="mb-2 flex justify-between text-sm text-gray-600">
              <span>0점</span>
              <span className="font-bold text-lg">{result.totalScore}점 / {result.passingScore}점</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${result.isPassing ? "bg-green-500" : "bg-red-400"}`}
                style={{ width: `${Math.min(100, (result.totalScore / (result.passingScore * 1.5)) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 적격성 요약 (D-10, F-5, F-6) */}
      {!hasScore && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">{result.visaType} 적격성 평가</h3>
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                result.eligible ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {result.eligible ? "신청 가능" : "요건 미충족"}
              </span>
            </div>
            {result.eligibilityScore !== undefined && (
              <div className="mb-2">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>적격성 점수</span>
                  <span className="font-bold">{result.eligibilityScore}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      result.eligibilityScore >= 70 ? "bg-green-500" : result.eligibilityScore >= 50 ? "bg-yellow-500" : "bg-red-400"
                    }`}
                    style={{ width: `${result.eligibilityScore}%` }}
                  />
                </div>
              </div>
            )}
            {result.eligibilityType && (
              <p className="text-sm text-gray-600 mt-2">경로: <strong>{result.eligibilityType}</strong></p>
            )}
            {result.subType && (
              <p className="text-sm text-gray-600 mt-1">유형: <strong>{result.subType}</strong></p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 항목별 점수/요건 */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {hasScore ? "항목별 점수" : "요건 충족 현황"}
          </h3>
          <div className="space-y-3">
            {hasScore && result.breakdown?.map((b: ScoreBreakdown, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{b.item}</span>
                    {b.note && <span className="text-xs text-gray-400">({b.note})</span>}
                  </div>
                  <div className="mt-1 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="ml-4 text-sm font-bold text-gray-800 w-16 text-right">{b.score}/{b.maxScore}</span>
              </div>
            ))}
            {!hasScore && result.requirements?.map((r: RequirementItem, i: number) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className={`mt-0.5 text-lg ${r.met ? "text-green-500" : "text-red-400"}`}>
                  {r.met ? "\u2713" : "\u2717"}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{r.item}</p>
                  {r.note && <p className="text-xs text-gray-500 mt-0.5">{r.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 경고 */}
      {result.warnings && result.warnings.length > 0 && (
        <Card>
          <CardContent className="p-6 bg-yellow-50">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">주의사항</h3>
            <ul className="space-y-1">
              {result.warnings.map((w: string, i: number) => (
                <li key={i} className="text-sm text-yellow-700 flex gap-2">
                  <span>&#9888;</span>{w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 추천 */}
      <Card>
        <CardContent className="p-6 bg-indigo-50">
          <h3 className="text-sm font-semibold text-indigo-800 mb-2">분석 결과</h3>
          <p className="text-sm text-indigo-700">{result.recommendation}</p>
          {result.estimatedProcessing && (
            <p className="text-xs text-indigo-600 mt-2">예상 심사 기간: {result.estimatedProcessing}</p>
          )}
          {result.interviewLikelihood && (
            <p className="text-xs text-indigo-600 mt-1">면접 가능성: {result.interviewLikelihood}</p>
          )}
        </CardContent>
      </Card>

      {/* 필요서류 */}
      {result.requiredDocuments && result.requiredDocuments.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">필요 서류</h3>
            <ul className="grid md:grid-cols-2 gap-2">
              {result.requiredDocuments.map((doc: string, i: number) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-indigo-500">&#10003;</span>{doc}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── 공통 컴포넌트 ─── */
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
