"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, Button, Input, Textarea } from "@/components/ui";

const documentTypes = [
  {
    id: "petition",
    name: "진정서",
    icon: "📝",
    description: "행정기관에 부당한 처분이나 불이익에 대해 시정을 요청하는 문서",
  },
  {
    id: "appeal",
    name: "탄원서",
    icon: "📋",
    description: "재판부나 행정기관에 선처나 배려를 호소하는 문서",
  },
  {
    id: "objection",
    name: "이의신청서",
    icon: "📄",
    description: "행정처분에 대해 재검토를 요청하는 공식 문서",
  },
  {
    id: "application",
    name: "신청서",
    icon: "📑",
    description: "각종 인허가 및 등록을 위한 신청 문서",
  },
];

interface FormData {
  type: string;
  title: string;
  applicantName: string;
  applicantId: string;
  applicantAddress: string;
  applicantPhone: string;
  recipient: string;
  purpose: string;
  reason: string;
  additionalInfo: string;
}

export default function NewDocumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") || "";

  const [step, setStep] = useState(initialType ? 2 : 1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");

  const [formData, setFormData] = useState<FormData>({
    type: initialType,
    title: "",
    applicantName: "",
    applicantId: "",
    applicantAddress: "",
    applicantPhone: "",
    recipient: "",
    purpose: "",
    reason: "",
    additionalInfo: "",
  });

  const handleTypeSelect = (typeId: string) => {
    setFormData({ ...formData, type: typeId });
    setStep(2);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
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
    } catch (error) {
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
        body: JSON.stringify({
          ...formData,
          content: generatedContent,
        }),
      });

      const data = await response.json();

      if (data.id) {
        router.push(`/documents/${data.id}`);
      }
    } catch (error) {
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  const selectedType = documentTypes.find((t) => t.id === formData.type);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                step >= s
                  ? "bg-primary-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {s}
            </div>
            <span
              className={`text-sm ${step >= s ? "text-gray-900" : "text-gray-400"}`}
            >
              {s === 1 ? "서류 선택" : s === 2 ? "정보 입력" : "결과 확인"}
            </span>
            {s < 3 && <div className="w-12 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Document Type */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">서류 종류 선택</h1>
          <p className="text-gray-600 mb-6">작성하고자 하는 서류를 선택하세요</p>

          <div className="grid md:grid-cols-2 gap-4">
            {documentTypes.map((type) => (
              <Card
                key={type.id}
                className={`cursor-pointer transition-all ${
                  formData.type === type.id
                    ? "ring-2 ring-primary-600"
                    : "hover:shadow-md"
                }`}
                onClick={() => handleTypeSelect(type.id)}
              >
                <CardContent className="p-6">
                  <span className="text-4xl mb-4 block">{type.icon}</span>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {type.name}
                  </h3>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Input Form */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setStep(1)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedType?.name} 작성
            </h1>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Title */}
              <Input
                label="제목"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="예: OO 처분에 대한 진정서"
              />

              {/* Applicant Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="신청인 성명"
                  name="applicantName"
                  value={formData.applicantName}
                  onChange={handleInputChange}
                  placeholder="홍길동"
                />
                <Input
                  label="주민등록번호"
                  name="applicantId"
                  value={formData.applicantId}
                  onChange={handleInputChange}
                  placeholder="000000-0000000"
                />
              </div>

              <Input
                label="주소"
                name="applicantAddress"
                value={formData.applicantAddress}
                onChange={handleInputChange}
                placeholder="서울특별시 OO구 OO로 123"
              />

              <Input
                label="연락처"
                name="applicantPhone"
                value={formData.applicantPhone}
                onChange={handleInputChange}
                placeholder="010-0000-0000"
              />

              {/* Recipient */}
              <Input
                label="수신 (제출처)"
                name="recipient"
                value={formData.recipient}
                onChange={handleInputChange}
                placeholder="예: OO시 OO구청장"
              />

              {/* Content */}
              <Textarea
                label="요청 취지"
                name="purpose"
                value={formData.purpose}
                onChange={handleInputChange}
                placeholder="어떤 결과를 원하시는지 간략히 작성하세요"
                rows={3}
              />

              <Textarea
                label="상세 사유"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                placeholder="구체적인 사실관계와 이유를 작성하세요"
                rows={6}
              />

              <Textarea
                label="추가 정보 (선택)"
                name="additionalInfo"
                value={formData.additionalInfo}
                onChange={handleInputChange}
                placeholder="첨부 서류, 증거자료, 기타 참고사항 등"
                rows={3}
              />

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  이전
                </Button>
                <Button onClick={handleGenerate} isLoading={isGenerating}>
                  AI로 작성하기
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setStep(2)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">작성 결과</h1>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="bg-gray-50 rounded-lg p-6 mb-6 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {generatedContent}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setStep(2)}>
                  수정하기
                </Button>
                <Button variant="secondary" onClick={() => {
                  navigator.clipboard.writeText(generatedContent);
                  alert("클립보드에 복사되었습니다.");
                }}>
                  복사하기
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
