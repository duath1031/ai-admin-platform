'use client';

/**
 * =============================================================================
 * Submission Actions Component
 * =============================================================================
 * PDF 생성 및 정부24 연동 버튼
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  ExternalLink,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import type { ServiceDefinition } from '@/lib/config/serviceRegistry';
import { getServiceGov24Url } from '@/lib/config/serviceRegistry';

interface SubmissionActionsProps {
  service: ServiceDefinition;
  formData: Record<string, any>;
  isFormValid: boolean;
}

export default function SubmissionActions({
  service,
  formData,
  isFormValid,
}: SubmissionActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF 생성
  const handleGeneratePdf = async () => {
    if (!isFormValid) {
      setError('필수 항목을 모두 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/document/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceCode: service.code,
          userData: {
            ...formData,
            applicationDate: new Date().toLocaleDateString('ko-KR'),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PDF 생성 실패');
      }

      // PDF 다운로드
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${service.name}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setPdfGenerated(true);
    } catch (error) {
      console.error('PDF generation error:', error);
      setError(error instanceof Error ? error.message : 'PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 정부24로 이동
  const handleGov24 = () => {
    const url = getServiceGov24Url(service.code);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* 에러 메시지 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* PDF 생성 버튼 */}
        {service.document.hasTemplate && (
          <Button
            onClick={handleGeneratePdf}
            disabled={isGenerating || !isFormValid}
            className="w-full h-12"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                PDF 생성 중...
              </>
            ) : pdfGenerated ? (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                PDF 다시 생성
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                신청서 PDF 생성
              </>
            )}
          </Button>
        )}

        {/* 정부24 이동 버튼 */}
        <Button
          onClick={handleGov24}
          variant={pdfGenerated ? 'default' : 'outline'}
          className="w-full h-12"
          size="lg"
        >
          <ExternalLink className="w-5 h-5 mr-2" />
          정부24 접수창구 열기
        </Button>

        {/* 안내 메시지 */}
        {service.document.hasTemplate && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>신청 방법:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>위 버튼으로 신청서 PDF를 생성하세요</li>
                <li>정부24 접수창구를 열어 로그인하세요</li>
                <li>신청서 첨부 단계에서 다운로드한 PDF를 업로드하세요</li>
                <li>추가 서류가 있다면 함께 첨부하세요</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}

        {/* 서비스 정보 */}
        <div className="text-sm text-muted-foreground space-y-1 border-t pt-4">
          <p><strong>처리기간:</strong> {service.info.processingDays}</p>
          <p><strong>수수료:</strong> {service.info.fee}</p>
          {service.info.tips && service.info.tips.length > 0 && (
            <div className="mt-2">
              <strong>신청 팁:</strong>
              <ul className="list-disc list-inside mt-1">
                {service.info.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
