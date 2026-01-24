// 공공데이터포털 건축물대장 API 연동
// https://www.data.go.kr/data/15044713/openapi.do

interface BuildingInfo {
  success: boolean;
  address?: string;
  buildingName?: string;
  mainPurpose?: string;        // 주용도
  detailPurpose?: string;      // 세부용도
  structure?: string;          // 구조
  roofType?: string;           // 지붕
  groundFloor?: number;        // 지상층수
  undergroundFloor?: number;   // 지하층수
  totalArea?: number;          // 연면적 (㎡)
  buildingArea?: number;       // 건축면적 (㎡)
  landArea?: number;           // 대지면적 (㎡)
  buildingCoverageRatio?: number; // 건폐율 (%)
  floorAreaRatio?: number;     // 용적률 (%)
  approvalDate?: string;       // 사용승인일
  violationStatus?: string;    // 위반건축물 여부
  elevatorCount?: number;      // 승강기수
  parkingCount?: number;       // 주차대수
  error?: string;
}

interface AddressSearchResult {
  success: boolean;
  sigunguCd?: string;    // 시군구코드
  bjdongCd?: string;     // 법정동코드
  bun?: string;          // 본번
  ji?: string;           // 부번
  platGbCd?: string;     // 대지구분코드 (0:대지, 1:산, 2:블록)
  error?: string;
}

// 주소를 법정동코드/본번/부번으로 변환 (V-World Geocoding 활용)
async function parseAddressToCode(address: string): Promise<AddressSearchResult> {
  try {
    const VWORLD_KEY = process.env.VWORLD_KEY;

    if (!VWORLD_KEY) {
      return { success: false, error: "V-World API 키가 설정되지 않았습니다." };
    }

    // V-World 지오코딩으로 주소 정규화 및 좌표 획득
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

    let response = await fetch(`${geoUrl}?${params}`);
    let data = await response.json();

    // 도로명주소 실패 시 지번주소로 재시도
    if (data.response?.status !== "OK") {
      params.set("type", "parcel");
      response = await fetch(`${geoUrl}?${params}`);
      data = await response.json();
    }

    if (data.response?.status !== "OK") {
      return { success: false, error: "주소를 찾을 수 없습니다." };
    }

    const result = data.response.result;
    const refinedAddr = result.text;

    // 좌표로 법정동코드 조회
    const x = parseFloat(result.point.x);
    const y = parseFloat(result.point.y);

    const codeResult = await getBjdongCodeByCoord(x, y, VWORLD_KEY);

    if (!codeResult.success) {
      return { success: false, error: codeResult.error };
    }

    // 본번/부번 추출 (지번에서)
    const bunjiMatch = refinedAddr.match(/(\d+)(?:-(\d+))?(?:번지)?$/);
    const bun = bunjiMatch ? bunjiMatch[1].padStart(4, '0') : '0001';
    const ji = bunjiMatch && bunjiMatch[2] ? bunjiMatch[2].padStart(4, '0') : '0000';

    return {
      success: true,
      sigunguCd: codeResult.sigunguCd,
      bjdongCd: codeResult.bjdongCd,
      bun,
      ji,
      platGbCd: '0', // 기본값: 대지
    };
  } catch (error: any) {
    console.error("[BuildingAPI] 주소 파싱 오류:", error);
    return { success: false, error: error.message };
  }
}

