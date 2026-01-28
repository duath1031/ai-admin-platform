'use client';

/**
 * =============================================================================
 * DOCX Template Manager (The Writer 관리 도구)
 * =============================================================================
 * DOCX 템플릿 업로드, 관리, 테스트 도구
 * - 템플릿 업로드 (DOCX 파일)
 * - 메타데이터 편집 (필드 정의)
 * - 실시간 테스트 (데이터 입력 → 문서 생성)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Input,
  Label,
  Textarea,
} from '@/components/ui';
import {
  Upload,
  Download,
  Trash2,
  FileText,
  Plus,
  Save,
  Play,
  RefreshCw,
  ExternalLink,
  Check,
  AlertCircle,
} from 'lucide-react';

interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'phone' | 'email' | 'address';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

interface TemplateMetadata {
  code: string;
  name: string;
  category: string;
  description: string;
  fields: TemplateField[];
  gov24Link?: string;
  requiredDocuments?: string[];
}

export default function TemplateManagerPage() {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [testData, setTestData] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 신규 템플릿 메타데이터 편집용
  const [editingMetadata, setEditingMetadata] = useState<TemplateMetadata | null>(null);

  // 템플릿 목록 조회
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/document/generate-docx');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('템플릿 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // 템플릿 선택 시 테스트 데이터 초기화
  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.code === selectedTemplate);
      if (template) {
        const initialData: Record<string, string> = {};
        template.fields.forEach(field => {
          initialData[field.id] = field.defaultValue || '';
        });
        setTestData(initialData);
        setEditingMetadata(template);
        setTestResult(null);
      }
    }
  }, [selectedTemplate, templates]);

  // DOCX 템플릿 업로드
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      alert('DOCX 파일만 업로드 가능합니다.');
      return;
    }

    setUploadStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('code', file.name.replace('.docx', '').toUpperCase().replace(/\s+/g, '_'));

      const res = await fetch('/api/admin/templates/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setUploadStatus('success');
        fetchTemplates();
        setTimeout(() => setUploadStatus('idle'), 3000);
      } else {
        setUploadStatus('error');
      }
    } catch (error) {
      console.error('업로드 실패:', error);
      setUploadStatus('error');
    }
  };

  // 문서 생성 테스트
  const handleTestGeneration = async () => {
    if (!selectedTemplate) return;

    setTestResult(null);

    try {
      const res = await fetch('/api/document/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateCode: selectedTemplate,
          data: testData,
          returnFormat: 'base64',
        }),
      });

      const result = await res.json();

      if (result.success && result.base64) {
        // Base64를 Blob으로 변환하여 다운로드
        const binaryString = atob(result.base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: result.contentType });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();

        URL.revokeObjectURL(url);
        setTestResult({ success: true, message: '문서가 생성되었습니다.' });
      } else {
        setTestResult({ success: false, message: result.error || '문서 생성 실패' });
      }
    } catch (error) {
      setTestResult({ success: false, message: '문서 생성 중 오류가 발생했습니다.' });
    }
  };

  // 메타데이터 저장
  const handleSaveMetadata = async () => {
    if (!editingMetadata) return;

    try {
      const res = await fetch('/api/admin/templates/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMetadata),
      });

      if (res.ok) {
        fetchTemplates();
        alert('메타데이터가 저장되었습니다.');
      } else {
        alert('저장 실패');
      }
    } catch (error) {
      console.error('메타데이터 저장 실패:', error);
    }
  };

  // 필드 추가
  const handleAddField = () => {
    if (!editingMetadata) return;

    const newField: TemplateField = {
      id: `field_${Date.now()}`,
      label: '새 필드',
      type: 'text',
      required: false,
    };

    setEditingMetadata({
      ...editingMetadata,
      fields: [...editingMetadata.fields, newField],
    });
  };

  // 필드 삭제
  const handleRemoveField = (fieldId: string) => {
    if (!editingMetadata) return;

    setEditingMetadata({
      ...editingMetadata,
      fields: editingMetadata.fields.filter(f => f.id !== fieldId),
    });
  };

  // 필드 수정
  const handleUpdateField = (fieldId: string, updates: Partial<TemplateField>) => {
    if (!editingMetadata) return;

    setEditingMetadata({
      ...editingMetadata,
      fields: editingMetadata.fields.map(f =>
        f.id === fieldId ? { ...f, ...updates } : f
      ),
    });
  };

  const selectedTemplateData = templates.find(t => t.code === selectedTemplate);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">템플릿 관리 (The Writer)</h1>
          <p className="text-muted-foreground">
            DOCX 템플릿을 업로드하고 플레이스홀더를 관리합니다. {'{{변수명}}'} 형식으로 작성하세요.
          </p>
        </div>
        <Button onClick={fetchTemplates} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 템플릿 목록 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              템플릿 목록
            </CardTitle>
            <CardDescription>
              등록된 DOCX 템플릿 ({templates.length}개)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 업로드 버튼 */}
            <div className="relative">
              <input
                type="file"
                accept=".docx"
                onChange={handleTemplateUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="outline" className="w-full" disabled={uploadStatus === 'uploading'}>
                {uploadStatus === 'uploading' ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    업로드 중...
                  </>
                ) : uploadStatus === 'success' ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-500" />
                    업로드 완료
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    템플릿 업로드
                  </>
                )}
              </Button>
            </div>

            {/* 템플릿 리스트 */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-4">로딩 중...</p>
              ) : templates.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  등록된 템플릿이 없습니다.
                  <br />
                  DOCX 파일을 업로드해주세요.
                </p>
              ) : (
                templates.map(template => (
                  <button
                    key={template.code}
                    onClick={() => setSelectedTemplate(template.code)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedTemplate === template.code
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="font-medium">{template.name || template.code}</div>
                    <div className="text-sm text-muted-foreground">
                      {template.category || '미분류'} · {template.fields?.length || 0}개 필드
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 중앙: 메타데이터 편집 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">메타데이터 편집</CardTitle>
            <CardDescription>
              템플릿 정보와 입력 필드를 정의합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingMetadata ? (
              <>
                {/* 기본 정보 */}
                <div className="space-y-3">
                  <div>
                    <Label>템플릿 코드</Label>
                    <Input value={editingMetadata.code} disabled />
                  </div>
                  <div>
                    <Label>템플릿 이름</Label>
                    <Input
                      value={editingMetadata.name}
                      onChange={e => setEditingMetadata({ ...editingMetadata, name: e.target.value })}
                      placeholder="통신판매업 신고서"
                    />
                  </div>
                  <div>
                    <Label>카테고리</Label>
                    <Input
                      value={editingMetadata.category}
                      onChange={e => setEditingMetadata({ ...editingMetadata, category: e.target.value })}
                      placeholder="사업자등록/인허가"
                    />
                  </div>
                  <div>
                    <Label>정부24 링크</Label>
                    <Input
                      value={editingMetadata.gov24Link || ''}
                      onChange={e => setEditingMetadata({ ...editingMetadata, gov24Link: e.target.value })}
                      placeholder="https://www.gov.kr/..."
                    />
                  </div>
                </div>

                {/* 필드 목록 */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label>입력 필드 ({editingMetadata.fields.length}개)</Label>
                    <Button size="sm" variant="outline" onClick={handleAddField}>
                      <Plus className="w-4 h-4 mr-1" />
                      추가
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {editingMetadata.fields.map((field, idx) => (
                      <div key={field.id} className="p-3 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">필드 #{idx + 1}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveField(field.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        <Input
                          value={field.id}
                          onChange={e => handleUpdateField(field.id, { id: e.target.value })}
                          placeholder="필드 ID (영문)"
                          className="text-sm"
                        />
                        <Input
                          value={field.label}
                          onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                          placeholder="라벨 (한글)"
                          className="text-sm"
                        />
                        <select
                          value={field.type}
                          onChange={e => handleUpdateField(field.id, { type: e.target.value as TemplateField['type'] })}
                          className="w-full p-2 border rounded text-sm"
                        >
                          <option value="text">텍스트</option>
                          <option value="textarea">장문 텍스트</option>
                          <option value="date">날짜</option>
                          <option value="number">숫자</option>
                          <option value="phone">전화번호</option>
                          <option value="email">이메일</option>
                          <option value="address">주소</option>
                          <option value="select">선택</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 저장 버튼 */}
                <Button onClick={handleSaveMetadata} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  메타데이터 저장
                </Button>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                왼쪽에서 템플릿을 선택하세요.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 오른쪽: 테스트 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="w-5 h-5" />
              문서 생성 테스트
            </CardTitle>
            <CardDescription>
              데이터를 입력하고 문서를 생성해보세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTemplateData ? (
              <>
                {/* 입력 폼 */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {selectedTemplateData.fields.map(field => (
                    <div key={field.id}>
                      <Label>
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          value={testData[field.id] || ''}
                          onChange={e => setTestData({ ...testData, [field.id]: e.target.value })}
                          placeholder={field.placeholder}
                          rows={3}
                        />
                      ) : field.type === 'select' && field.options ? (
                        <select
                          value={testData[field.id] || ''}
                          onChange={e => setTestData({ ...testData, [field.id]: e.target.value })}
                          className="w-full p-2 border rounded"
                        >
                          <option value="">선택하세요</option>
                          {field.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                          value={testData[field.id] || ''}
                          onChange={e => setTestData({ ...testData, [field.id]: e.target.value })}
                          placeholder={field.placeholder}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* 결과 표시 */}
                {testResult && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 ${
                    testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {testResult.success ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    {testResult.message}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                  <Button onClick={handleTestGeneration} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    문서 생성
                  </Button>
                  {selectedTemplateData.gov24Link && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(selectedTemplateData.gov24Link, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                왼쪽에서 템플릿을 선택하세요.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 도움말 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">사용 방법</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>
              <strong>DOCX 템플릿 작성:</strong> Word에서 {'{{businessName}}'}, {'{{address}}'} 같은 플레이스홀더를 입력합니다.
            </li>
            <li>
              <strong>템플릿 업로드:</strong> 작성한 DOCX 파일을 업로드합니다.
            </li>
            <li>
              <strong>메타데이터 설정:</strong> 필드 ID, 라벨, 타입 등을 정의합니다. 필드 ID는 템플릿의 플레이스홀더와 일치해야 합니다.
            </li>
            <li>
              <strong>테스트:</strong> 데이터를 입력하고 문서를 생성하여 확인합니다.
            </li>
          </ol>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <strong>자동 변수:</strong> {'{{today}}'}, {'{{todayYear}}'}, {'{{todayMonth}}'}, {'{{todayDay}}'} 는 자동으로 현재 날짜로 치환됩니다.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
