export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchLandUse, ZONE_BUSINESS_RESTRICTIONS } from "@/lib/landUseApi";
import { deductTokens } from "@/lib/token/tokenService";
import { checkFeatureAccess } from "@/lib/token/planAccess";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const access = await checkFeatureAccess(userId, "land_use_check");
    if (!access.allowed) {
      return NextResponse.json({ error: "플랜 업그레이드가 필요합니다.", requiredPlan: access.requiredPlan }, { status: 403 });
    }

    const { address } = await req.json();
    if (!address || address.trim().length < 3) {
      return NextResponse.json({ error: "주소를 입력해주세요." }, { status: 400 });
    }

    // Deduct tokens AFTER validation but BEFORE the API call
    const deducted = await deductTokens(userId, "land_use_check");
    if (!deducted) {
      return NextResponse.json({ error: "토큰이 부족합니다.", required: 1500, redirect: "/token-charge" }, { status: 402 });
    }

    const result = await searchLandUse(address.trim());

    // Enrich with zone restriction data
    const enrichedZones = result.zoneInfo?.map(zone => ({
      ...zone,
      restrictions: ZONE_BUSINESS_RESTRICTIONS[zone.name] || null,
    })) || [];

    return NextResponse.json({
      success: result.success,
      address: result.address,
      coordinates: result.coordinates,
      pnu: result.pnu,
      zones: enrichedZones,
      error: result.error,
    });
  } catch (error) {
    console.error("[Land Use API] Error:", error);
    return NextResponse.json({ error: "토지이용계획 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
