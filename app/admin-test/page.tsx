/**
 * =============================================================================
 * [Patent Technology] AI Admin Platform - Test Dashboard
 * =============================================================================
 *
 * 테스트용 대시보드 - 핵심 모듈 기능 테스트
 * - Document Generation (AI-Powered Business Plans)
 * - Public Data API (정부 보조금, 민원)
 * - RPA Automation (정부 사이트 자동 입력)
 *
 * @author AI Admin Platform
 * @version 1.0.0
 * =============================================================================
 */

'use client';

import React, { useState } from 'react';

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: { maxWidth: '1200px', margin: '0 auto', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  title: { fontSize: '28px', fontWeight: '700' as const, color: '#1f2937', marginBottom: '8px' },
  subtitle: { color: '#6b7280', fontSize: '16px', marginBottom: '32px' },
  tabContainer: { display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' },
  content: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', minHeight: '500px' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', marginBottom: '4px' },
  label: { display: 'block', fontSize: '14px', fontWeight: '500' as const, color: '#374151', marginBottom: '4px' },
  button: { padding: '12px 32px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600' as const, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' },
};

// =============================================================================
// Tab Navigation
// =============================================================================

function TabNavigation({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (t: string) => void }) {
  const tabs = [
    { id: 'document', label: '📄 문서 생성', desc: 'AI 사업계획서' },
    { id: 'publicdata', label: '🏛️ 공공데이터', desc: '보조금/민원 검색' },
    { id: 'rpa', label: '🤖 RPA 자동화', desc: '정부사이트 입력' },
  ];

  return (
    <div style={styles.tabContainer}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            padding: '12px 24px', border: 'none', borderRadius: '8px 8px 0 0',
            backgroundColor: activeTab === tab.id ? '#3b82f6' : '#f3f4f6',
            color: activeTab === tab.id ? 'white' : '#374151',
            cursor: 'pointer', fontWeight: activeTab === tab.id ? '600' : '400',
          }}
        >
          <div>{tab.label}</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>{tab.desc}</div>
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Document Tab
// =============================================================================

function DocumentTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [formData, setFormData] = useState({
    companyName: '주식회사 어드미니', ceoName: '김대표', establishedDate: '2024-01-15',
    businessNumber: '123-45-67890', address: '서울시 강남구 테헤란로 123',
    businessItem: 'AI 기반 행정 자동화 솔루션',
    businessOverview: '인공지능을 활용하여 기업의 행정 업무를 자동화하는 SaaS 플랫폼입니다.',
    targetMarket: '중소기업 및 스타트업', coreStrength: '특허 기술 기반의 문서 자동 생성 및 RPA 기술',
    initialInvestment: '5억원', firstYearRevenue: '3억원', breakEvenPoint: '18개월',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/generate-doc/business-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `사업계획서_${formData.companyName}_${new Date().toISOString().split('T')[0]}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setResult({ success: true, message: '문서가 생성되어 다운로드되었습니다.' });
      } else {
        const err = await response.json();
        setResult({ success: false, error: err.error || '문서 생성 실패' });
      }
    } catch (error) {
      setResult({ success: false, error: error instanceof Error ? error.message : '네트워크 오류' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>📄 AI 사업계획서 생성</h2>
      <form onSubmit={handleSubmit}>
        <div style={styles.grid}>
          <div><label style={styles.label}>회사명 *</label><input style={styles.input} value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} required /></div>
          <div><label style={styles.label}>대표자명 *</label><input style={styles.input} value={formData.ceoName} onChange={e => setFormData({ ...formData, ceoName: e.target.value })} required /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={styles.label}>주요 사업 아이템 *</label><input style={styles.input} value={formData.businessItem} onChange={e => setFormData({ ...formData, businessItem: e.target.value })} required /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={styles.label}>사업 개요 *</label><textarea style={{ ...styles.input, minHeight: '100px' }} value={formData.businessOverview} onChange={e => setFormData({ ...formData, businessOverview: e.target.value })} required /></div>
          <div><label style={styles.label}>초기 투자금</label><input style={styles.input} value={formData.initialInvestment} onChange={e => setFormData({ ...formData, initialInvestment: e.target.value })} /></div>
          <div><label style={styles.label}>1차년도 예상 매출</label><input style={styles.input} value={formData.firstYearRevenue} onChange={e => setFormData({ ...formData, firstYearRevenue: e.target.value })} /></div>
        </div>
        <button type="submit" disabled={loading} style={{ ...styles.button, backgroundColor: loading ? '#9ca3af' : '#3b82f6' }}>
          {loading ? '생성 중...' : '📥 사업계획서 생성'}
        </button>
      </form>
      {result && (
        <div style={{ marginTop: '24px', padding: '16px', borderRadius: '8px', backgroundColor: result.success ? '#d1fae5' : '#fee2e2', color: result.success ? '#065f46' : '#991b1b' }}>
          {result.success ? `✅ ${result.message}` : `❌ ${result.error}`}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Public Data Tab
// =============================================================================

function PublicDataTab() {
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<'benefits' | 'civil'>('benefits');
  const [keyword, setKeyword] = useState('창업지원');
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true); setError(null); setResults([]);
    try {
      const endpoint = searchType === 'benefits' ? '/api/public-data/benefits' : '/api/public-data/civil-services';
      const response = await fetch(`${endpoint}?keyword=${encodeURIComponent(keyword)}&numOfRows=10`);
      const data = await response.json();
      if (data.success) { setResults(data.data || []); } else { setError(data.error || '검색 실패'); }
    } catch (err) { setError(err instanceof Error ? err.message : '네트워크 오류'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>🏛️ 공공데이터 검색</h2>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <select value={searchType} onChange={e => setSearchType(e.target.value as 'benefits' | 'civil')} style={{ padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: '6px' }}>
          <option value="benefits">정부 보조금/지원사업</option>
          <option value="civil">민원 서비스</option>
        </select>
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="검색 키워드..." style={{ flex: 1, padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: '6px' }} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
        <button onClick={handleSearch} disabled={loading} style={{ padding: '10px 24px', backgroundColor: loading ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          {loading ? '검색 중...' : '🔍 검색'}
        </button>
      </div>
      {error && <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px' }}>❌ {error}</div>}
      {results.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '12px' }}>검색 결과 ({results.length}건)</h3>
          {results.map((item, i) => (
            <div key={item.id || i} style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '12px', backgroundColor: '#f9fafb' }}>
              <h4 style={{ fontWeight: '600', marginBottom: '8px' }}>{item.title || item.name}</h4>
              <p style={{ color: '#6b7280', marginBottom: '8px' }}>{item.description}</p>
              {item.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {item.tags.map((tag: string, j: number) => (
                    <span key={j} style={{ padding: '2px 8px', backgroundColor: '#dbeafe', color: '#1d4ed8', borderRadius: '9999px', fontSize: '12px' }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && results.length === 0 && !error && <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>키워드를 입력하고 검색해주세요.</div>}
    </div>
  );
}

// =============================================================================
// RPA Tab
// =============================================================================

function RpaTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    site: 'venture_in', companyName: '주식회사 어드미니', businessNumber: '123-45-67890',
    ceoName: '김대표', techDescription: 'AI 기반 행정 자동화 기술',
    rdInvestment: '2억원', techPersonnel: 5, patents: 3,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setResult(null);
    try {
      const response = await fetch('/api/rpa/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site: formData.site, taskType: 'form_fill',
          companyData: { companyName: formData.companyName, businessNumber: formData.businessNumber, ceoName: formData.ceoName },
          ventureData: { techDescription: formData.techDescription, rdInvestment: formData.rdInvestment, techPersonnel: formData.techPersonnel, patents: formData.patents },
          options: { headless: true, timeout: 60000, autoSubmit: false },
        }),
      });
      setResult(await response.json());
    } catch (error) { setResult({ success: false, error: error instanceof Error ? error.message : '네트워크 오류' }); }
    finally { setLoading(false); }
  };

  const handleCopy = () => {
    if (result?.data?.manualFallback?.clipboardText) {
      navigator.clipboard.writeText(result.data.manualFallback.clipboardText);
      alert('클립보드에 복사되었습니다!');
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>🤖 RPA 자동 입력</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={styles.label}>대상 사이트</label>
          <select value={formData.site} onChange={e => setFormData({ ...formData, site: e.target.value })} style={{ ...styles.input, width: 'auto', minWidth: '200px' }}>
            <option value="venture_in">벤처인</option>
            <option value="gov24">정부24</option>
            <option value="hometax">홈택스</option>
          </select>
        </div>
        <div style={styles.grid}>
          <div><label style={styles.label}>회사명 *</label><input style={styles.input} value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} required /></div>
          <div><label style={styles.label}>사업자등록번호 *</label><input style={styles.input} value={formData.businessNumber} onChange={e => setFormData({ ...formData, businessNumber: e.target.value })} required /></div>
          <div><label style={styles.label}>대표자명 *</label><input style={styles.input} value={formData.ceoName} onChange={e => setFormData({ ...formData, ceoName: e.target.value })} required /></div>
          <div><label style={styles.label}>기술인력 수</label><input type="number" style={styles.input} value={formData.techPersonnel} onChange={e => setFormData({ ...formData, techPersonnel: parseInt(e.target.value) || 0 })} /></div>
        </div>
        <button type="submit" disabled={loading} style={{ ...styles.button, backgroundColor: loading ? '#9ca3af' : '#8b5cf6' }}>
          {loading ? '실행 중...' : '🚀 RPA 실행'}
        </button>
      </form>
      {result && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: result.success ? '#d1fae5' : '#fef3c7', marginBottom: '16px' }}>
            {result.success ? '✅ 완료' : '⚠️ 수동 입력 필요'}
          </div>
          {result.data?.manualFallback?.available && (
            <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h4>📋 수동 입력 데이터</h4>
                <button onClick={handleCopy} style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>복사</button>
              </div>
              <pre style={{ backgroundColor: '#1f2937', color: '#f3f4f6', padding: '16px', borderRadius: '6px', fontSize: '13px', overflow: 'auto', maxHeight: '250px' }}>
                {result.data.manualFallback.clipboardText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main
// =============================================================================

export default function AdminTestPage() {
  const [activeTab, setActiveTab] = useState('document');

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>AI행정사 어드미니 - 테스트</h1>
      <p style={styles.subtitle}>핵심 모듈 기능 테스트 페이지</p>
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <div style={styles.content}>
        {activeTab === 'document' && <DocumentTab />}
        {activeTab === 'publicdata' && <PublicDataTab />}
        {activeTab === 'rpa' && <RpaTab />}
      </div>
      <footer style={{ marginTop: '32px', padding: '24px', textAlign: 'center', backgroundColor: '#1f2937', borderRadius: '12px', color: 'white' }}>
        <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>행정사가 만든 AI행정사플랫폼 어드미니!</p>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>(행정사합동사무소정의 - 대표 염현수행정사)</p>
      </footer>
    </div>
  );
}
