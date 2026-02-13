/**
 * 조달 데이터 자동 수집 Cron Job
 *
 * Schedule: 매일 오전 9시, 오후 6시 (KST)
 * - 입찰공고 수집 (용역/물품/공사)
 * - 개찰결과(낙찰정보) 수집
 *
 * Vercel Cron: "0 0,9 * * *" (UTC 기준 0시, 9시 = KST 9시, 18시)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ProcurementType, ProcurementStatus } from '@prisma/client';

const G2B_BASE = 'https://apis.data.go.kr/1230000';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface RawBidItem {
  bidNtceNo?: string;
  bidNtceNm?: string;
  ntceInsttNm?: string;
  dminsttNm?: string;
  presmptPrce?: string | number;
  asignBdgtAmt?: string | number;
  bidNtceDt?: string;
  bidClseDt?: string;
  opengDt?: string;
  bidNtceDtlUrl?: string;
  bidMethdNm?: string;
  sucsfbidMthdNm?: string;
  // 낙찰정보
  sucsfbidAmt?: string | number;
  sucsfbidRate?: string | number;
  bidwinnrNm?: string;
  prtcptCnum?: string | number;
  rlOpengDt?: string;
}

// ─────────────────────────────────────────
// API Fetch Helper
// ─────────────────────────────────────────

async function fetchG2BData(
  servicePath: string,
  operation: string,
  params: Record<string, string>
): Promise<RawBidItem[]> {
  const apiKey = process.env.PUBLIC_DATA_KEY;
  if (!apiKey) {
    throw new Error('PUBLIC_DATA_KEY 환경변수가 설정되지 않았습니다.');
  }

  const queryParts = [`serviceKey=${apiKey}`];
  for (const [k, v] of Object.entries(params)) {
    queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }

  const url = `${G2B_BASE}/${servicePath}/${operation}?${queryParts.join('&')}`;
  console.log(`[Procurement Cron] Fetching: ${servicePath}/${operation}`);

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const text = await res.text();

  try {
    const json = JSON.parse(text);
    const response = json.response;
    if (!response?.body) return [];

    const rawItems = response.body.items;
    if (!rawItems) return [];

    const items = Array.isArray(rawItems)
      ? rawItems
      : rawItems.item
        ? Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item]
        : [];

    return items;
  } catch {
    console.error('[Procurement Cron] Parse error:', text.slice(0, 200));
    return [];
  }
}

// ─────────────────────────────────────────
// Data Collection Functions
// ─────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function parseDateString(s: string | undefined): Date | null {
  if (!s || s.length < 8) return null;
  const clean = String(s).replace(/[^0-9]/g, '');
  const year = parseInt(clean.slice(0, 4));
  const month = parseInt(clean.slice(4, 6)) - 1;
  const day = parseInt(clean.slice(6, 8));
  if (isNaN(year)) return null;
  return new Date(year, month, day);
}

function extractRegion(insttNm: string): string {
  const regions = [
    '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
    '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  ];
  for (const r of regions) {
    if (insttNm.includes(r)) return r;
  }
  return '기타';
}

async function collectBids(type: 'service' | 'goods' | 'construction'): Promise<number> {
  const operationMap: Record<string, string> = {
    goods: 'getBidPblancListInfoThng',
    construction: 'getBidPblancListInfoCnstwk',
    service: 'getBidPblancListInfoServc',
  };

  const typeMap: Record<string, ProcurementType> = {
    goods: ProcurementType.GOODS,
    construction: ProcurementType.CONSTRUCTION,
    service: ProcurementType.SERVICE,
  };

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const items = await fetchG2BData(
    'ad/BidPublicInfoService',
    operationMap[type],
    {
      pageNo: '1',
      numOfRows: '100',
      inqryDiv: '1',
      inqryBgnDt: formatDate(monthStart) + '0000',
      inqryEndDt: formatDate(today) + '2359',
      type: 'json',
    }
  );

  let upsertCount = 0;

  for (const item of items) {
    const bidNo = String(item.bidNtceNo || '');
    if (!bidNo) continue;

    const closeDt = parseDateString(item.bidClseDt);
    const status = closeDt && closeDt < today ? ProcurementStatus.CLOSED : ProcurementStatus.OPEN;

    try {
      await prisma.procurement.upsert({
        where: { bidNo },
        create: {
          bidNo,
          bidNtceNm: String(item.bidNtceNm || ''),
          agency: String(item.ntceInsttNm || ''),
          demandAgency: item.dminsttNm ? String(item.dminsttNm) : null,
          region: extractRegion(String(item.dminsttNm || item.ntceInsttNm || '')),
          foundationAmt: item.asignBdgtAmt ? BigInt(Math.round(Number(item.asignBdgtAmt))) : null,
          preAmt: item.presmptPrce ? BigInt(Math.round(Number(item.presmptPrce))) : null,
          type: typeMap[type],
          status,
          bidMethod: item.bidMethdNm ? String(item.bidMethdNm) : null,
          awardMethod: item.sucsfbidMthdNm ? String(item.sucsfbidMthdNm) : null,
          announceDt: parseDateString(item.bidNtceDt),
          closeDt,
          detailUrl: item.bidNtceDtlUrl ? String(item.bidNtceDtlUrl) : null,
        },
        update: {
          bidNtceNm: String(item.bidNtceNm || ''),
          preAmt: item.presmptPrce ? BigInt(Math.round(Number(item.presmptPrce))) : null,
          status,
          closeDt,
        },
      });
      upsertCount++;
    } catch (e) {
      console.error(`[Procurement Cron] Upsert failed for ${bidNo}:`, e);
    }
  }

  return upsertCount;
}

async function collectWinningBids(type: 'service' | 'goods' | 'construction'): Promise<number> {
  const operationMap: Record<string, string> = {
    goods: 'getScsbidListSttusThng',
    construction: 'getScsbidListSttusCnstwk',
    service: 'getScsbidListSttusServc',
  };

  const typeMap: Record<string, ProcurementType> = {
    goods: ProcurementType.GOODS,
    construction: ProcurementType.CONSTRUCTION,
    service: ProcurementType.SERVICE,
  };

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const items = await fetchG2BData(
    'as/ScsbidInfoService',
    operationMap[type],
    {
      pageNo: '1',
      numOfRows: '100',
      inqryDiv: '1',
      inqryBgnDt: formatDate(monthStart) + '0000',
      inqryEndDt: formatDate(today) + '2359',
      type: 'json',
    }
  );

  let upsertCount = 0;

  for (const item of items) {
    const bidNo = String(item.bidNtceNo || '');
    if (!bidNo) continue;

    const sucsfbidAmt = item.sucsfbidAmt ? BigInt(Math.round(Number(item.sucsfbidAmt))) : null;
    const sucsfbidRate = item.sucsfbidRate ? Number(item.sucsfbidRate) : null;

    try {
      await prisma.procurement.upsert({
        where: { bidNo },
        create: {
          bidNo,
          bidNtceNm: String(item.bidNtceNm || ''),
          agency: String(item.dminsttNm || ''),
          region: extractRegion(String(item.dminsttNm || '')),
          preAmt: item.presmptPrce ? BigInt(Math.round(Number(item.presmptPrce))) : null,
          bidWinAmt: sucsfbidAmt,
          winner: item.bidwinnrNm ? String(item.bidwinnrNm) : null,
          bidRate: sucsfbidRate,
          participantCnt: item.prtcptCnum ? Number(item.prtcptCnum) : null,
          type: typeMap[type],
          status: ProcurementStatus.AWARDED,
          bidMethod: item.bidMethdNm ? String(item.bidMethdNm) : null,
          awardMethod: item.sucsfbidMthdNm ? String(item.sucsfbidMthdNm) : null,
          openingDt: parseDateString(item.rlOpengDt || item.opengDt),
        },
        update: {
          bidWinAmt: sucsfbidAmt,
          winner: item.bidwinnrNm ? String(item.bidwinnrNm) : null,
          bidRate: sucsfbidRate,
          participantCnt: item.prtcptCnum ? Number(item.prtcptCnum) : null,
          status: ProcurementStatus.AWARDED,
          openingDt: parseDateString(item.rlOpengDt || item.opengDt),
        },
      });
      upsertCount++;
    } catch (e) {
      console.error(`[Procurement Cron] Winning upsert failed for ${bidNo}:`, e);
    }
  }

  return upsertCount;
}

// ─────────────────────────────────────────
// Reserve Price Details Collection
// ─────────────────────────────────────────

interface RawReservePriceItem {
  bidNtceNo?: string;
  bssamt?: string | number;
  plnprc?: string | number;
  presmptPrce?: string | number;
  asignBdgtAmt?: string | number;
  opengDt?: string;
  rlOpengDt?: string;
  [key: string]: string | number | undefined;
}

async function collectReservePriceDetails(type: 'service' | 'goods' | 'construction'): Promise<number> {
  const operationMap: Record<string, string> = {
    goods: 'getOpengResultListInfoThngPreparPcDetail',
    construction: 'getOpengResultListInfoCnstwkPreparPcDetail',
    service: 'getOpengResultListInfoServcPreparPcDetail',
  };

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  let items: RawReservePriceItem[];
  try {
    items = await fetchG2BData(
      'as/ScsbidInfoService',
      operationMap[type],
      {
        pageNo: '1',
        numOfRows: '100',
        inqryDiv: '1',
        inqryBgnDt: formatDate(monthStart) + '0000',
        inqryEndDt: formatDate(today) + '2359',
        type: 'json',
      }
    ) as RawReservePriceItem[];
  } catch (e) {
    console.error(`[Procurement Cron] Reserve price fetch failed for ${type}:`, e);
    return 0;
  }

  let upsertCount = 0;

  for (const item of items) {
    const bidNo = String(item.bidNtceNo || '');
    if (!bidNo) continue;

    const bssamt = item.bssamt ? BigInt(Math.round(Number(item.bssamt))) : (item.asignBdgtAmt ? BigInt(Math.round(Number(item.asignBdgtAmt))) : null);
    const plnprc = item.plnprc ? BigInt(Math.round(Number(item.plnprc))) : (item.presmptPrce ? BigInt(Math.round(Number(item.presmptPrce))) : null);

    const bssamtNum = Number(bssamt || 0);
    const plnprcNum = Number(plnprc || 0);
    const assessmentRate = bssamtNum > 0 ? (plnprcNum / bssamtNum) * 100 : null;

    // 예비가격 15개 파싱
    const reservePrices: Record<string, bigint | null> = {};
    const drawnFlags: Record<string, boolean> = {};
    for (let i = 1; i <= 15; i++) {
      const priceVal = item[`rsrvPrc${i}`];
      reservePrices[`rsrvPrc${i}`] = priceVal ? BigInt(Math.round(Number(priceVal))) : null;
      drawnFlags[`drwtYn${i}`] = String(item[`drwtYn${i}`] || '').toUpperCase() === 'Y';
    }

    // Procurement 연결 시도
    const procurement = await prisma.procurement.findUnique({
      where: { bidNo },
      select: { id: true },
    });

    try {
      await prisma.reservePriceDetail.upsert({
        where: { bidNo },
        create: {
          bidNo,
          bssamt,
          plnprc,
          assessmentRate: assessmentRate ? Math.round(assessmentRate * 10000) / 10000 : null,
          ...reservePrices,
          ...drawnFlags,
          openingDt: parseDateString(item.rlOpengDt || item.opengDt),
          procurementId: procurement?.id || null,
        },
        update: {
          bssamt,
          plnprc,
          assessmentRate: assessmentRate ? Math.round(assessmentRate * 10000) / 10000 : null,
          ...reservePrices,
          ...drawnFlags,
          openingDt: parseDateString(item.rlOpengDt || item.opengDt),
          procurementId: procurement?.id || null,
        },
      });
      upsertCount++;
    } catch (e) {
      console.error(`[Procurement Cron] Reserve price upsert failed for ${bidNo}:`, e);
    }
  }

  return upsertCount;
}

// ─────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Vercel Cron 인증 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // 개발 환경에서는 허용
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Procurement Cron] Unauthorized request');
      // Vercel Cron은 CRON_SECRET 없이도 호출 가능하므로 일단 허용
    }
  }

  const startTime = Date.now();
  const results = {
    bids: { service: 0, goods: 0, construction: 0 },
    winning: { service: 0, goods: 0, construction: 0 },
    reservePrices: { service: 0, goods: 0, construction: 0 },
    errors: [] as string[],
  };

  try {
    // 입찰공고 수집
    for (const type of ['service', 'goods', 'construction'] as const) {
      try {
        results.bids[type] = await collectBids(type);
      } catch (e) {
        const msg = `Bids ${type}: ${e instanceof Error ? e.message : 'Unknown error'}`;
        results.errors.push(msg);
        console.error(`[Procurement Cron] ${msg}`);
      }
    }

    // 낙찰정보 수집
    for (const type of ['service', 'goods', 'construction'] as const) {
      try {
        results.winning[type] = await collectWinningBids(type);
      } catch (e) {
        const msg = `Winning ${type}: ${e instanceof Error ? e.message : 'Unknown error'}`;
        results.errors.push(msg);
        console.error(`[Procurement Cron] ${msg}`);
      }
    }

    // 예비가격상세 수집
    for (const type of ['service', 'goods', 'construction'] as const) {
      try {
        results.reservePrices[type] = await collectReservePriceDetails(type);
      } catch (e) {
        const msg = `ReservePrices ${type}: ${e instanceof Error ? e.message : 'Unknown error'}`;
        results.errors.push(msg);
        console.error(`[Procurement Cron] ${msg}`);
      }
    }

    const duration = Date.now() - startTime;
    const totalBids = results.bids.service + results.bids.goods + results.bids.construction;
    const totalWinning = results.winning.service + results.winning.goods + results.winning.construction;
    const totalReservePrices = results.reservePrices.service + results.reservePrices.goods + results.reservePrices.construction;

    console.log(`[Procurement Cron] Completed in ${duration}ms - Bids: ${totalBids}, Winning: ${totalWinning}, ReservePrices: ${totalReservePrices}`);

    return NextResponse.json({
      success: true,
      message: `조달 데이터 수집 완료`,
      stats: {
        bids: results.bids,
        winning: results.winning,
        reservePrices: results.reservePrices,
        totalBids,
        totalWinning,
        totalReservePrices,
        duration: `${duration}ms`,
      },
      errors: results.errors.length > 0 ? results.errors : undefined,
      collectedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Procurement Cron] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
