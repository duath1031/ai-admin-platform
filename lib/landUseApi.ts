// V-World API를 이용한 토지이용계획 조회

interface LandUseResult {
  success: boolean;
  address?: string;
  coordinates?: { x: number; y: number };
  zoneInfo?: ZoneInfo[];
  error?: string;
}

interface ZoneInfo {
  name: string;
  code?: string;
  restrictions?: string[];
}

// 주소에서 좌표 추출 (지오코딩)
export async function geocodeAddress(address: string): Promise<{
  success: boolean;
  x?: number;
  y?: number;
  refinedAddress?: string;
  error?: string;
}> {
  try {
    const VWORLD_KEY = process.env.VWORLD_KEY;

    if (!VWORLD_KEY) {
      return { success: false, error: "V-World API 키가 설정되지 않았습니다." };
    }

    const geoUrl = "https://api.vworld.kr/req/address";
    const params = new URLSearchParams({
      service: "address",
      request: "getcoord",
      version: "2.0",
      crs: "epsg:4326",
      address: address,
      refine: "true",
      simple: "false",
      format: "json",
      type: "road",
      key: VWORLD_KEY,
    });

    const response = await fetch(`${geoUrl}?${params}`);
    const data = await response.json();

    if (data.response?.status !== "OK") {
      // 지번 주소로 재시도
      params.set("type", "parcel");
      const retryResponse = await fetch(`${geoUrl}?${params}`);
      const retryData = await retryResponse.json();

      if (retryData.response?.status !== "OK") {
        return {
          success: false,
          error: retryData.response?.error?.text || "주소를 찾을 수 없습니다.",
        };
      }

      const result = retryData.response.result;
      return {
        success: true,
        x: parseFloat(result.point.x),
        y: parseFloat(result.point.y),
        refinedAddress: result.text,
      };
    }

    const result = data.response.result;
    return {
      success: true,
      x: parseFloat(result.point.x),
      y: parseFloat(result.point.y),
      refinedAddress: result.text,
    };
  } catch (error: any) {
    console.error("지오코딩 오류:", error);
    return { success: false, error: error.message };
  }
}

