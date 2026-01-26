'use client';

/**
 * =============================================================================
 * PDF Mapper Tool
 * =============================================================================
 * PDF 좌표 추출 및 매핑 편집 도구
 * 관리자가 PDF 템플릿에서 필드 좌표를 추출하고 매핑 JSON을 생성
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  MousePointer,
  Download,
  Trash2,
  Copy,
  Plus,
  Save,
  Eye,
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
  fields: FieldMapping[];
}

export default function PdfMapperPage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [fields, setFields] = useState<FieldMapping[]>([]);
  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldType, setNewFieldType] = useState<'text' | 'checkbox' | 'image'>('text');
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);

  const [mappingData, setMappingData] = useState<Partial<MappingData>>({
    serviceCode: '',
    serviceName: '',
    templateFile: '',
    version: new Date().toISOString().slice(0, 7),
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // PDF 파일 업로드 처리
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) return;

    setPdfFile(file);
    const url = URL.createObjectURL(file);
    setPdfUrl(url);

    setMappingData(prev => ({
      ...prev,
      templateFile: file.name,
      serviceCode: file.name.replace('.pdf', '').toUpperCase().replace(/\s/g, '_'),
    }));

    // pdf.js로 PDF 로드 (동적 임포트)
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const pdf = await pdfjsLib.getDocument(url).promise;
    setTotalPages(pdf.numPages);
    setCurrentPage(0);

    renderPage(pdf, 0);
  };

  // PDF 페이지 렌더링
  const renderPage = async (pdf: any, pageNum: number) => {
    const page = await pdf.getPage(pageNum + 1);
    const viewport = page.getViewport({ scale: scale });

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // 필드 마커 그리기
    drawFieldMarkers(context, viewport.height);
  };

  // 필드 마커 그리기
  const drawFieldMarkers = (ctx: CanvasRenderingContext2D, pageHeight: number) => {
    const currentPageFields = fields.filter(f => f.page === currentPage);

    currentPageFields.forEach((field, index) => {
      // PDF 좌표계 -> 캔버스 좌표계 변환 (Y축 반전)
      const canvasY = pageHeight - field.y * scale;
      const canvasX = field.x * scale;

      // 마커 색상
      const isSelected = selectedField === fields.indexOf(field);
      ctx.fillStyle = isSelected ? '#3b82f6' : '#ef4444';
      ctx.strokeStyle = isSelected ? '#1d4ed8' : '#b91c1c';

      if (field.type === 'checkbox') {
        ctx.fillRect(canvasX - 6, canvasY - 6, 12, 12);
        ctx.strokeRect(canvasX - 6, canvasY - 6, 12, 12);
      } else if (field.type === 'image') {
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 필드 ID 표시
      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.fillText(field.fieldId, canvasX + 8, canvasY + 4);
    });
  };

  // 캔버스 클릭 처리
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // 캔버스 좌표 -> PDF 좌표 변환
    const pdfX = Math.round(canvasX / scale);
    const pdfY = Math.round((canvas.height - canvasY) / scale);

    setClickPosition({ x: pdfX, y: pdfY });

    if (isAddingField) {
      // 새 필드 추가
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
      prev.map((field, i) =>
        i === index ? { ...field, ...updates } : field
      )
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
      pageCount: totalPages,
      fields: fields.filter(f => f.type === 'text').map(({ type, ...rest }) => rest),
      checkboxes: fields.filter(f => f.type === 'checkbox').map(({ type, fontSize, ...rest }) => rest),
      images: fields.filter(f => f.type === 'image').map(({ type, fontSize, trueValue, ...rest }) => rest),
      metadata: {
        lastVerified: new Date().toISOString(),
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
      fields: fields.filter(f => f.type === 'text'),
      checkboxes: fields.filter(f => f.type === 'checkbox'),
      images: fields.filter(f => f.type === 'image'),
    };

    navigator.clipboard.writeText(JSON.stringify(mapping, null, 2));
  };

  // 페이지 변경 시 재렌더링
  useEffect(() => {
    if (pdfUrl) {
      import('pdfjs-dist').then(async pdfjsLib => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        renderPage(pdf, currentPage);
      });
    }
  }, [currentPage, fields, selectedField, scale, pdfUrl]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">PDF 좌표 매핑 도구</h1>
        <p className="text-muted-foreground">
          PDF 템플릿에서 필드 좌표를 추출하고 매핑 JSON을 생성합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: PDF 뷰어 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>PDF 미리보기</CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="max-w-[200px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 도구 모음 */}
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant={isAddingField ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsAddingField(!isAddingField)}
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

                <div className="flex-1" />

                <Select value={scale.toString()} onValueChange={(v) => setScale(parseFloat(v))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">50%</SelectItem>
                    <SelectItem value="0.75">75%</SelectItem>
                    <SelectItem value="1">100%</SelectItem>
                    <SelectItem value="1.5">150%</SelectItem>
                  </SelectContent>
                </Select>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      이전
                    </Button>
                    <span className="text-sm px-2">
                      {currentPage + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage === totalPages - 1}
                    >
                      다음
                    </Button>
                  </div>
                )}
              </div>

              {/* 좌표 표시 */}
              {clickPosition && (
                <div className="mb-2 text-sm text-muted-foreground">
                  클릭 좌표: X={clickPosition.x}, Y={clickPosition.y}
                </div>
              )}

              {/* 캔버스 */}
              <div
                ref={containerRef}
                className="border rounded-lg overflow-auto bg-gray-100"
                style={{ maxHeight: '600px' }}
              >
                {pdfUrl ? (
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="cursor-crosshair"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    <div className="text-center">
                      <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>PDF 파일을 업로드하세요</p>
                    </div>
                  </div>
                )}
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
                  value={mappingData.serviceCode || ''}
                  onChange={(e) => setMappingData(prev => ({ ...prev, serviceCode: e.target.value }))}
                  placeholder="MAIL_ORDER_SALES"
                />
              </div>
              <div>
                <Label>서비스명</Label>
                <Input
                  value={mappingData.serviceName || ''}
                  onChange={(e) => setMappingData(prev => ({ ...prev, serviceName: e.target.value }))}
                  placeholder="통신판매업 신고서"
                />
              </div>
              <div>
                <Label>버전</Label>
                <Input
                  value={mappingData.version || ''}
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
                  <Button variant="outline" size="sm" onClick={copyMapping}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportMapping}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-auto">
                {fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    PDF에서 클릭하여 필드를 추가하세요
                  </p>
                ) : (
                  fields.map((field, index) => (
                    <div
                      key={index}
                      className={`p-2 border rounded cursor-pointer text-sm ${
                        selectedField === index ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedField(index)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{field.fieldId}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(index);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {field.type} | X:{field.x} Y:{field.y} | P:{field.page + 1}
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
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>X 좌표</Label>
                    <Input
                      type="number"
                      value={fields[selectedField].x}
                      onChange={(e) => updateField(selectedField, { x: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Y 좌표</Label>
                    <Input
                      type="number"
                      value={fields[selectedField].y}
                      onChange={(e) => updateField(selectedField, { y: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>폰트 크기</Label>
                    <Input
                      type="number"
                      value={fields[selectedField].fontSize}
                      onChange={(e) => updateField(selectedField, { fontSize: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>페이지</Label>
                    <Input
                      type="number"
                      value={fields[selectedField].page}
                      onChange={(e) => updateField(selectedField, { page: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                {fields[selectedField].type === 'text' && (
                  <div>
                    <Label>최대 너비</Label>
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
                        onChange={(e) => updateField(selectedField, { width: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>높이</Label>
                      <Input
                        type="number"
                        value={fields[selectedField].height || 40}
                        onChange={(e) => updateField(selectedField, { height: parseInt(e.target.value) })}
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
