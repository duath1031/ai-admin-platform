'use client';

/**
 * =============================================================================
 * Dynamic Submission Page
 * =============================================================================
 * 통합 민원 제출 페이지
 * - 서비스 선택
 * - 동적 폼 입력
 * - PDF 생성 및 정부24 연동
 */

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileText, Search, Edit, Send } from 'lucide-react';
import ServiceSelector from './components/ServiceSelector';
import DynamicForm from './components/DynamicForm';
import SubmissionActions from './components/SubmissionActions';
import type { ServiceDefinition } from '@/lib/config/serviceRegistry';

const STEPS = [
  { id: 'select', label: '서비스 선택', icon: Search },
  { id: 'fill', label: '정보 입력', icon: Edit },
  { id: 'submit', label: '제출', icon: Send },
];

export default function SubmitPage() {
  const [selectedService, setSelectedService] = useState<ServiceDefinition | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // 현재 단계 계산
  const currentStep = useMemo(() => {
    if (!selectedService) return 0;
    if (Object.keys(formData).length === 0) return 1;
    return 2;
  }, [selectedService, formData]);

  // 폼 유효성 검사 (간단한 버전)
  const isFormValid = useMemo(() => {
    if (!selectedService) return false;

    // 최소 3개 필드 입력 필요
    const filledFields = Object.values(formData).filter(v => v && v !== '');
    return filledFields.length >= 3;
  }, [selectedService, formData]);

  // 진행률 계산
  const progress = useMemo(() => {
    if (!selectedService) return 0;
    if (Object.keys(formData).length === 0) return 33;
    if (!isFormValid) return 66;
    return 100;
  }, [selectedService, formData, isFormValid]);

  // 서비스 선택 처리
  const handleServiceSelect = (service: ServiceDefinition | null) => {
    setSelectedService(service);
    if (!service) {
      setFormData({});
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6" />
          민원 신청
        </h1>
        <p className="text-muted-foreground mt-1">
          원하는 서비스를 선택하고 필요한 정보를 입력하세요.
          신청서를 자동으로 생성해드립니다.
        </p>
      </div>

      {/* 진행 단계 표시 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 ${
                  index <= currentStep ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index <= currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <step.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium hidden sm:inline">
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 서비스 선택 + 폼 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: 서비스 선택 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Badge variant={selectedService ? 'default' : 'secondary'}>
                    1
                  </Badge>
                  서비스 선택
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ServiceSelector
                onSelect={handleServiceSelect}
                selectedService={selectedService}
              />
            </CardContent>
          </Card>

          {/* Step 2: 정보 입력 */}
          {selectedService && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant={isFormValid ? 'default' : 'secondary'}>2</Badge>
                <span className="font-semibold">정보 입력</span>
              </div>
              <DynamicForm
                service={selectedService}
                formData={formData}
                onDataChange={setFormData}
              />
            </div>
          )}
        </div>

        {/* 오른쪽: 제출 액션 */}
        <div className="space-y-4">
          {selectedService && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={isFormValid ? 'default' : 'secondary'}>3</Badge>
                <span className="font-semibold">제출</span>
              </div>
              <SubmissionActions
                service={selectedService}
                formData={formData}
                isFormValid={isFormValid}
              />
            </>
          )}

          {/* 도움말 */}
          {!selectedService && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">사용 방법</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>신청하려는 민원 서비스를 검색하세요</li>
                  <li>서비스를 선택하면 필요한 정보 입력 폼이 나타납니다</li>
                  <li>정보를 입력하거나 AI 입력 기능을 사용하세요</li>
                  <li>신청서 PDF를 생성하고 정부24에서 제출하세요</li>
                </ol>
              </CardContent>
            </Card>
          )}

          {/* 인기 서비스 */}
          {!selectedService && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">자주 찾는 서비스</h3>
                <div className="space-y-2">
                  {[
                    '통신판매업 신고',
                    '일반음식점 영업신고',
                    '사업자등록 신청',
                    '건축물대장 발급',
                  ].map((name, i) => (
                    <button
                      key={i}
                      className="w-full text-left text-sm p-2 rounded hover:bg-muted transition-colors"
                      onClick={() => {
                        // 검색 트리거
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
