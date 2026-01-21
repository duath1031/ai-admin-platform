'use client';

// =============================================================================
// New Civil Service Submission Page
// 새 민원 접수 페이지 - UI/UX 개선 버전
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SignaturePad from '@/components/civil-service/SignaturePad';

type TargetSite = 'gov24' | 'hometax' | 'wetax' | 'minwon';

interface ApplicationField {
  fieldId: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'radio' | 'file';
  value: string | boolean;
  required: boolean;
  selector?: string;
}

const STEP_INFO = [
  { step: 1, title: '민원 선택', desc: '신청할 민원 서비스 선택', icon: '📋' },
  { step: 2, title: '정보 입력', desc: '신청서 항목 입력', icon: '✏️' },
  { step: 3, title: '위임장 작성', desc: '전자서명 및 최종 확인', icon: '📝' },
];

const POPULAR_SERVICES = [
  { name: '주민등록등본 발급', site: 'gov24', code: 'MINWON_010', desc: '가족관계 포함 주소지 증명', icon: '🏠', credits: 50 },
  { name: '주민등록초본 발급', site: 'gov24', code: 'MINWON_011', desc: '개인 주소 이력 확인', icon: '📄', credits: 50 },
  { name: '가족관계증명서 발급', site: 'gov24', code: 'MINWON_020', desc: '가족 구성원 증명', icon: '👨‍👩‍👧‍👦', credits: 50 },
  { name: '기본증명서 발급', site: 'gov24', code: 'MINWON_021', desc: '출생/사망 등 기본 신분 사항', icon: '📋', credits: 50 },
  { name: '납세증명서 발급', site: 'hometax', code: 'TAX_001', desc: '국세 완납 증명', icon: '💰', credits: 70 },
  { name: '사업자등록증명원 발급', site: 'hometax', code: 'TAX_002', desc: '사업자 등록 현황 증명', icon: '🏢', credits: 70 },
  { name: '지방세 완납증명서', site: 'wetax', code: 'LOCAL_001', desc: '지방세 납부 완료 증명', icon: '🏛️', credits: 70 },
];

