'use client';

/**
 * =============================================================================
 * Dynamic Form Component
 * =============================================================================
 * 서비스에 따라 동적으로 폼 필드 생성
 * - 자연어 입력 모드 지원
 * - AI 기반 데이터 추출
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Label,
  Textarea,
  Button,
  Checkbox,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { Sparkles, Loader2 } from 'lucide-react';
import type { ServiceDefinition } from '@/lib/config/serviceRegistry';

// 서비스별 필드 정의
const SERVICE_FIELDS: Record<string, Array<{
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'checkbox' | 'date';
  required?: boolean;
  placeholder?: string;
}>> = {
  MAIL_ORDER_SALES: [
    { id: 'companyName', label: '상호(법인명)', type: 'text', required: true, placeholder: '예: 주식회사 어드미니' },
    { id: 'corporateNumber', label: '법인등록번호', type: 'text', placeholder: '법인인 경우에만' },
    { id: 'companyAddress', label: '사업장 소재지', type: 'text', required: true },
    { id: 'companyPhone', label: '전화번호', type: 'text', required: true },
    { id: 'representativeName', label: '대표자 성명', type: 'text', required: true },
    { id: 'representativeAddress', label: '대표자 주소', type: 'text', required: true },
    { id: 'email', label: '이메일', type: 'text', required: true },
    { id: 'businessNumber', label: '사업자등록번호', type: 'text', required: true },
    { id: 'domainName', label: '도메인 주소(URL)', type: 'text', placeholder: 'www.example.com' },
    { id: 'hostServer', label: '호스팅 서버 소재지', type: 'text' },
    { id: 'isOnlineSales', label: '인터넷 판매', type: 'checkbox' },
  ],
  RESTAURANT: [
    { id: 'businessName', label: '영업소명', type: 'text', required: true },
    { id: 'businessAddress', label: '영업소 소재지', type: 'text', required: true },
    { id: 'ownerName', label: '신고인 성명', type: 'text', required: true },
    { id: 'ownerAddress', label: '신고인 주소', type: 'text', required: true },
    { id: 'phone', label: '전화번호', type: 'text', required: true },
    { id: 'businessArea', label: '영업장 면적(㎡)', type: 'text', required: true },
    { id: 'seatingCapacity', label: '좌석 수', type: 'text' },
  ],
  // 기본 필드 (템플릿이 없는 서비스용)
  DEFAULT: [
    { id: 'applicantName', label: '신청인 성명', type: 'text', required: true },
    { id: 'applicantAddress', label: '신청인 주소', type: 'text', required: true },
    { id: 'phone', label: '연락처', type: 'text', required: true },
    { id: 'email', label: '이메일', type: 'text' },
    { id: 'additionalInfo', label: '추가 정보', type: 'textarea' },
  ],
};

interface DynamicFormProps {
  service: ServiceDefinition;
  onDataChange: (data: Record<string, any>) => void;
  formData: Record<string, any>;
}

export default function DynamicForm({
  service,
  onDataChange,
  formData,
}: DynamicFormProps) {
  const [inputMode, setInputMode] = useState<'form' | 'natural'>('form');
  const [naturalInput, setNaturalInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  // 서비스에 맞는 필드 가져오기
  const fields = SERVICE_FIELDS[service.code] || SERVICE_FIELDS.DEFAULT;

  // 필드 값 변경 처리
  const handleFieldChange = (fieldId: string, value: any) => {
    onDataChange({
      ...formData,
      [fieldId]: value,
    });
  };

  // 자연어에서 데이터 추출
  const extractFromNaturalLanguage = async () => {
    if (!naturalInput.trim()) return;

    setIsExtracting(true);

    try {
      const response = await fetch('/api/ai/extract-form-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceCode: service.code,
          naturalInput,
          fields: fields.map(f => ({ id: f.id, label: f.label })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.extractedData) {
          onDataChange({
            ...formData,
            ...data.extractedData,
          });
          setInputMode('form'); // 폼 모드로 전환하여 확인
        }
      }
    } catch (error) {
      console.error('Extraction failed:', error);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>신청 정보 입력</span>
          <Tabs value={inputMode} onValueChange={(v: any) => setInputMode(v)}>
            <TabsList className="h-8">
              <TabsTrigger value="form" className="text-xs px-3">폼 입력</TabsTrigger>
              <TabsTrigger value="natural" className="text-xs px-3">
                <Sparkles className="w-3 h-3 mr-1" />
                AI 입력
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {inputMode === 'natural' ? (
          // 자연어 입력 모드
          <div className="space-y-4">
            <div>
              <Label>정보를 자유롭게 입력하세요</Label>
              <Textarea
                value={naturalInput}
                onChange={(e) => setNaturalInput(e.target.value)}
                placeholder={`예시:
회사명은 주식회사 어드미니이고, 대표자는 홍길동입니다.
사업장 주소는 서울시 강남구 테헤란로 123이고,
전화번호는 02-1234-5678, 이메일은 contact@admini.co.kr입니다.
사업자등록번호는 123-45-67890이고,
쇼핑몰 도메인은 www.admini-shop.com입니다.`}
                rows={8}
              />
            </div>
            <Button
              onClick={extractFromNaturalLanguage}
              disabled={isExtracting || !naturalInput.trim()}
              className="w-full"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  데이터 추출 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI로 데이터 추출
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              입력한 내용에서 필요한 정보를 자동으로 추출합니다.
            </p>
          </div>
        ) : (
          // 폼 입력 모드
          <div className="space-y-4">
            {fields.map(field => (
              <div key={field.id}>
                <Label htmlFor={field.id}>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {field.type === 'checkbox' ? (
                  <div className="flex items-center space-x-2 mt-1">
                    <Checkbox
                      id={field.id}
                      checked={!!formData[field.id]}
                      onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
                    />
                    <label htmlFor={field.id} className="text-sm cursor-pointer">
                      {field.label}
                    </label>
                  </div>
                ) : field.type === 'textarea' ? (
                  <Textarea
                    id={field.id}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="mt-1"
                  />
                ) : (
                  <Input
                    id={field.id}
                    type={field.type}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* 필요 서류 안내 */}
        {service.info.requiredDocs.length > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">필요 서류</h4>
            <ul className="text-sm space-y-1">
              {service.info.requiredDocs.map((doc, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                  {doc}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
