/**
 * 보조금/정책자금 데이터 동기화 Cron
 * 매일 06:00 UTC (한국시간 15:00)
 *
 * 외부 API(기업마당, 보조금24 등)에서 최신 보조금 프로그램을 가져와 DB 동기화
 * 마감된 프로그램은 비활성 처리
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    let expired = 0;
    let synced = 0;

    // 1) 마감된 프로그램 비활성 처리
    const expiredResult = await prisma.subsidyProgram.updateMany({
      where: {
        isActive: true,
        applicationEnd: { lt: now },
      },
      data: { isActive: false },
    });
    expired = expiredResult.count;

    // 2) 기업마당 API 동기화 (BIZINFO_API_KEY 필요)
    const bizinfoApiKey = process.env.BIZINFO_API_KEY;
    if (bizinfoApiKey) {
      try {
        const programs = await fetchBizinfoPrograms(bizinfoApiKey);
        for (const prog of programs) {
          await prisma.subsidyProgram.upsert({
            where: {
              source_externalId: {
                source: "bizinfo",
                externalId: prog.externalId,
              },
            },
            update: {
              title: prog.title,
              agency: prog.agency,
              description: prog.description,
              supportAmount: prog.supportAmount,
              supportType: prog.supportType,
              applicationStart: prog.applicationStart,
              applicationEnd: prog.applicationEnd,
              detailUrl: prog.detailUrl,
              targetIndustry: prog.targetIndustry,
              targetScale: prog.targetScale,
              targetRegion: prog.targetRegion,
              isActive: true,
              updatedAt: now,
            },
            create: {
              source: "bizinfo",
              externalId: prog.externalId,
              title: prog.title,
              agency: prog.agency,
              description: prog.description,
              supportAmount: prog.supportAmount,
              supportType: prog.supportType,
              applicationStart: prog.applicationStart,
              applicationEnd: prog.applicationEnd,
              detailUrl: prog.detailUrl,
              targetIndustry: prog.targetIndustry,
              targetScale: prog.targetScale,
              targetRegion: prog.targetRegion,
              isActive: true,
            },
          });
          synced++;
        }
      } catch (e) {
        console.error("[Subsidy Sync] bizinfo API error:", e);
      }
    }

    // 3) 활성 프로그램 통계
    const activeCount = await prisma.subsidyProgram.count({
      where: { isActive: true },
    });

    const upcomingDeadlines = await prisma.subsidyProgram.count({
      where: {
        isActive: true,
        applicationEnd: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    console.log(
      `[Cron] 보조금 동기화: 만료 ${expired}건, 동기화 ${synced}건, 활성 ${activeCount}건, 7일 내 마감 ${upcomingDeadlines}건`
    );

    return NextResponse.json({
      success: true,
      expired,
      synced,
      activePrograms: activeCount,
      upcomingDeadlines,
    });
  } catch (error) {
    console.error("[Cron] subsidy-sync Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * 기업마당(bizinfo) API에서 보조금 프로그램 조회
 */
async function fetchBizinfoPrograms(apiKey: string) {
  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${apiKey}&dataType=json&searchSido=&searchCtgry=&pageUnit=50&pageIndex=1`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`bizinfo API ${res.status}`);

  const data = await res.json();
  const items = data?.jsonArray || [];

  return items.map((item: any) => ({
    externalId: item.pblancId || item.bizPblancSn || String(Math.random()),
    title: item.pblancNm || item.bizPblancNm || "제목 없음",
    agency: item.jrsdInsttNm || item.excInsttNm || "미정",
    description: item.bsnsSumryCn || "",
    supportAmount: item.sprtAmt || "",
    supportType: item.pldirSportRealmLclasCodeNm || "",
    applicationStart: item.reqstBeginEndDe ? new Date(item.reqstBeginEndDe.split("~")[0]?.trim()) : null,
    applicationEnd: item.reqstBeginEndDe ? new Date(item.reqstBeginEndDe.split("~")[1]?.trim()) : null,
    detailUrl: item.detailPageUrl || `https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=${item.pblancId}`,
    targetIndustry: null,
    targetScale: item.trgetNm || null,
    targetRegion: item.jrsdInsttNm?.includes("시") || item.jrsdInsttNm?.includes("도") ? item.jrsdInsttNm : null,
  }));
}