const SITE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  gov24: { label: '정부24', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: '🏛️' },
  hometax: { label: '홈택스', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: '💰' },
  wetax: { label: '위택스', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', icon: '🏠' },
  minwon: { label: '민원24', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200', icon: '📋' },
};

export default function NewCivilServicePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [serviceName, setServiceName] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [targetSite, setTargetSite] = useState<TargetSite>('gov24');
  const [applicantName, setApplicantName] = useState('');
  const [applicantBirth, setApplicantBirth] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicationFields, setApplicationFields] = useState<ApplicationField[]>([
    { fieldId: 'purpose', fieldName: '용도', fieldType: 'text', value: '', required: true },
    { fieldId: 'quantity', fieldName: '발급 부수', fieldType: 'number', value: '1', required: true },
  ]);

  // POA state
  const [needsPOA, setNeedsPOA] = useState(true);
  const [delegatorName, setDelegatorName] = useState('');
  const [delegatorBirth, setDelegatorBirth] = useState('');
  const [delegatorPhone, setDelegatorPhone] = useState('');
  const [delegatorIdNumber, setDelegatorIdNumber] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const selectService = (service: typeof POPULAR_SERVICES[0]) => {
    setServiceName(service.name);
    setServiceCode(service.code);
    setTargetSite(service.site as TargetSite);
  };

  const addField = () => {
    const newField: ApplicationField = {
      fieldId: `field_${Date.now()}`,
      fieldName: '',
      fieldType: 'text',
      value: '',
      required: false,
    };
    setApplicationFields([...applicationFields, newField]);
  };

  const updateField = (index: number, updates: Partial<ApplicationField>) => {
    const newFields = [...applicationFields];
    newFields[index] = { ...newFields[index], ...updates };
    setApplicationFields(newFields);
  };

  const removeField = (index: number) => {
    setApplicationFields(applicationFields.filter((_, i) => i !== index));
  };

  const canProceedStep1 = serviceName.trim() !== '';
  const canProceedStep2 = needsPOA || applicantName.trim() !== '';
  const canProceedStep3 = needsPOA
    ? signatureData && delegatorName && delegatorIdNumber && agreedToTerms
    : agreedToTerms;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create POA first if needed
      let powerOfAttorneyId: string | undefined;

      if (needsPOA && signatureData) {
        const poaRes = await fetch('/api/poa/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delegator: {
              name: delegatorName,
              birthDate: delegatorBirth,
              phone: delegatorPhone,
              idNumber: delegatorIdNumber,
            },
            scope: {
              serviceType: targetSite,
              serviceName: serviceName,
              serviceCode: serviceCode,
              purposes: ['대리 발급', '대리 신청'],
            },
            signature: {
              imageData: signatureData,
              timestamp: new Date().toISOString(),
            },
            validityDays: 30,
          }),
        });

        const poaData = await poaRes.json();
        if (!poaData.success) {
          throw new Error(poaData.error || '위임장 생성 실패');
        }
        powerOfAttorneyId = poaData.data.id;
      }

      // Create submission
      const res = await fetch('/api/rpa/civil-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName,
          serviceCode,
          targetSite,
          applicantName: needsPOA ? delegatorName : applicantName,
          applicantBirth: needsPOA ? delegatorBirth : applicantBirth,
          applicantPhone: needsPOA ? delegatorPhone : applicantPhone,
          applicationData: applicationFields,
          powerOfAttorneyId,
          executeImmediately: true,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/civil-service/${data.data.submissionId}`);
      } else {
        throw new Error(data.error || '민원 접수 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '민원 접수 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="p-6 max-w-4xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-3xl">📝</span>
            새 민원 접수
          </h1>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between">
            {STEP_INFO.map((s, index) => (
              <div key={s.step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold transition-all duration-300 ${
                      step > s.step
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        : step === s.step
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-4 ring-blue-100'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {step > s.step ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{s.icon}</span>
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`text-sm font-medium ${step >= s.step ? 'text-gray-900' : 'text-gray-400'}`}>
                      {s.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 hidden md:block">{s.desc}</p>
                  </div>
                </div>
                {index < STEP_INFO.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div className={`h-1 rounded-full transition-all duration-500 ${
                      step > s.step ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-3 animate-slide-up">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">오류가 발생했습니다</p>
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Step 1: Service Selection */}
        {step === 1 && (
          <div className="animate-slide-up">
            <div className="card mb-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="text-xl">⭐</span>
                자주 이용하는 민원
              </h2>
              <p className="text-sm text-gray-500 mb-4">선택하시면 자동으로 정보가 입력됩니다</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {POPULAR_SERVICES.map((service) => {
                  const siteConfig = SITE_CONFIG[service.site];
                  const isSelected = serviceName === service.name;

                  return (
                    <button
                      key={service.code}
                      onClick={() => selectService(service)}
                      className={`p-4 border-2 rounded-xl text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{service.icon}</span>
                          <div>
                            <div className="font-medium text-gray-900">{service.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{service.desc}</div>
                            <div className={`inline-flex items-center gap-1 text-xs mt-2 px-2 py-0.5 rounded-full ${siteConfig.bgColor} ${siteConfig.color}`}>
                              <span>{siteConfig.icon}</span>
                              {siteConfig.label}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-blue-600">{service.credits}</div>
                          <div className="text-xs text-gray-400">크레딧</div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-blue-200 flex items-center gap-2 text-blue-600 text-sm">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          선택됨
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-xl">🔧</span>
                직접 입력
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    민원명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className="input-field"
                    placeholder="예: 주민등록등본 발급"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      대상 사이트 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={targetSite}
                      onChange={(e) => setTargetSite(e.target.value as TargetSite)}
                      className="input-field"
                    >
                      {Object.entries(SITE_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.icon} {config.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      민원 코드
                      <span className="text-gray-400 text-xs ml-2">(선택사항)</span>
                    </label>
                    <input
                      type="text"
                      value={serviceCode}
                      onChange={(e) => setServiceCode(e.target.value)}
                      className="input-field"
                      placeholder="알고 계시면 입력"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음 단계
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Application Details */}
        {step === 2 && (
          <div className="animate-slide-up">
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-xl">👤</span>
                  신청 방식
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setNeedsPOA(true)}
                  className={`p-4 border-2 rounded-xl text-left transition-all ${
                    needsPOA
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      needsPOA ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className="text-lg">📋</span>
                    </div>
                    <div>
                      <div className="font-medium">대리 신청</div>
                      <div className="text-xs text-gray-500">위임장 작성 필요</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setNeedsPOA(false)}
                  className={`p-4 border-2 rounded-xl text-left transition-all ${
                    !needsPOA
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      !needsPOA ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className="text-lg">👤</span>
                    </div>
                    <div>
                      <div className="font-medium">본인 신청</div>
                      <div className="text-xs text-gray-500">직접 신청</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {!needsPOA && (
              <div className="card mb-6 animate-fade-in">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span>👤</span>
                  신청인 정보
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      className="input-field"
                      placeholder="홍길동"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">생년월일</label>
                    <input
                      type="text"
                      value={applicantBirth}
                      onChange={(e) => setApplicantBirth(e.target.value)}
                      className="input-field"
                      placeholder="YYYYMMDD"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">연락처</label>
                    <input
                      type="text"
                      value={applicantPhone}
                      onChange={(e) => setApplicantPhone(e.target.value)}
                      className="input-field"
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span>📝</span>
                  신청서 항목
                </h3>
                <button
                  onClick={addField}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  항목 추가
                </button>
              </div>

              <div className="space-y-3">
                {applicationFields.map((field, index) => (
                  <div key={field.fieldId} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl group">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={field.fieldName}
                        onChange={(e) => updateField(index, { fieldName: e.target.value })}
                        className="input-field text-sm"
                        placeholder="항목명"
                      />
                      <select
                        value={field.fieldType}
                        onChange={(e) => updateField(index, { fieldType: e.target.value as ApplicationField['fieldType'] })}
                        className="input-field text-sm"
                      >
                        <option value="text">텍스트</option>
                        <option value="number">숫자</option>
                        <option value="date">날짜</option>
                        <option value="select">선택</option>
                        <option value="checkbox">체크박스</option>
                      </select>
                      <input
                        type={field.fieldType === 'number' ? 'number' : 'text'}
                        value={String(field.value)}
                        onChange={(e) => updateField(index, { value: e.target.value })}
                        className="input-field text-sm"
                        placeholder="값 입력"
                      />
                    </div>
                    <button
                      onClick={() => removeField(index)}
                      className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="btn-outline flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                이전 단계
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음 단계
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Power of Attorney / Confirmation */}
        {step === 3 && (
          <div className="animate-slide-up">
            {needsPOA ? (
              <>
                <div className="card mb-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="text-xl">👤</span>
                    위임인(본인) 정보
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        이름 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={delegatorName}
                        onChange={(e) => setDelegatorName(e.target.value)}
                        className="input-field"
                        placeholder="홍길동"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        생년월일 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={delegatorBirth}
                        onChange={(e) => setDelegatorBirth(e.target.value)}
                        className="input-field"
                        placeholder="YYYYMMDD"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        연락처 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={delegatorPhone}
                        onChange={(e) => setDelegatorPhone(e.target.value)}
                        className="input-field"
                        placeholder="010-0000-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        주민등록번호 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={delegatorIdNumber}
                        onChange={(e) => setDelegatorIdNumber(e.target.value)}
                        className="input-field"
                        placeholder="000000-0000000"
                      />
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        SHA-256으로 암호화되어 안전하게 처리됩니다
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card mb-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="text-xl">✍️</span>
                    전자서명
                  </h2>
                  <SignaturePad
                    onSignatureChange={setSignatureData}
                    width={500}
                    height={180}
                  />
                </div>
              </>
            ) : null}

            {/* Summary */}
            <div className="card mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-xl">📋</span>
                신청 내용 확인
              </h2>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-500">민원명</span>
                  <span className="font-medium">{serviceName}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-500">대상 사이트</span>
                  <span className={`inline-flex items-center gap-1 ${SITE_CONFIG[targetSite].color}`}>
                    <span>{SITE_CONFIG[targetSite].icon}</span>
                    {SITE_CONFIG[targetSite].label}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-500">신청인</span>
                  <span className="font-medium">{needsPOA ? delegatorName || '-' : applicantName || '-'}</span>
                </div>
                {needsPOA && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-500">위임장 유효기간</span>
                    <span className="font-medium">30일</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-500">예상 크레딧</span>
                  <span className="font-semibold text-blue-600">50 크레딧</span>
                </div>
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <p className="font-medium text-gray-900">이용약관 및 개인정보 처리에 동의합니다</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {needsPOA
                      ? '전자위임장은 행정사법에 따라 작성되며, 위임인의 전자서명이 포함됩니다. 허위 정보 입력 시 법적 책임이 따를 수 있습니다.'
                      : '입력하신 정보는 민원 신청 목적으로만 사용됩니다.'}
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="btn-outline flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                이전 단계
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !canProceedStep3}
                className="btn-success flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    처리 중...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    민원 접수하기
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
