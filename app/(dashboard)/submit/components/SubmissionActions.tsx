'use client';

/**
 * =============================================================================
 * Submission Actions Component (The Navigator)
 * =============================================================================
 * PDF 생성 및 정부24 딥링크 연동
 * - 서류 생성 완료 후 정확한 신청 페이지로 안내
 */

import { useState } from 'react';
import { Card, CardContent, Button, Alert, AlertDescription } from '@/components/ui';
import {
  FileText,
  ExternalLink,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
  Rocket,
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
  const [generatedFileName, setGeneratedFileName] = useState<string>('');
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
      const fileName = `${service.name}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setPdfGenerated(true);
      setGeneratedFileName(fileName);
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

  // 정부24 직접 URL 존재 여부 확인
  const hasDirectUrl = !!service.gov24.directUrl || !!service.gov24.cappBizCD;

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

        {/* PDF 생성 완료 성공 메시지 */}
        {pdfGenerated && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
              <CheckCircle className="w-5 h-5" />
              서류 생성 완료!
            </div>
            <p className="text-green-700 text-sm">
              <strong>{generatedFileName}</strong> 파일이 다운로드되었습니다.
            </p>
            <p className="text-green-600 text-sm mt-1">
              아래 버튼을 눌러 정부24에서 신청을 완료하세요.
            </p>
          </div>
        )}

        {/* PDF 생성 버튼 */}
        {service.document.hasTemplate && (
          <Button
            onClick={handleGeneratePdf}
            disabled={isGenerating || !isFormValid}
            className="w-full h-12"
            size="lg"
            variant={pdfGenerated ? 'outline' : 'primary'}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                PDF 생성 중...
              </>
            ) : pdfGenerated ? (
              <>
                <Download className="w-5 h-5 mr-2" />
                PDF 다시 다운로드
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                신청서 PDF 생성
              </>
            )}
          </Button>
        )}

        {/* 🚀 정부24 접수 페이지 이동 버튼 - The Navigator */}
        <Button
          onClick={handleGov24}
          size="lg"
          className={`w-full h-14 text-base font-semibold transition-all ${
            pdfGenerated
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl animate-pulse'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Rocket className={`w-5 h-5 mr-2 ${pdfGenerated ? 'animate-bounce' : ''}`} />
          {pdfGenerated ? '🚀 정부24 접수 페이지로 이동' : '정부24 접수 페이지 열기'}
        </Button>

        {/* 딥링크 정보 */}
        {hasDirectUrl && (
          <div className="text-xs text-center text-muted-foreground">
            {service.name} 신청 페이지로 바로 연결됩니다
          </div>
        )}

        {/* 안내 메시지 */}
        {service.document.hasTemplate && !pdfGenerated && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>신청 방법:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>위 버튼으로 신청서 PDF를 생성하세요</li>
                <li>정부24 접수 페이지에서 로그인하세요</li>
                <li>신청서 첨부 단계에서 PDF를 업로드하세요</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}

        {/* 서비스 정보 */}
        <div className="text-sm text-muted-foreground space-y-1 border-t pt-4">
          <p><strong>처리기간:</strong> {service.info.processingDays}</p>
          <p><strong>수수료:</strong> {service.info.fee}</p>
          {service.info.requiredDocs.length > 0 && (
            <div className="mt-2">
              <strong>필요서류:</strong>
              <ul className="list-disc list-inside mt-1">
                {service.info.requiredDocs.map((doc, i) => (
                  <li key={i}>{doc}</li>
                ))}
              </ul>
            </div>
          )}
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
