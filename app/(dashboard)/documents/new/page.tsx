"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, Button, Input, Textarea } from "@/components/ui";

// ─── Document Type Definitions ───

interface DocType {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "admin" | "contract" | "certification";
}

const documentTypes: DocType[] = [
  // 행정 서류
  { id: "petition", name: "진정서", icon: "📝", description: "행정기관에 부당한 처분에 대해 시정을 요청", category: "admin" },
  { id: "appeal", name: "탄원서", icon: "📋", description: "재판부나 행정기관에 선처를 호소", category: "admin" },
  { id: "objection", name: "이의신청서", icon: "📄", description: "행정처분에 대해 재검토를 요청", category: "admin" },
  { id: "application", name: "신청서", icon: "📑", description: "각종 인허가 및 등록을 위한 신청", category: "admin" },
  // 계약서
  { id: "lease_contract", name: "임대차계약서", icon: "🏠", description: "부동산 임대차(전세/월세) 계약", category: "contract" },
  { id: "goods_contract", name: "물품매매계약서", icon: "📦", description: "물품 매매(구매/판매) 계약", category: "contract" },
  { id: "service_contract", name: "용역계약서", icon: "🤝", description: "서비스/용역 제공 계약", category: "contract" },
  { id: "labor_contract_doc", name: "근로계약서", icon: "👷", description: "근로자 고용을 위한 근로계약", category: "contract" },
  { id: "general_contract", name: "일반계약서", icon: "📃", description: "기타 일반 목적의 계약서", category: "contract" },
  // 내용증명
  { id: "content_certification", name: "내용증명서", icon: "✉️", description: "우체국 발송으로 법적 효력을 갖는 통지 문서", category: "certification" },
];

const categories = [
  { key: "admin", label: "행정 서류", desc: "진정서, 탄원서, 이의신청서, 신청서" },
  { key: "contract", label: "계약서", desc: "임대차, 물품매매, 용역, 근로, 일반 계약" },
  { key: "certification", label: "내용증명", desc: "법적 통지 및 요구사항 전달" },
];

// ─── Types ───

interface FormData {
  type: string;
  title: string;
  // 행정 서류 공통
  applicantName: string;
  applicantId: string;
  applicantAddress: string;
  applicantPhone: string;
  recipient: string;
  purpose: string;
  reason: string;
  additionalInfo: string;
  // 계약서 전용
  partyA: string;
  partyAAddress: string;
  partyB: string;
  partyBAddress: string;
  contractPeriodStart: string;
  contractPeriodEnd: string;
  contractAmount: string;
  contractSubject: string;
  contractTerms: string;
  specialTerms: string;
  // 임대차 전용
  propertyAddress: string;
  propertyArea: string;
  deposit: string;
  monthlyRent: string;
  // 근로계약 전용
  workPlace: string;
  jobDescription: string;
  workHours: string;
  salary: string;
  // 내용증명 전용
  senderName: string;
  senderAddress: string;
  senderPhone: string;
  receiverName: string;
  receiverAddress: string;
  factDescription: string;
  demandContent: string;
  deadline: string;
  legalBasis: string;
}

const initialFormData: FormData = {
  type: "",
  title: "",
  applicantName: "", applicantId: "", applicantAddress: "", applicantPhone: "",
  recipient: "", purpose: "", reason: "", additionalInfo: "",
  partyA: "", partyAAddress: "", partyB: "", partyBAddress: "",
  contractPeriodStart: "", contractPeriodEnd: "", contractAmount: "",
  contractSubject: "", contractTerms: "", specialTerms: "",
  propertyAddress: "", propertyArea: "", deposit: "", monthlyRent: "",
  workPlace: "", jobDescription: "", workHours: "", salary: "",
  senderName: "", senderAddress: "", senderPhone: "",
  receiverName: "", receiverAddress: "",
  factDescription: "", demandContent: "", deadline: "", legalBasis: "",
};

// ─── 내용증명 접수방법 안내 ───