// 좌표로 토지이용계획 조회
export async function getLandUseInfo(x: number, y: number): Promise<{
  success: boolean;
  zones?: ZoneInfo[];
  error?: string;
}> {
  try {
    const VWORLD_KEY = process.env.VWORLD_KEY;

    if (!VWORLD_KEY) {
      console.error("V-World API 키 미설정");
      return { success: false, error: "V-World API 키가 설정되지 않았습니다. 관리자에게 문의하세요." };
    }

    // V-World 토지이용계획 데이터 조회
    // 버퍼를 1m로 줄여서 정확한 위치의 용도지역만 조회
    const dataUrl = "https://api.vworld.kr/req/data";
    const params = new URLSearchParams({
      service: "data",
      request: "GetFeature",
      data: "LT_C_UQ111",  // 토지이용계획 (용도지역/지구)
      key: VWORLD_KEY,
      format: "json",
      geometry: "false",
      attribute: "true",
      crs: "EPSG:4326",
      domain: process.env.VWORLD_DOMAIN || "localhost",
      geomFilter: `POINT(${x} ${y})`,
      buffer: "1",  // 버퍼를 1m로 최소화하여 정확한 조회
    });

    console.log(`[V-World API] 토지이용계획 조회: (${x}, ${y})`);

    const response = await fetch(`${dataUrl}?${params}`, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[V-World API] HTTP 오류: ${response.status}`);
      return { success: false, error: `API 서버 오류 (${response.status})` };
    }

    const data = await response.json();
    console.log("[V-World API] 응답:", JSON.stringify(data).substring(0, 500));

    // API 응답 상태 확인
    if (data.response?.status === "NOT_FOUND" || data.response?.status === "ERROR") {
      const errorText = data.response?.error?.text || "해당 위치의 토지이용계획 정보가 없습니다.";
      console.warn(`[V-World API] 조회 실패: ${errorText}`);

      // 대체 데이터 소스 시도 (LT_C_UQ112: 용도지구)
      return await getLandUseInfoFallback(x, y, VWORLD_KEY);
    }

    const features = data.response?.result?.featureCollection?.features || [];
    const zones: ZoneInfo[] = [];
    const seenZones = new Set<string>(); // 중복 제거용

    for (const feature of features) {
      const props = feature.properties;
      // V-World API는 uname 또는 uq_nm으로 용도지역명을 반환
      const zoneName = props?.uname || props?.uq_nm || props?.prpos_area_nm;

      // 미분류, 중복 제외
      if (zoneName && zoneName !== "미분류" && !seenZones.has(zoneName)) {
        seenZones.add(zoneName);
        zones.push({
          name: zoneName,
          code: props?.uq_cd || props?.prpos_area_cd,
        });
      }
    }

    // 용도지역 우선순위 정렬 (공업>상업>주거 순)
    const zonePriority: Record<string, number> = {
      "준공업지역": 1,
      "일반공업지역": 1,
      "전용공업지역": 1,
      "중심상업지역": 2,
      "일반상업지역": 2,
      "근린상업지역": 2,
      "유통상업지역": 2,
      "준주거지역": 3,
      "제3종일반주거지역": 4,
      "제2종일반주거지역": 5,
      "제1종일반주거지역": 6,
      "제2종전용주거지역": 7,
      "제1종전용주거지역": 8,
    };

    zones.sort((a, b) => {
      const priorityA = zonePriority[a.name] || 10;
      const priorityB = zonePriority[b.name] || 10;
      return priorityA - priorityB;
    });

    // 결과가 없으면 대체 데이터 소스 시도
    if (zones.length === 0) {
      console.log("[V-World API] 결과 없음, 대체 소스 시도...");
      return await getLandUseInfoFallback(x, y, VWORLD_KEY);
    }

    console.log(`[V-World API] 조회 결과: ${zones.map(z => z.name).join(", ")}`);
    return { success: true, zones };
  } catch (error: any) {
    console.error("[V-World API] 토지이용계획 조회 오류:", error);
    return { success: false, error: `API 호출 실패: ${error.message}` };
  }
}

// 대체 데이터 소스로 토지이용계획 조회 (용도지구 등)
async function getLandUseInfoFallback(x: number, y: number, apiKey: string): Promise<{
  success: boolean;
  zones?: ZoneInfo[];
  error?: string;
}> {
  try {
    // 여러 데이터 레이어 시도
    const dataLayers = [
      { code: "LT_C_UQ112", name: "용도지구" },
      { code: "LT_C_UQ113", name: "용도구역" },
      { code: "LT_C_ADSIDO_INFO", name: "행정구역" },
    ];

    const allZones: ZoneInfo[] = [];

    for (const layer of dataLayers) {
      const dataUrl = "https://api.vworld.kr/req/data";
      const params = new URLSearchParams({
        service: "data",
        request: "GetFeature",
        data: layer.code,
        key: apiKey,
        format: "json",
        geometry: "false",
        attribute: "true",
        crs: "EPSG:4326",
        domain: process.env.VWORLD_DOMAIN || "localhost",
        geomFilter: `POINT(${x} ${y})`,
        buffer: "10",  // 버퍼를 10m로 줄여서 정확도 향상
      });

      try {
        const response = await fetch(`${dataUrl}?${params}`);
        const data = await response.json();

        if (data.response?.status === "OK") {
          const features = data.response?.result?.featureCollection?.features || [];
          for (const feature of features) {
            const props = feature.properties;
            const zoneName = props?.uq_nm || props?.sig_kor_nm || props?.full_nm;
            if (zoneName) {
              allZones.push({
                name: zoneName,
                code: props?.uq_cd || props?.sig_cd,
              });
            }
          }
        }
      } catch (e) {
        console.warn(`[V-World API] ${layer.name} 조회 실패:`, e);
      }
    }

    if (allZones.length > 0) {
      return { success: true, zones: allZones };
    }

    return {
      success: false,
      error: "해당 위치의 토지이용계획 정보를 찾을 수 없습니다. 토지이음(eum.go.kr)에서 직접 확인해주세요.",
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 주소로 토지이용계획 종합 조회
export async function searchLandUse(address: string): Promise<LandUseResult> {
  // 1. 주소 → 좌표 변환
  const geoResult = await geocodeAddress(address);

  if (!geoResult.success || !geoResult.x || !geoResult.y) {
    return {
      success: false,
      error: geoResult.error || "주소를 찾을 수 없습니다.",
    };
  }

  // 2. 좌표 → 토지이용계획 조회
  const landResult = await getLandUseInfo(geoResult.x, geoResult.y);

  if (!landResult.success) {
    return {
      success: false,
      address: geoResult.refinedAddress,
      coordinates: { x: geoResult.x, y: geoResult.y },
      error: landResult.error,
    };
  }

  return {
    success: true,
    address: geoResult.refinedAddress,
    coordinates: { x: geoResult.x, y: geoResult.y },
    zoneInfo: landResult.zones,
  };
}

// 용도지역별 허용/제한 업종 정보
export const ZONE_BUSINESS_RESTRICTIONS: Record<string, {
  allowed: string[];
  restricted: string[];
  note: string;
}> = {
  "제1종전용주거지역": {
    allowed: ["단독주택", "공동주택(4층 이하)"],
    restricted: ["일반음식점", "숙박시설", "공장", "위락시설"],
    note: "주거 환경 보호를 위한 가장 엄격한 규제 지역",
  },
  "제2종전용주거지역": {
    allowed: ["단독주택", "공동주택"],
    restricted: ["일반음식점", "숙박시설", "공장", "위락시설"],
    note: "공동주택 중심의 양호한 주거환경 보호",
  },
  "제1종일반주거지역": {
    allowed: ["단독주택", "공동주택(4층 이하)", "근린생활시설(일부)"],
    restricted: ["숙박시설", "공장", "위락시설", "대형 판매시설"],
    note: "저층 주택 중심의 편리한 주거환경 조성",
  },
  "제2종일반주거지역": {
    allowed: ["단독주택", "공동주택", "근린생활시설", "휴게음식점"],
    restricted: ["숙박시설(일반)", "공장", "위락시설"],
    note: "중층 주택 중심의 주거환경 조성. 일부 근린시설 허용",
  },
  "제3종일반주거지역": {
    allowed: ["단독주택", "공동주택", "근린생활시설", "일반음식점"],
    restricted: ["공장", "위락시설"],
    note: "중고층 주택 중심의 주거환경. 근린시설 대부분 허용",
  },
  "준주거지역": {
    allowed: ["주거시설", "상업시설", "업무시설", "숙박시설(조건부)", "일반음식점"],
    restricted: ["공장", "위험물 저장시설"],
    note: "주거기능 위주에 상업·업무 기능 보완. 숙박업 가능",
  },
  "일반상업지역": {
    allowed: ["상업시설", "업무시설", "숙박시설", "주거시설", "근린생활시설"],
    restricted: ["공장", "위험물 저장시설"],
    note: "상업 및 업무 기능 중심. 대부분의 시설 허용",
  },
  "중심상업지역": {
    allowed: ["상업시설", "업무시설", "숙박시설", "문화시설"],
    restricted: ["주거시설(일부)", "공장"],
    note: "도심의 핵심 상업지역. 최대 용적률 적용",
  },
  "계획관리지역": {
    allowed: ["농업시설", "단독주택(조건부)", "근린생활시설(일부)"],
    restricted: ["대규모 시설", "공장(일부)"],
    note: "체계적 개발 유도. 숙박시설은 관광호텔 등 일부만 허용되는 경우 있음",
  },
  "생산관리지역": {
    allowed: ["농업시설", "창고", "소규모 공장"],
    restricted: ["대규모 시설", "숙박시설"],
    note: "농업 등 생산 활동 보호",
  },
  "보전관리지역": {
    allowed: ["농업시설(제한적)"],
    restricted: ["대부분의 건축물"],
    note: "자연환경 및 산림 보전. 개발 매우 제한적",
  },
};

// 토지이용계획 결과 포맷팅
export function formatLandUseResult(result: LandUseResult): string {
  if (!result.success) {
    return `❌ **토지이용계획 조회 실패**\n오류: ${result.error}`;
  }

  let output = `🗺️ **토지이용계획 조회 결과**\n\n`;
  output += `📍 **주소**: ${result.address || "알 수 없음"}\n`;

  if (result.coordinates) {
    output += `📐 **좌표**: ${result.coordinates.x.toFixed(6)}, ${result.coordinates.y.toFixed(6)}\n`;
  }

  output += `\n**📋 용도지역/지구 정보**\n`;

  if (!result.zoneInfo || result.zoneInfo.length === 0) {
    output += "- 조회된 용도지역 정보가 없습니다.\n";
  } else {
    for (const zone of result.zoneInfo) {
      output += `- **${zone.name}**\n`;

      // 용도지역별 제한 정보 추가
      const restrictions = ZONE_BUSINESS_RESTRICTIONS[zone.name];
      if (restrictions) {
        output += `  ✅ 허용: ${restrictions.allowed.join(", ")}\n`;
        output += `  ❌ 제한: ${restrictions.restricted.join(", ")}\n`;
        output += `  ℹ️ ${restrictions.note}\n`;
      }
    }
  }

  output += `\n🔗 [토지이음에서 상세 확인](https://www.eum.go.kr)\n`;
  output += `\n※ 본 정보는 참고용이며, 최종 판단은 관할 행정청 확인이 필요합니다.`;

  return output;
}