// 좌표로 법정동코드 조회
async function getBjdongCodeByCoord(x: number, y: number, apiKey: string): Promise<{
  success: boolean;
  sigunguCd?: string;
  bjdongCd?: string;
  error?: string;
}> {
  try {
    const dataUrl = "https://api.vworld.kr/req/data";
    const params = new URLSearchParams({
      service: "data",
      request: "GetFeature",
      data: "LT_C_ADEMD_INFO", // 행정동 정보
      key: apiKey,
      format: "json",
      geometry: "false",
      attribute: "true",
      crs: "EPSG:4326",
      domain: "localhost",
      geomFilter: `POINT(${x} ${y})`,
      buffer: "1",
    });

    const response = await fetch(`${dataUrl}?${params}`);
    const data = await response.json();

    if (data.response?.status !== "OK") {
      // 법정동 레이어로 재시도
      params.set("data", "LT_C_ADSIGG_INFO");
      const retryResponse = await fetch(`${dataUrl}?${params}`);
      const retryData = await retryResponse.json();

      if (retryData.response?.status === "OK") {
        const features = retryData.response?.result?.featureCollection?.features || [];
        if (features.length > 0) {
          const props = features[0].properties;
          const sigCd = props.sig_cd || props.adm_cd?.substring(0, 5);
          return {
            success: true,
            sigunguCd: sigCd,
            bjdongCd: sigCd + "00000", // 임시
          };
        }
      }

      return { success: false, error: "법정동 코드를 찾을 수 없습니다." };
    }

    const features = data.response?.result?.featureCollection?.features || [];
    if (features.length === 0) {
      return { success: false, error: "해당 위치의 행정구역 정보가 없습니다." };
    }

    const props = features[0].properties;
    const admCd = props.emd_cd || props.adm_cd;

    return {
      success: true,
      sigunguCd: admCd?.substring(0, 5),
      bjdongCd: admCd,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 건축물대장 표제부 조회
export async function searchBuilding(address: string): Promise<BuildingInfo> {
  try {
    const PUBLIC_DATA_KEY = process.env.PUBLIC_DATA_KEY;

    if (!PUBLIC_DATA_KEY) {
      console.error("[BuildingAPI] PUBLIC_DATA_KEY 미설정");
      return { success: false, error: "공공데이터 API 키가 설정되지 않았습니다." };
    }

    console.log(`[BuildingAPI] 건축물대장 조회 시작: "${address}"`);

    // 1. 주소 → 법정동코드/본번/부번 변환
    const addrResult = await parseAddressToCode(address);
    if (!addrResult.success) {
      console.log(`[BuildingAPI] 주소 파싱 실패: ${addrResult.error}`);
      return { success: false, address, error: addrResult.error };
    }

    console.log(`[BuildingAPI] 주소코드: 시군구=${addrResult.sigunguCd}, 법정동=${addrResult.bjdongCd}, 본번=${addrResult.bun}, 부번=${addrResult.ji}`);

    // 2. 건축물대장 표제부 API 호출
    // https://www.data.go.kr/data/15044713/openapi.do (건축물대장정보 서비스)
    const apiUrl = "http://apis.data.go.kr/1613000/BldRgstService_v2/getBrTitleInfo";
    const params = new URLSearchParams({
      serviceKey: PUBLIC_DATA_KEY,
      sigunguCd: addrResult.sigunguCd || '',
      bjdongCd: addrResult.bjdongCd || '',
      bun: addrResult.bun || '',
      ji: addrResult.ji || '',
      platGbCd: addrResult.platGbCd || '0',
      numOfRows: '10',
      pageNo: '1',
      _type: 'json',
    });

    console.log(`[BuildingAPI] API 호출: ${apiUrl}`);

    const response = await fetch(`${apiUrl}?${params}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error(`[BuildingAPI] API 오류: ${response.status}`);
      return { success: false, address, error: `API 서버 오류 (${response.status})` };
    }

    const data = await response.json();
    console.log(`[BuildingAPI] API 응답:`, JSON.stringify(data).substring(0, 500));

    // 응답 파싱
    const items = data.response?.body?.items?.item;
    if (!items || (Array.isArray(items) && items.length === 0)) {
      console.log(`[BuildingAPI] 건축물대장 정보 없음`);
      return {
        success: false,
        address,
        error: "해당 주소의 건축물대장 정보가 없습니다. 미등기 건물이거나 주소가 정확하지 않을 수 있습니다."
      };
    }

    // 첫 번째 (대표) 건물 정보
    const building = Array.isArray(items) ? items[0] : items;

    return {
      success: true,
      address: building.platPlc || building.newPlatPlc || address,
      buildingName: building.bldNm || undefined,
      mainPurpose: building.mainPurpsCdNm || building.mainPurpsCd,
      detailPurpose: building.etcPurps || undefined,
      structure: building.strctCdNm || building.strctCd,
      roofType: building.roofCdNm || building.roofCd,
      groundFloor: building.grndFlrCnt ? parseInt(building.grndFlrCnt) : undefined,
      undergroundFloor: building.ugrndFlrCnt ? parseInt(building.ugrndFlrCnt) : undefined,
      totalArea: building.totArea ? parseFloat(building.totArea) : undefined,
      buildingArea: building.archArea ? parseFloat(building.archArea) : undefined,
      landArea: building.platArea ? parseFloat(building.platArea) : undefined,
      buildingCoverageRatio: building.bcRat ? parseFloat(building.bcRat) : undefined,
      floorAreaRatio: building.vlRat ? parseFloat(building.vlRat) : undefined,
      approvalDate: building.useAprDay || undefined,
      violationStatus: building.vltnGbCdNm || (building.vltnGbCd === '1' ? '위반건축물' : '정상'),
      elevatorCount: building.rideUseElvtCnt ? parseInt(building.rideUseElvtCnt) : undefined,
      parkingCount: building.indrAutoUtcnt || building.oudrAutoUtcnt
        ? (parseInt(building.indrAutoUtcnt || '0') + parseInt(building.oudrAutoUtcnt || '0'))
        : undefined,
    };
  } catch (error: any) {
    console.error("[BuildingAPI] 건축물대장 조회 오류:", error);
    return { success: false, address, error: `조회 실패: ${error.message}` };
  }
}

// 건축물대장 결과 포맷팅
export function formatBuildingResult(result: BuildingInfo): string {
  if (!result.success) {
    return `❌ **건축물대장 조회 실패**\n주소: ${result.address || '알 수 없음'}\n오류: ${result.error}`;
  }

  let output = `🏢 **건축물대장 조회 결과**\n\n`;
  output += `📍 **주소**: ${result.address}\n`;

  if (result.buildingName) {
    output += `🏷️ **건물명**: ${result.buildingName}\n`;
  }

  output += `\n**📋 건물 정보**\n`;
  output += `- **주용도**: ${result.mainPurpose || '정보 없음'}`;
  if (result.detailPurpose) {
    output += ` (${result.detailPurpose})`;
  }
  output += `\n`;

  if (result.structure) {
    output += `- **구조**: ${result.structure}\n`;
  }

  if (result.groundFloor || result.undergroundFloor) {
    output += `- **층수**: 지상 ${result.groundFloor || 0}층`;
    if (result.undergroundFloor) {
      output += ` / 지하 ${result.undergroundFloor}층`;
    }
    output += `\n`;
  }

  output += `\n**📐 면적 정보**\n`;
  if (result.landArea) {
    output += `- **대지면적**: ${result.landArea.toLocaleString()}㎡\n`;
  }
  if (result.buildingArea) {
    output += `- **건축면적**: ${result.buildingArea.toLocaleString()}㎡\n`;
  }
  if (result.totalArea) {
    output += `- **연면적**: ${result.totalArea.toLocaleString()}㎡\n`;
  }
  if (result.buildingCoverageRatio) {
    output += `- **건폐율**: ${result.buildingCoverageRatio.toFixed(2)}%\n`;
  }
  if (result.floorAreaRatio) {
    output += `- **용적률**: ${result.floorAreaRatio.toFixed(2)}%\n`;
  }

  output += `\n**🔍 기타 정보**\n`;
  if (result.approvalDate) {
    const year = result.approvalDate.substring(0, 4);
    const month = result.approvalDate.substring(4, 6);
    const day = result.approvalDate.substring(6, 8);
    output += `- **사용승인일**: ${year}년 ${month}월 ${day}일\n`;
  }

  if (result.violationStatus) {
    const isViolation = result.violationStatus.includes('위반');
    output += `- **위반건축물**: ${isViolation ? '⚠️ ' : ''}${result.violationStatus}\n`;
  }

  if (result.parkingCount !== undefined) {
    output += `- **주차대수**: ${result.parkingCount}대\n`;
  }
  if (result.elevatorCount !== undefined) {
    output += `- **승강기**: ${result.elevatorCount}대\n`;
  }

  output += `\n🔗 [세움터에서 상세 확인](https://cloud.eais.go.kr/)`;
  output += `\n※ 본 정보는 참고용이며, 최종 확인은 관할 행정청에서 필요합니다.`;

  return output;
}

// 용도변경 가능 여부 판단 (간이)
export function checkPurposeChangeability(
  currentPurpose: string | undefined,
  targetPurpose: string
): { possible: boolean; note: string } {
  if (!currentPurpose) {
    return { possible: false, note: "현재 용도 정보가 없어 판단이 어렵습니다." };
  }

  // 숙박시설 관련 용도 체크
  const accommodationPurposes = ['숙박시설', '호텔', '여관', '여인숙', '모텔', '호스텔', '민박'];
  const isCurrentAccommodation = accommodationPurposes.some(p => currentPurpose.includes(p));
  const isTargetAccommodation = accommodationPurposes.some(p => targetPurpose.includes(p));

  if (isCurrentAccommodation && isTargetAccommodation) {
    return { possible: true, note: "동일 시설군 내 변경으로 신고 처리 가능할 수 있습니다." };
  }

  // 근린생활시설 → 숙박시설
  if (currentPurpose.includes('근린생활시설') && isTargetAccommodation) {
    return {
      possible: true,
      note: "근린생활시설에서 숙박시설로의 용도변경은 허가 사항입니다. 용도지역 및 건축법 검토가 필요합니다."
    };
  }

  // 주거시설 → 숙박시설
  if ((currentPurpose.includes('주택') || currentPurpose.includes('주거')) && isTargetAccommodation) {
    return {
      possible: true,
      note: "주거시설에서 숙박시설로의 용도변경은 허가 사항이며, 용도지역에 따라 불가할 수 있습니다."
    };
  }

  return {
    possible: true,
    note: `${currentPurpose}에서 ${targetPurpose}(으)로의 용도변경 가능 여부는 용도지역 및 건축법 검토가 필요합니다.`
  };
}
