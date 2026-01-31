"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui";

interface ScoreBreakdown {
  category: string;
  item: string;
  score: number;
  maxScore: number;
  note?: string;
}

interface VisaResult {
  success: boolean;
  visaType: string;
  totalScore: number;
  passingScore: number;
  isPassing: boolean;
  breakdown: ScoreBreakdown[];
  recommendation: string;
  requiredDocuments?: string[];
  warnings?: string[];
}

export default function VisaCalculatorPage() {
  const [activeTab, setActiveTab] = useState<"F-2-7" | "E-7">("F-2-7");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VisaResult | null>(null);
  const [error, setError] = useState("");

  // F-2-7 폼 상태
  const [f27, setF27] = useState({
    age: 30,
    annualIncome: 3000,
    education: "bachelors",
    koreanDegree: false,
    topikLevel: 0,
    kiipLevel: 0,
    workExperienceYears: 0,
    hasKoreanSpouse: false,
    hasMinorChild: false,
    volunteerHours: 0,
    taxPaymentYears: 0,
    hasSpecialMerit: false,
  });

  // E-7 폼 상태
  const [e7, setE7] = useState({
    education: "bachelors",
    fieldMatchesDegree: false,
    workExperienceYears: 0,
    annualSalary: 3000,
    companySize: "small",
    hasNationalCert: false,
    occupationCode: "",
    isInnopolisCompany: false,
    koreanLanguage: "none",
  });

  const handleCalculate = async () => {
    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const body =
        activeTab === "F-2-7"
          ? { visaType: "F-2-7", data: f27 }
          : { visaType: "E-7", data: e7 };

      const res = await fetch("/api/analytics/visa-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("API 요청 실패");

      const data: VisaResult = await res.json();
      if (!data.success) throw new Error("계산 실패");
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
        <h1 className="text-2xl font-bold text-gray-900">비자 점수 계산기</h1>
        <p className="text-gray-500 mt-1">
          F-2-7 점수제 거주비자, E-7 특정활동비자 점수를 미리 계산해보세요.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        {(["F-2-7", "E-7"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setResult(null);
              setError("");
            }}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab === "F-2-7" ? "F-2-7 점수제 거주" : "E-7 특정활동"}
          </button>
        ))}
      </div>

      {/* 입력 폼 */}
      <Card>
        <CardContent className="p-6">
          {activeTab === "F-2-7" ? (
            <F27Form data={f27 as Record<string, unknown>} onChange={(d) => setF27(d as typeof f27)} />
          ) : (
            <E7Form data={e7 as Record<string, unknown>} onChange={(d) => setE7(d as typeof e7)} />
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
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
                계산 중...
              </span>
            ) : (
              "점수 계산하기"
            )}
          </button>
        </CardContent>
      </Card>

      {/* 결과 */}
      {result && <ResultSection result={result} />}
    </div>
  );
}

