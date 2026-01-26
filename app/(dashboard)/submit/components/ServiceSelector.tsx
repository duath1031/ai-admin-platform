'use client';

/**
 * =============================================================================
 * Service Selector Component
 * =============================================================================
 * 카테고리/키워드로 서비스 검색 및 선택
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, FileText, ExternalLink, Check } from 'lucide-react';
import {
  SERVICE_REGISTRY,
  searchServices,
  getServicesByCategory,
  getAllCategories,
  type ServiceDefinition,
} from '@/lib/config/serviceRegistry';

interface ServiceSelectorProps {
  onSelect: (service: ServiceDefinition) => void;
  selectedService: ServiceDefinition | null;
}

export default function ServiceSelector({
  onSelect,
  selectedService,
}: ServiceSelectorProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);

  // 카테고리 목록 로드
  useEffect(() => {
    setCategories(getAllCategories());
  }, []);

  // 필터링된 서비스 목록
  const filteredServices = useMemo(() => {
    let services = Object.values(SERVICE_REGISTRY);

    // 키워드 검색
    if (searchKeyword.trim()) {
      services = searchServices(searchKeyword);
    }

    // 카테고리 필터
    if (selectedCategory && selectedCategory !== 'all') {
      services = services.filter(s => s.category === selectedCategory);
    }

    return services;
  }, [searchKeyword, selectedCategory]);

  return (
    <div className="space-y-4">
      {/* 검색 및 필터 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="서비스 검색 (예: 통신판매업, 음식점...)"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="카테고리" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 선택된 서비스 표시 */}
      {selectedService && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary" />
                  <span className="font-semibold">{selectedService.name}</span>
                  <Badge variant="secondary">{selectedService.category}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  처리기간: {selectedService.info.processingDays} | 수수료: {selectedService.info.fee}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect(null as any)}
              >
                변경
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 서비스 목록 */}
      {!selectedService && (
        <div className="grid gap-2 max-h-[400px] overflow-auto">
          {filteredServices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              검색 결과가 없습니다.
            </div>
          ) : (
            filteredServices.map(service => (
              <Card
                key={service.code}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => onSelect(service)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{service.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {service.category}
                        </Badge>
                        {service.document.hasTemplate && (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            서식
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {service.info.processingDays} | {service.info.fee}
                      </p>
                    </div>
                    {service.gov24.cappBizCD && (
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 총 서비스 수 */}
      {!selectedService && (
        <p className="text-sm text-muted-foreground text-center">
          {filteredServices.length}개 서비스
        </p>
      )}
    </div>
  );
}
