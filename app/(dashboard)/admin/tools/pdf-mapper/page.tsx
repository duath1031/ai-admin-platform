'use client';

/**
 * =============================================================================
 * PDF Mapper Tool (Simple Version)
 * =============================================================================
 * PDF 좌표 추출 및 매핑 편집 도구
 * iframe으로 PDF 표시, 클릭으로 좌표 추출
 */

import { useState, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import {
  Upload,
  MousePointer,
  Download,
  Trash2,
  Copy,
  Info,
} from 'lucide-react';

interface FieldMapping {
  fieldId: string;
  x: number;
  y: number;
  fontSize: number;
  page: number;
  type: 'text' | 'checkbox' | 'image';
  maxWidth?: number;
  trueValue?: string;
  width?: number;
  height?: number;
}

interface MappingData {
  serviceCode: string;
  serviceName: string;
  templateFile: string;
  version: string;
}

// A4 크기 (포인트)
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

export default function PdfMapperPage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [fields, setFields] = useState<FieldMapping[]>([]);
  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldType, setNewFieldType] = useState<'text' | 'checkbox' | 'image'>('text');
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageHeight, setPageHeight] = useState(A4_HEIGHT);

  const [mappingData, setMappingData] = useState<MappingData>({
    serviceCode: '',
    serviceName: '',
    templateFile: '',
    version: new Date().toISOString().slice(0, 7),
  });

  const overlayRef = useRef<HTMLDivElement>(null);

  // PDF 파일 업로드 처리
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf')) {
      alert('PDF 파일을 선택해주세요.');
      return;
    }

    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    setPdfFileName(file.name);

    setMappingData(prev => ({
      ...prev,
      templateFile: file.name,
      serviceCode: file.name.replace('.pdf', '').toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''),
    }));
  };

  // 오버레이 클릭 처리
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 화면 좌표를 PDF 좌표로 변환
    // 화면: (0,0) = 왼쪽 위, PDF: (0,0) = 왼쪽 아래
    const scaleX = A4_WIDTH / rect.width;
    const scaleY = A4_HEIGHT / rect.height;

    const pdfX = Math.round(clickX * scaleX);
    const pdfY = Math.round(A4_HEIGHT - (clickY * scaleY)); // Y축 반전

    setClickPosition({ x: pdfX, y: pdfY });

    if (isAddingField) {
      const newField: FieldMapping = {
        fieldId: `field_${fields.length + 1}`,
        x: pdfX,
        y: pdfY,
        fontSize: 10,
        page: currentPage,
        type: newFieldType,
        ...(newFieldType === 'checkbox' && { trueValue: 'V' }),
        ...(newFieldType === 'image' && { width: 40, height: 40 }),
      };

      setFields(prev => [...prev, newField]);
      setSelectedField(fields.length);
      setIsAddingField(false);
    }
  };

  // 필드 업데이트
  const updateField = (index: number, updates: Partial<FieldMapping>) => {
    setFields(prev =>
      prev.map((field, i) => (i === index ? { ...field, ...updates } : field))
    );
  };

  // 필드 삭제
  const deleteField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
    setSelectedField(null);
  };

  // JSON 내보내기
  const exportMapping = () => {
    const mapping = {
      serviceCode: mappingData.serviceCode,
      serviceName: mappingData.serviceName,
      templateFile: mappingData.templateFile,
      version: mappingData.version,
      pageCount: 1,
      fields: fields.filter(f => f.type === 'text').map(({ type, ...rest }) => rest),
      checkboxes: fields.filter(f => f.type === 'checkbox').map(({ type, fontSize, ...rest }) => rest),
      images: fields.filter(f => f.type === 'image').map(({ type, fontSize, trueValue, ...rest }) => rest),
      metadata: {
        lastVerified: new Date().toISOString().slice(0, 10),
        notes: '',
      },
    };

    const json = JSON.stringify(mapping, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${mappingData.serviceCode || 'mapping'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON 복사
  const copyMapping = () => {
    const mapping = {
      serviceCode: mappingData.serviceCode,
      serviceName: mappingData.serviceName,
      templateFile: mappingData.templateFile,
      version: mappingData.version,
      pageCount: 1,
      fields: fields.filter(f => f.type === 'text').map(({ type, ...rest }) => rest),
      checkboxes: fields.filter(f => f.type === 'checkbox').map(({ type, fontSize, ...rest }) => rest),
      images: fields.filter(f => f.type === 'image').map(({ type, fontSize, trueValue, ...rest }) => rest),
    };

    navigator.clipboard.writeText(JSON.stringify(mapping, null, 2));
    alert('클립보드에 복사되었습니다!');
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">PDF 좌표 매핑 도구</h1>
        <p className="text-muted-foreground">
          PDF에서 클릭하여 필드 좌표를 추출하고 매핑 JSON을 생성합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: PDF 뷰어 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>PDF 미리보기</CardTitle>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <span className="inline-flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    <Upload className="w-4 h-4 mr-2" />
                    PDF 업로드
                  </span>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {/* 도구 모음 */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Button
                  variant={isAddingField ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setIsAddingField(!isAddingField)}
                  disabled={!pdfUrl}
                >
                  <MousePointer className="w-4 h-4 mr-1" />
                  {isAddingField ? '클릭하여 추가' : '필드 추가'}
                </Button>

                {isAddingField && (
                  <Select value={newFieldType} onValueChange={(v: any) => setNewFieldType(v)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">텍스트</SelectItem>
                      <SelectItem value="checkbox">체크박스</SelectItem>
                      <SelectItem value="image">이미지</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* 좌표 표시 */}
              {clickPosition && (
                <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <strong>클릭 좌표:</strong> X = {clickPosition.x}, Y = {clickPosition.y}
                  <span className="text-gray-500 ml-2">(PDF 좌표계: 왼쪽 아래가 0,0)</span>
                </div>
              )}

              {/* PDF 뷰어 영역 */}
              <div
                className="border-2 border-dashed rounded-lg overflow-hidden bg-gray-100 relative"
                style={{ height: '700px' }}
              >
                {pdfUrl ? (
                  <>
                    {/* PDF를 embed로 표시 */}
                    <embed
                      src={pdfUrl}
                      type="application/pdf"
                      className="w-full h-full"
                    />
                    {/* 클릭 캡처용 오버레이 */}
                    {isAddingField && (
                      <div
                        ref={overlayRef}
                        onClick={handleOverlayClick}
                        className="absolute inset-0 cursor-crosshair bg-blue-500 bg-opacity-10"
                        style={{ zIndex: 10 }}
                      >
                        <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded text-sm">
                          PDF를 클릭하여 필드 위치 지정
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-lg">PDF 파일을 업로드하세요</p>
                      <p className="text-sm mt-2">위의 "PDF 업로드" 버튼을 클릭하세요</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 안내 */}
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <strong>사용 방법:</strong>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>PDF 파일을 업로드합니다</li>
                      <li>"필드 추가" 버튼을 클릭합니다</li>
                      <li>PDF 위에 파란 오버레이가 나타나면, 필드 위치를 클릭합니다</li>
                      <li>필드 ID를 수정하고 필요시 좌표를 미세 조정합니다</li>
                      <li>JSON 다운로드 또는 복사합니다</li>
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 필드 목록 및 설정 */}
        <div className="space-y-4">
          {/* 매핑 정보 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">매핑 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>서비스 코드</Label>
                <Input
                  value={mappingData.serviceCode}
                  onChange={(e) => setMappingData(prev => ({ ...prev, serviceCode: e.target.value }))}
                  placeholder="MAIL_ORDER_SALES"
                />
              </div>
              <div>
                <Label>서비스명</Label>
                <Input
                  value={mappingData.serviceName}
                  onChange={(e) => setMappingData(prev => ({ ...prev, serviceName: e.target.value }))}
                  placeholder="통신판매업 신고서"
                />
              </div>
              <div>
                <Label>템플릿 파일</Label>
                <Input
                  value={mappingData.templateFile}
                  onChange={(e) => setMappingData(prev => ({ ...prev, templateFile: e.target.value }))}
                  placeholder="MAIL_ORDER_SALES.pdf"
                />
              </div>
              <div>
                <Label>버전</Label>
                <Input
                  value={mappingData.version}
                  onChange={(e) => setMappingData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="2025-01"
                />
              </div>
            </CardContent>
          </Card>

          {/* 필드 목록 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">필드 목록 ({fields.length})</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyMapping}
                    title="JSON 복사"
                    disabled={fields.length === 0}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportMapping}
                    title="JSON 다운로드"
                    disabled={fields.length === 0}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[250px] overflow-auto">
                {fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    필드가 없습니다.<br />
                    "필드 추가" 후 PDF를 클릭하세요.
                  </p>
                ) : (
                  fields.map((field, index) => (
                    <div
                      key={index}
                      className={`p-2 border rounded cursor-pointer text-sm transition-colors ${
                        selectedField === index
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedField(index)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{field.fieldId}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(index);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {field.type} | X:{field.x} Y:{field.y}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* 선택된 필드 편집 */}
          {selectedField !== null && fields[selectedField] && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">필드 편집</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>필드 ID</Label>
                  <Input
                    value={fields[selectedField].fieldId}
                    onChange={(e) => updateField(selectedField, { fieldId: e.target.value })}
                    placeholder="companyName"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>X 좌표</Label>
                    <Input
                      type="number"
                      value={fields[selectedField].x}
                      onChange={(e) => updateField(selectedField, { x: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Y 좌표</Label>
                    <Input
                      type="number"
                      value={fields[selectedField].y}
                      onChange={(e) => updateField(selectedField, { y: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>폰트 크기</Label>
                    <Input
                      type="number"
                      value={fields[selectedField].fontSize}
                      onChange={(e) => updateField(selectedField, { fontSize: parseInt(e.target.value) || 10 })}
                    />
                  </div>
                  <div>
                    <Label>페이지 (0부터)</Label>
                    <Input
                      type="number"
                      value={fields[selectedField].page}
                      onChange={(e) => updateField(selectedField, { page: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                {fields[selectedField].type === 'text' && (
                  <div>
                    <Label>최대 너비 (선택)</Label>
                    <Input
                      type="number"
                      value={fields[selectedField].maxWidth || ''}
                      onChange={(e) => updateField(selectedField, {
                        maxWidth: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                      placeholder="자동"
                    />
                  </div>
                )}
                {fields[selectedField].type === 'checkbox' && (
                  <div>
                    <Label>체크 문자</Label>
                    <Input
                      value={fields[selectedField].trueValue || 'V'}
                      onChange={(e) => updateField(selectedField, { trueValue: e.target.value })}
                    />
                  </div>
                )}
                {fields[selectedField].type === 'image' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>너비</Label>
                      <Input
                        type="number"
                        value={fields[selectedField].width || 40}
                        onChange={(e) => updateField(selectedField, { width: parseInt(e.target.value) || 40 })}
                      />
                    </div>
                    <div>
                      <Label>높이</Label>
                      <Input
                        type="number"
                        value={fields[selectedField].height || 40}
                        onChange={(e) => updateField(selectedField, { height: parseInt(e.target.value) || 40 })}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