function ContentCertificationGuide() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-4">
      <h3 className="text-base font-bold text-blue-900 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        내용증명 접수 방법 안내
      </h3>

      <div className="space-y-3 text-sm text-blue-800">
        <div>
          <p className="font-semibold mb-1">1. 우체국 방문 접수 (가장 일반적)</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>내용증명서 <strong>3통</strong>을 준비합니다 (발신인용, 수신인용, 우체국 보관용)</li>
            <li>3통 모두 <strong>동일한 내용</strong>이어야 합니다</li>
            <li>가까운 우체국을 방문하여 &quot;내용증명 발송&quot; 요청</li>
            <li>우체국 직원이 내용 확인 후 확인도장을 날인</li>
            <li>발송 수수료: 기본 2,650원 + 등기료 (약 4,000~5,000원)</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold mb-1">2. 인터넷우체국 온라인 발송</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li><strong>epost.go.kr</strong> 접속 → 우편 → 내용증명</li>
            <li>공동인증서(공인인증서) 로그인 필요</li>
            <li>온라인에서 직접 작성 또는 파일 업로드</li>
            <li>결제 후 자동 발송 (3통 자동 처리)</li>
            <li>24시간 접수 가능, 발급 확인서 PDF 제공</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold mb-1">3. 발송 후 확인사항</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>등기번호로 <strong>배달 추적</strong> 가능 (우체국 사이트)</li>
            <li>수신인이 수령 거부해도 <strong>발송 사실 자체가 증명</strong>됩니다</li>
            <li>발신인 보관용은 <strong>최소 3년 이상</strong> 보관하세요</li>
            <li>법적 분쟁 시 <strong>증거자료</strong>로 활용 가능</li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-yellow-800">
          <p className="font-semibold">TIP: 내용증명의 법적 효력</p>
          <p className="mt-1">내용증명 자체에 강제 집행력은 없지만, <strong>의사표시 도달 사실을 공적으로 증명</strong>합니다. 계약 해지 통보, 채무 이행 촉구, 손해배상 청구 등에서 중요한 증거가 됩니다.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function NewDocumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") || "";

  const [step, setStep] = useState(initialType ? 2 : 1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");

  const [formData, setFormData] = useState<FormData>({
    ...initialFormData,
    type: initialType,
  });

  const selectedType = documentTypes.find((t) => t.id === formData.type);
  const isContract = selectedType?.category === "contract";
  const isCertification = selectedType?.category === "certification";

  const handleTypeSelect = (typeId: string) => {
    setFormData({ ...initialFormData, type: typeId });
    setStep(2);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (data.error) {
        alert(data.error);
      } else {
        setGeneratedContent(data.content);
        setStep(3);
      }
    } catch {
      alert("서류 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch("/api/documents/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, content: generatedContent }),
      });
      const data = await response.json();
      if (data.id) {
        router.push(`/documents/${data.id}`);
      }
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=800,height=1100");
    if (!printWindow) { alert("팝업이 차단되었습니다."); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${formData.title || selectedType?.name || "서류"}</title>
      <style>body{font-family:'Malgun Gothic',sans-serif;font-size:13px;line-height:1.8;padding:40px;white-space:pre-wrap;}@page{margin:20mm;}</style>
    </head><body>${generatedContent}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              step >= s ? "bg-primary-600 text-white" : "bg-gray-200 text-gray-500"
            }`}>{s}</div>
            <span className={`text-sm ${step >= s ? "text-gray-900" : "text-gray-400"}`}>
              {s === 1 ? "서류 선택" : s === 2 ? "정보 입력" : "결과 확인"}
            </span>
            {s < 3 && <div className="w-12 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* ─── Step 1: Select Document Type ─── */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">서류 종류 선택</h1>
          <p className="text-gray-600 mb-6">작성하고자 하는 서류를 선택하세요</p>

          {categories.map(cat => (
            <div key={cat.key} className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">{cat.label}</h2>
              <p className="text-sm text-gray-500 mb-3">{cat.desc}</p>
              <div className={`grid gap-3 ${cat.key === "certification" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"}`}>
                {documentTypes
                  .filter(t => t.category === cat.key)
                  .map(type => (
                    <Card
                      key={type.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        formData.type === type.id ? "ring-2 ring-primary-600" : ""
                      }`}
                      onClick={() => handleTypeSelect(type.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <span className="text-3xl mb-2 block">{type.icon}</span>
                        <h3 className="font-semibold text-gray-900 text-sm mb-1">{type.name}</h3>
                        <p className="text-xs text-gray-500">{type.description}</p>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Step 2: Input Form ─── */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedType?.icon} {selectedType?.name} 작성
            </h1>
          </div>

          {/* 내용증명 안내 (입력 전 상단) */}
          {isCertification && <div className="mb-6"><ContentCertificationGuide /></div>}

          <Card>
            <CardContent className="p-6 space-y-6">
              {/* 제목 (공통) */}
              <Input
                label="제목"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder={
                  isContract ? "예: 강남구 OO빌딩 임대차계약서" :
                  isCertification ? "예: 보증금 반환 요구의 건" :
                  "예: OO 처분에 대한 진정서"
                }
              />

              {/* ─── 행정 서류 폼 ─── */}
              {!isContract && !isCertification && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input label="신청인 성명" name="applicantName" value={formData.applicantName} onChange={handleInputChange} placeholder="홍길동" />
                    <Input label="주민등록번호" name="applicantId" value={formData.applicantId} onChange={handleInputChange} placeholder="000000-0000000" />
                  </div>
                  <Input label="주소" name="applicantAddress" value={formData.applicantAddress} onChange={handleInputChange} placeholder="서울특별시 OO구 OO로 123" />
                  <Input label="연락처" name="applicantPhone" value={formData.applicantPhone} onChange={handleInputChange} placeholder="010-0000-0000" />
                  <Input label="수신 (제출처)" name="recipient" value={formData.recipient} onChange={handleInputChange} placeholder="예: OO시 OO구청장" />
                  <Textarea label="요청 취지" name="purpose" value={formData.purpose} onChange={handleInputChange} placeholder="어떤 결과를 원하시는지 간략히 작성하세요" rows={3} />
                  <Textarea label="상세 사유" name="reason" value={formData.reason} onChange={handleInputChange} placeholder="구체적인 사실관계와 이유를 작성하세요" rows={6} />
                  <Textarea label="추가 정보 (선택)" name="additionalInfo" value={formData.additionalInfo} onChange={handleInputChange} placeholder="첨부 서류, 증거자료, 기타 참고사항 등" rows={3} />
                </>
              )}

              {/* ─── 계약서 폼 ─── */}
              {isContract && (
                <>
                  <div className="border-b pb-2 mb-2">
                    <h3 className="font-semibold text-gray-700">계약 당사자</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input label={formData.type === "labor_contract_doc" ? "사용자(회사명)" : "갑 (성명/상호)"} name="partyA" value={formData.partyA} onChange={handleInputChange} placeholder="주식회사 OO / 홍길동" />
                    <Input label={formData.type === "labor_contract_doc" ? "사용자 주소" : "갑 주소"} name="partyAAddress" value={formData.partyAAddress} onChange={handleInputChange} placeholder="서울특별시 OO구" />
                    <Input label={formData.type === "labor_contract_doc" ? "근로자 성명" : "을 (성명/상호)"} name="partyB" value={formData.partyB} onChange={handleInputChange} placeholder="김OO / 주식회사 OO" />
                    <Input label={formData.type === "labor_contract_doc" ? "근로자 주소" : "을 주소"} name="partyBAddress" value={formData.partyBAddress} onChange={handleInputChange} placeholder="서울특별시 OO구" />
                  </div>

                  <div className="border-b pb-2 mb-2 mt-4">
                    <h3 className="font-semibold text-gray-700">계약 내용</h3>
                  </div>

                  {/* 임대차 전용 */}
                  {formData.type === "lease_contract" && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <Input label="물건 소재지" name="propertyAddress" value={formData.propertyAddress} onChange={handleInputChange} placeholder="서울시 강남구 OO로 123, 201호" className="md:col-span-2" />
                      <Input label="면적 (㎡)" name="propertyArea" value={formData.propertyArea} onChange={handleInputChange} placeholder="85" />
                      <Input label="보증금 (원)" name="deposit" value={formData.deposit} onChange={handleInputChange} placeholder="50,000,000" />
                      <Input label="월 차임 (원)" name="monthlyRent" value={formData.monthlyRent} onChange={handleInputChange} placeholder="1,000,000" />
                    </div>
                  )}

                  {/* 물품매매 전용 */}
                  {formData.type === "goods_contract" && (
                    <Textarea label="매매 물품 내역 (품명, 규격, 수량, 단가)" name="contractSubject" value={formData.contractSubject} onChange={handleInputChange} placeholder="노트북 LG그램 17인치 / 10대 / 대당 1,500,000원" rows={3} />
                  )}

                  {/* 용역 전용 */}
                  {formData.type === "service_contract" && (
                    <Textarea label="용역 내용 (범위 및 산출물)" name="contractSubject" value={formData.contractSubject} onChange={handleInputChange} placeholder="웹사이트 개발 용역: 기획, 디자인, 개발, 테스트 포함..." rows={3} />
                  )}

                  {/* 근로계약 전용 */}
                  {formData.type === "labor_contract_doc" && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <Input label="근무장소" name="workPlace" value={formData.workPlace} onChange={handleInputChange} placeholder="서울시 강남구 본사" />
                      <Input label="담당업무" name="jobDescription" value={formData.jobDescription} onChange={handleInputChange} placeholder="웹 개발 및 운영" />
                      <Input label="근로시간" name="workHours" value={formData.workHours} onChange={handleInputChange} placeholder="09:00~18:00 (주 40시간)" />
                      <Input label="임금 (월)" name="salary" value={formData.salary} onChange={handleInputChange} placeholder="3,500,000" />
                    </div>
                  )}

                  {/* 일반 계약서 전용 */}
                  {formData.type === "general_contract" && (
                    <Textarea label="계약 목적 및 내용" name="contractSubject" value={formData.contractSubject} onChange={handleInputChange} placeholder="계약의 구체적 목적과 내용을 작성하세요" rows={4} />
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <Input label="계약기간 시작" name="contractPeriodStart" type="date" value={formData.contractPeriodStart} onChange={handleInputChange} />
                    <Input label="계약기간 종료" name="contractPeriodEnd" type="date" value={formData.contractPeriodEnd} onChange={handleInputChange} />
                  </div>
                  <Input label="계약 금액 (원)" name="contractAmount" value={formData.contractAmount} onChange={handleInputChange} placeholder="50,000,000" />
                  <Textarea label="특약사항 (선택)" name="specialTerms" value={formData.specialTerms} onChange={handleInputChange} placeholder="당사자 간 별도로 합의한 사항을 입력하세요" rows={3} />
                </>
              )}

              {/* ─── 내용증명 폼 ─── */}
              {isCertification && (
                <>
                  <div className="border-b pb-2 mb-2">
                    <h3 className="font-semibold text-gray-700">발신인 정보</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input label="발신인 성명/상호" name="senderName" value={formData.senderName} onChange={handleInputChange} placeholder="홍길동 / 주식회사 OO" />
                    <Input label="발신인 연락처" name="senderPhone" value={formData.senderPhone} onChange={handleInputChange} placeholder="010-0000-0000" />
                  </div>
                  <Input label="발신인 주소" name="senderAddress" value={formData.senderAddress} onChange={handleInputChange} placeholder="서울특별시 OO구 OO로 123" />

                  <div className="border-b pb-2 mb-2 mt-4">
                    <h3 className="font-semibold text-gray-700">수신인 정보</h3>
                  </div>
                  <Input label="수신인 성명/상호" name="receiverName" value={formData.receiverName} onChange={handleInputChange} placeholder="김OO / 주식회사 OO" />
                  <Input label="수신인 주소" name="receiverAddress" value={formData.receiverAddress} onChange={handleInputChange} placeholder="서울특별시 OO구 OO로 456" />

                  <div className="border-b pb-2 mb-2 mt-4">
                    <h3 className="font-semibold text-gray-700">내용증명 본문</h3>
                  </div>
                  <Textarea label="사실관계" name="factDescription" value={formData.factDescription} onChange={handleInputChange} placeholder="일시, 장소, 경위 등 구체적 사실관계를 작성하세요" rows={5} />
                  <Textarea label="요구사항" name="demandContent" value={formData.demandContent} onChange={handleInputChange} placeholder="상대방에게 요구하는 구체적 내용을 작성하세요 (예: 보증금 반환, 계약 이행, 손해배상 등)" rows={4} />
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input label="이행 기한" name="deadline" value={formData.deadline} onChange={handleInputChange} placeholder="본 서면 수령 후 7일 이내" />
                    <Input label="관련 법적 근거 (선택)" name="legalBasis" value={formData.legalBasis} onChange={handleInputChange} placeholder="민법 제536조, 주택임대차보호법 등" />
                  </div>
                  <Textarea label="추가 정보 (선택)" name="additionalInfo" value={formData.additionalInfo} onChange={handleInputChange} placeholder="불이행 시 조치 사항, 첨부 서류 등" rows={2} />
                </>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>이전</Button>
                <Button onClick={handleGenerate} isLoading={isGenerating}>AI로 작성하기</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Step 3: Result ─── */}
      {step === 3 && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setStep(2)} className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">작성 결과</h1>
          </div>

          {/* 내용증명 접수 안내 (결과 상단) */}
          {isCertification && <div className="mb-6"><ContentCertificationGuide /></div>}

          <Card>
            <CardContent className="p-6">
              <div className="bg-gray-50 rounded-lg p-6 mb-6 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {generatedContent}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={() => setStep(2)}>수정하기</Button>
                <Button variant="secondary" onClick={() => {
                  navigator.clipboard.writeText(generatedContent);
                  alert("클립보드에 복사되었습니다.");
                }}>복사하기</Button>
                <Button variant="secondary" onClick={handlePrint}>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  인쇄 / PDF
                </Button>
                <Button onClick={handleSave}>저장하기</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