/* ─── F-2-7 입력 폼 ─── */
function F27Form({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  const d = data;
  const set = (key: string, val: unknown) => onChange({ ...d, [key]: val });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">F-2-7 점수제 거주비자</h3>
      <p className="text-sm text-gray-500">총 120점 만점, 80점 이상 합격</p>

      <div className="grid md:grid-cols-2 gap-4">
        <FormField label="만 나이">
          <input
            type="number"
            value={d.age as number}
            onChange={(e) => set("age", Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            min={18}
            max={65}
          />
        </FormField>

        <FormField label="학력">
          <select
            value={d.education as string}
            onChange={(e) => set("education", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="doctorate">박사</option>
            <option value="masters">석사</option>
            <option value="bachelors">학사</option>
            <option value="associate">전문학사</option>
            <option value="highschool">고졸</option>
            <option value="below">고졸 미만</option>
          </select>
        </FormField>

        <FormField label="연간 소득 (만원)">
          <input
            type="number"
            value={d.annualIncome as number}
            onChange={(e) => set("annualIncome", Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            min={0}
            step={100}
          />
        </FormField>

        <FormField label="TOPIK 급수">
          <select
            value={d.topikLevel as number}
            onChange={(e) => set("topikLevel", Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "없음" : `${n}급`}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="사회통합프로그램 단계">
          <select
            value={d.kiipLevel as number}
            onChange={(e) => set("kiipLevel", Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "미이수" : `${n}단계`}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="한국 내 근무경력 (년)">
          <input
            type="number"
            value={d.workExperienceYears as number}
            onChange={(e) => set("workExperienceYears", Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            min={0}
          />
        </FormField>

        <FormField label="봉사활동 시간">
          <input
            type="number"
            value={d.volunteerHours as number}
            onChange={(e) => set("volunteerHours", Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            min={0}
          />
        </FormField>

        <FormField label="납세 실적 (년)">
          <input
            type="number"
            value={d.taxPaymentYears as number}
            onChange={(e) => set("taxPaymentYears", Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            min={0}
          />
        </FormField>
      </div>

      <div className="grid md:grid-cols-2 gap-3 pt-2">
        <CheckboxField
          label="한국 대학 학위"
          checked={d.koreanDegree as boolean}
          onChange={(v) => set("koreanDegree", v)}
        />
        <CheckboxField
          label="한국인 배우자"
          checked={d.hasKoreanSpouse as boolean}
          onChange={(v) => set("hasKoreanSpouse", v)}
        />
        <CheckboxField
          label="한국 출생 미성년 자녀"
          checked={d.hasMinorChild as boolean}
          onChange={(v) => set("hasMinorChild", v)}
        />
        <CheckboxField
          label="특별공로 (정부표창 등)"
          checked={d.hasSpecialMerit as boolean}
          onChange={(v) => set("hasSpecialMerit", v)}
        />
      </div>
    </div>
  );
}

/* ─── E-7 입력 폼 ─── */
function E7Form({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  const d = data;
  const set = (key: string, val: unknown) => onChange({ ...d, [key]: val });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">E-7 특정활동비자</h3>
      <p className="text-sm text-gray-500">총 100점 만점, 60점 이상 적격</p>

      <div className="grid md:grid-cols-2 gap-4">
        <FormField label="최종 학력">
          <select
            value={d.education as string}
            onChange={(e) => set("education", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="doctorate">박사</option>
            <option value="masters">석사</option>
            <option value="bachelors">학사</option>
            <option value="associate">전문학사</option>
            <option value="highschool">고졸</option>
          </select>
        </FormField>

        <FormField label="관련 경력 (년)">
          <input
            type="number"
            value={d.workExperienceYears as number}
            onChange={(e) => set("workExperienceYears", Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            min={0}
          />
        </FormField>

        <FormField label="연봉 (만원)">
          <input
            type="number"
            value={d.annualSalary as number}
            onChange={(e) => set("annualSalary", Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            min={0}
            step={100}
          />
        </FormField>

        <FormField label="고용 기업 규모">
          <select
            value={d.companySize as string}
            onChange={(e) => set("companySize", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="large">대기업</option>
            <option value="medium">중견기업</option>
            <option value="small">중소기업</option>
            <option value="startup">스타트업</option>
          </select>
        </FormField>

        <FormField label="한국어 능력">
          <select
            value={d.koreanLanguage as string}
            onChange={(e) => set("koreanLanguage", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="none">없음</option>
            <option value="topik2">TOPIK 2급</option>
            <option value="topik3+">TOPIK 3급 이상</option>
            <option value="kiip3+">사회통합 3단계 이상</option>
          </select>
        </FormField>

        <FormField label="직업분류코드 (선택)">
          <input
            type="text"
            value={d.occupationCode as string}
            onChange={(e) => set("occupationCode", e.target.value)}
            placeholder="예: E-7-1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </FormField>
      </div>

      <div className="grid md:grid-cols-2 gap-3 pt-2">
        <CheckboxField
          label="전공-직종 일치"
          checked={d.fieldMatchesDegree as boolean}
          onChange={(v) => set("fieldMatchesDegree", v)}
        />
        <CheckboxField
          label="국가기술자격증 보유"
          checked={d.hasNationalCert as boolean}
          onChange={(v) => set("hasNationalCert", v)}
        />
        <CheckboxField
          label="이노폴리스 입주기업"
          checked={d.isInnopolisCompany as boolean}
          onChange={(v) => set("isInnopolisCompany", v)}
        />
      </div>
    </div>
  );
}

/* ─── 결과 섹션 ─── */
function ResultSection({ result }: { result: VisaResult }) {
  const pct = Math.min(100, (result.totalScore / (result.passingScore * 1.5)) * 100);

  return (
    <div className="mt-6 space-y-4">
      {/* 점수 요약 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {result.visaType} 점수 결과
            </h3>
            <span
              className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                result.isPassing
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {result.isPassing ? "합격 예상" : "기준 미달"}
            </span>
          </div>

          {/* 점수 바 */}
          <div className="mb-2 flex justify-between text-sm text-gray-600">
            <span>0점</span>
            <span className="font-bold text-lg">
              {result.totalScore}점 / {result.passingScore}점
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                result.isPassing ? "bg-green-500" : "bg-red-400"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div
            className="relative h-0"
            style={{ left: `${(result.passingScore / (result.passingScore * 1.5)) * 100}%` }}
          >
            <div className="absolute -top-4 w-0.5 h-4 bg-gray-800" />
            <span className="absolute -top-7 -translate-x-1/2 text-xs text-gray-600">
              합격선
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 항목별 점수 */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">항목별 점수</h3>
          <div className="space-y-3">
            {result.breakdown.map((b, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{b.item}</span>
                    {b.note && (
                      <span className="text-xs text-gray-400">({b.note})</span>
                    )}
                  </div>
                  <div className="mt-1 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{
                        width: `${b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="ml-4 text-sm font-bold text-gray-800 w-16 text-right">
                  {b.score}/{b.maxScore}
                </span>
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
              {result.warnings.map((w, i) => (
                <li key={i} className="text-sm text-yellow-700 flex gap-2">
                  <span>&#9888;</span>
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 추천 */}
      <Card>
        <CardContent className="p-6 bg-indigo-50">
          <h3 className="text-sm font-semibold text-indigo-800 mb-2">추천사항</h3>
          <p className="text-sm text-indigo-700">{result.recommendation}</p>
        </CardContent>
      </Card>

      {/* 필요서류 */}
      {result.requiredDocuments && result.requiredDocuments.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">필요 서류</h3>
            <ul className="grid md:grid-cols-2 gap-2">
              {result.requiredDocuments.map((doc, i) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-indigo-500">&#10003;</span>
                  {doc}
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
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
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
