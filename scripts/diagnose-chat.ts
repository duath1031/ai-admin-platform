/**
 * AI 채팅 오류 진단 스크립트
 * Gemini API 연결, DB 연결, 시스템 프롬프트 로드 등 전체 체인 테스트
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('=== AI 채팅 시스템 진단 ===\n');
  const results: Array<{ name: string; status: string; detail: string; ms: number }> = [];

  // 1. 환경변수 확인
  console.log('[1] 환경변수 확인');
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    results.push({ name: 'GOOGLE_AI_API_KEY', status: 'FAIL', detail: '환경변수 미설정', ms: 0 });
  } else {
    results.push({ name: 'GOOGLE_AI_API_KEY', status: 'OK', detail: `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`, ms: 0 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    results.push({ name: 'DATABASE_URL', status: 'FAIL', detail: '환경변수 미설정', ms: 0 });
  } else {
    results.push({ name: 'DATABASE_URL', status: 'OK', detail: `${dbUrl.substring(0, 30)}...`, ms: 0 });
  }

  // 2. DB 연결 테스트
  console.log('[2] DB 연결 테스트');
  let t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    results.push({ name: 'DB 연결', status: 'OK', detail: 'PostgreSQL 응답 정상', ms: Date.now() - t });
  } catch (e: any) {
    results.push({ name: 'DB 연결', status: 'FAIL', detail: e.message?.substring(0, 100), ms: Date.now() - t });
  }

  // 3. 시스템 프롬프트 로드 테스트
  console.log('[3] 시스템 프롬프트 로드');
  t = Date.now();
  try {
    const prompt = await prisma.systemPrompt.findFirst({
      where: { isActive: true, isDefault: true },
    });
    if (prompt) {
      results.push({ name: '시스템 프롬프트', status: 'OK', detail: `"${prompt.name}" (${prompt.content.length}자)`, ms: Date.now() - t });
    } else {
      const anyPrompt = await prisma.systemPrompt.findFirst({ where: { isActive: true } });
      if (anyPrompt) {
        results.push({ name: '시스템 프롬프트', status: 'WARN', detail: `기본 프롬프트 없음, 활성 프롬프트 "${anyPrompt.name}" 사용 가능`, ms: Date.now() - t });
      } else {
        results.push({ name: '시스템 프롬프트', status: 'WARN', detail: 'DB에 프롬프트 없음 - 하드코딩된 기본값 사용', ms: Date.now() - t });
      }
    }
  } catch (e: any) {
    results.push({ name: '시스템 프롬프트', status: 'FAIL', detail: e.message?.substring(0, 100), ms: Date.now() - t });
  }

  // 4. Gemini API 기본 테스트 (비스트리밍)
  console.log('[4] Gemini API 연결 테스트 (gemini-2.0-flash)');
  t = Date.now();
  try {
    const genAI = new GoogleGenerativeAI(apiKey || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent('안녕하세요. 테스트입니다. 한 문장으로 답해주세요.');
    const text = result.response.text();
    results.push({ name: 'Gemini API (기본)', status: 'OK', detail: `응답: "${text.substring(0, 60)}..."`, ms: Date.now() - t });
  } catch (e: any) {
    results.push({ name: 'Gemini API (기본)', status: 'FAIL', detail: e.message?.substring(0, 150), ms: Date.now() - t });
  }

  // 5. Gemini 스트리밍 테스트
  console.log('[5] Gemini 스트리밍 테스트');
  t = Date.now();
  try {
    const genAI = new GoogleGenerativeAI(apiKey || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContentStream('자동차 수출말소 절차를 한 줄로 요약해줘.');
    let streamText = '';
    let chunkCount = 0;
    for await (const chunk of result.stream) {
      streamText += chunk.text();
      chunkCount++;
    }
    results.push({ name: 'Gemini 스트리밍', status: 'OK', detail: `${chunkCount}개 청크, 총 ${streamText.length}자`, ms: Date.now() - t });
  } catch (e: any) {
    results.push({ name: 'Gemini 스트리밍', status: 'FAIL', detail: e.message?.substring(0, 150), ms: Date.now() - t });
  }

  // 6. Gemini + Google Search Grounding 테스트
  console.log('[6] Gemini + Google Search Grounding 테스트');
  t = Date.now();
  try {
    const genAI = new GoogleGenerativeAI(apiKey || '');
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ googleSearch: {} } as any],
    });
    const result = await model.generateContent('2026년 최신 식품영업신고 절차를 한 줄로 알려줘.');
    const text = result.response.text();
    results.push({ name: 'Grounding (Google Search)', status: 'OK', detail: `응답: "${text.substring(0, 60)}..."`, ms: Date.now() - t });
  } catch (e: any) {
    results.push({ name: 'Grounding (Google Search)', status: 'FAIL', detail: e.message?.substring(0, 150), ms: Date.now() - t });
  }

  // 7. Knowledge Base 문서 상태
  console.log('[7] Knowledge Base 문서 상태');
  t = Date.now();
  try {
    const docs = await prisma.knowledgeDocument.findMany({
      where: { status: 'completed', processingMode: 'gemini_file' },
      select: { id: true, title: true, geminiFileUri: true, geminiExpiresAt: true },
    });
    const now = new Date();
    const expired = docs.filter(d => d.geminiExpiresAt && d.geminiExpiresAt < now);
    const valid = docs.filter(d => d.geminiExpiresAt && d.geminiExpiresAt >= now);
    results.push({
      name: 'Knowledge Base',
      status: expired.length > 0 ? 'WARN' : 'OK',
      detail: `총 ${docs.length}개 (유효: ${valid.length}, 만료: ${expired.length})`,
      ms: Date.now() - t,
    });
    if (expired.length > 0) {
      console.log(`  만료된 문서: ${expired.map(d => d.title).join(', ')}`);
    }
  } catch (e: any) {
    results.push({ name: 'Knowledge Base', status: 'FAIL', detail: e.message?.substring(0, 100), ms: Date.now() - t });
  }

  // 결과 출력
  console.log('\n' + '='.repeat(70));
  console.log('진단 결과');
  console.log('='.repeat(70));

  for (const r of results) {
    const icon = r.status === 'OK' ? '[OK]  ' : r.status === 'WARN' ? '[WARN]' : '[FAIL]';
    const msStr = r.ms > 0 ? ` (${r.ms}ms)` : '';
    console.log(`${icon} ${r.name}${msStr}`);
    console.log(`       ${r.detail}`);
  }

  // 종합 분석
  const fails = results.filter(r => r.status === 'FAIL');
  const warns = results.filter(r => r.status === 'WARN');

  console.log('\n' + '='.repeat(70));
  console.log('종합 분석');
  console.log('='.repeat(70));

  if (fails.length === 0 && warns.length === 0) {
    console.log('\n모든 시스템 정상. 에러가 Vercel 배포 환경에서만 발생하는 경우:');
    console.log('  1. Vercel Hobby 플랜의 10초 타임아웃 초과 가능성');
    console.log('  2. vercel.json의 maxDuration=30은 Pro 플랜에서만 유효');
    console.log('  3. Hobby 플랜에서는 모든 API 함수가 10초 제한');
  }

  if (fails.length > 0) {
    console.log(`\n${fails.length}개 치명적 오류:`);
    for (const f of fails) {
      console.log(`  - ${f.name}: ${f.detail}`);
    }
  }

  if (warns.length > 0) {
    console.log(`\n${warns.length}개 경고:`);
    for (const w of warns) {
      console.log(`  - ${w.name}: ${w.detail}`);
    }
  }

  // 타이밍 분석
  const totalApiTime = results
    .filter(r => r.ms > 0)
    .reduce((sum, r) => sum + r.ms, 0);

  console.log(`\n전체 진단 소요시간: ${totalApiTime}ms`);
  if (totalApiTime > 10000) {
    console.log('  --> 10초 초과! Vercel Hobby 플랜에서 타임아웃 발생 확실');
  }

  await prisma.$disconnect();
}

diagnose().catch(console.error);
