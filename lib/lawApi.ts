// 국가법령정보센터 API 연동

const LAW_API_ID = process.env.LAW_API_ID || "duath1031";

interface LawSearchResult {
  lawId: string;
  lawName: string;
  lawType: string;
  lawUrl: string;
  lsiSeq?: string;  // 법령 일련번호 (서식 조회용)
  score?: number;
}

export interface FormSearchResult {
  formName: string;
  formUrl: string;
  lawName: string;
  lawPage: string;
  flSeq?: string;  // 서식 파일 일련번호
}

// =============================================================================
// API를 통한 서식 동적 검색
// =============================================================================

/**
 * 법령 서식(별지) 동적 검색
 * 국가법령정보센터 DRF API를 통해 실시간으로 최신 서식 정보 조회
 */
export async function searchFormFromApi(lawName: string, formKeyword?: string): Promise<{
  success: boolean;
  forms: FormSearchResult[];
  error?: string;
}> {
  try {
    // 1. 먼저 법령을 검색하여 lsiSeq(법령일련번호) 획득
    const searchUrl = `https://www.law.go.kr/DRF/lawSearch.do`;
    const params = new URLSearchParams({
      OC: LAW_API_ID,
      target: "law",
      type: "XML",
      query: lawName,
    });

    const lawResponse = await fetch(`${searchUrl}?${params}`, {
      headers: { "Accept": "application/xml" },
    });

    if (!lawResponse.ok) {
      throw new Error(`법령 검색 실패: ${lawResponse.status}`);
    }

    const lawXml = await lawResponse.text();

    // 법령 일련번호 추출
    const lsiSeqMatch = lawXml.match(/<법령일련번호>(\d+)<\/법령일련번호>/);
    if (!lsiSeqMatch) {
      // 법령을 찾지 못하면 검색 URL 반환
      return {
        success: true,
        forms: [{
          formName: `${lawName} 서식 검색`,
          formUrl: `https://www.law.go.kr/LSW/lsBylSc.do?menuId=8&query=${encodeURIComponent(lawName + (formKeyword ? ' ' + formKeyword : ''))}`,
          lawName: lawName,
          lawPage: `https://www.law.go.kr/LSW/lsSc.do?menuId=1&subMenuId=15&query=${encodeURIComponent(lawName)}#liBylSc`,
        }],
      };
    }

    const lsiSeq = lsiSeqMatch[1];

    // 2. 법령 서식(별지) 목록 조회
    const formUrl = `https://www.law.go.kr/DRF/lawService.do`;
    const formParams = new URLSearchParams({
      OC: LAW_API_ID,
      target: "lsBylInfoR",  // 법령별 별지서식 조회
      type: "XML",
      lsiSeq: lsiSeq,
    });

    const formResponse = await fetch(`${formUrl}?${formParams}`, {
      headers: { "Accept": "application/xml" },
    });

    if (!formResponse.ok) {
      throw new Error(`서식 조회 실패: ${formResponse.status}`);
    }

    const formXml = await formResponse.text();
    const forms: FormSearchResult[] = [];

    // 서식 정보 파싱 (별지서식 XML 구조에 맞게)
    // <별지서식>
    //   <서식명>...</서식명>
    //   <서식파일일련번호>...</서식파일일련번호>
    // </별지서식>
    const formMatches = formXml.matchAll(/<서식명>([^<]+)<\/서식명>[\s\S]*?<서식파일일련번호>(\d+)<\/서식파일일련번호>/g);

    for (const match of formMatches) {
      const formName = match[1].trim();
      const flSeq = match[2];

      // 키워드 필터링 (지정된 경우)
      if (formKeyword && !formName.includes(formKeyword)) {
        continue;
      }

      forms.push({
        formName: formName,
        formUrl: `https://www.law.go.kr/LSW/flDownload.do?flSeq=${flSeq}`,
        lawName: lawName,
        lawPage: `https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=${lsiSeq}#AJAX`,
        flSeq: flSeq,
      });
    }

    // 서식을 찾지 못한 경우 검색 페이지 URL 제공
    if (forms.length === 0) {
      forms.push({
        formName: `${lawName} 서식 검색`,
        formUrl: `https://www.law.go.kr/LSW/lsBylSc.do?menuId=8&query=${encodeURIComponent(lawName + (formKeyword ? ' ' + formKeyword : ''))}`,
        lawName: lawName,
        lawPage: `https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=${lsiSeq}#AJAX`,
      });
    }

    return { success: true, forms };
  } catch (error: any) {
    console.error("[lawApi] 서식 검색 오류:", error);
    // API 실패 시 검색 URL 반환
    return {
      success: true,
      forms: [{
        formName: `${lawName} 서식 검색`,
        formUrl: `https://www.law.go.kr/LSW/lsBylSc.do?menuId=8&query=${encodeURIComponent(lawName + (formKeyword ? ' ' + formKeyword : ''))}`,
        lawName: lawName,
        lawPage: `https://www.law.go.kr/LSW/lsSc.do?menuId=1&subMenuId=15&query=${encodeURIComponent(lawName)}#liBylSc`,
      }],
      error: error.message,
    };
  }
}

/**
 * 정부24 민원 서비스 검색 URL 생성
 * 정부24는 직접 API 접근이 제한적이므로 검색 페이지로 연결
 */
export function getGov24SearchUrl(serviceName: string): string {
  return `https://www.gov.kr/portal/service/serviceList?searchNm=${encodeURIComponent(serviceName)}`;
}

/**
 * 정부24 민원 안내 페이지 (민원 코드 기반)
 * CappBizCD가 유효한 경우 직접 연결
 */
export function getGov24DirectUrl(cappBizCD: string, highCtgCD: string = "A01010"): string {
  return `https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=${highCtgCD}&CappBizCD=${cappBizCD}`;
}

// 법령 검색
export async function searchLaw(query: string): Promise<{
  success: boolean;
  laws: LawSearchResult[];
  error?: string;
}> {
  try {
    const LAW_API_ID = process.env.LAW_API_ID || "duath1031";

    // 검색어 정제
    let cleanQuery = query;
    const removeKeywords = ["줘", "달라", "찾아줘", "알려줘", "보내줘", "다운", "?", "."];
    removeKeywords.forEach(k => {
      cleanQuery = cleanQuery.replace(k, "");
    });
    cleanQuery = cleanQuery.trim();

    const searchUrl = `https://www.law.go.kr/DRF/lawSearch.do`;
    const params = new URLSearchParams({
      OC: LAW_API_ID,
      target: "law",
      type: "XML",
      query: cleanQuery,
    });

    const response = await fetch(`${searchUrl}?${params}`, {
      headers: {
        "Accept": "application/xml",
      },
    });

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`);
    }

    const xmlText = await response.text();

    // XML 파싱 (간단한 정규식 사용)
    const laws: LawSearchResult[] = [];
    const lawMatches = xmlText.matchAll(/<법령ID>(\d+)<\/법령ID>[\s\S]*?<법령명한글>([^<]+)<\/법령명한글>[\s\S]*?<법령약칭명>([^<]*)<\/법령약칭명>/g);

    for (const match of lawMatches) {
      const lawId = match[1];
      const lawName = match[2];
      laws.push({
        lawId,
        lawName,
        lawType: "법령",
        // 한글 URL 대신 검색 URL 사용 (인코딩 문제 방지)
        lawUrl: `https://www.law.go.kr/LSW/lsSc.do?menuId=1&query=${encodeURIComponent(lawName)}`,
      });
    }

    // 결과가 없으면 검색 링크 제공
    if (laws.length === 0) {
      const directLink = `https://www.law.go.kr/LSW/lsSc.do?menuId=1&query=${encodeURIComponent(cleanQuery)}`;
      laws.push({
        lawId: "",
        lawName: cleanQuery,
        lawType: "검색",
        lawUrl: directLink,
      });
    }

    return { success: true, laws };
  } catch (error: any) {
    console.error("법령 검색 오류:", error);
    return {
      success: false,
      laws: [],
      error: error.message,
    };
  }
}

// 서식 다운로드 URL 생성
export function getFormDownloadUrl(formSeq: string): string {
  return `https://www.law.go.kr/LSW/flDownload.do?flSeq=${formSeq}`;
}

// 서식 검색 URL 생성 헬퍼 함수
function getFormSearchUrl(lawName: string, formKeyword: string = ""): string {
  const searchQuery = formKeyword ? `${lawName} ${formKeyword}` : lawName;
  return `https://www.law.go.kr/LSW/lsBylSc.do?menuId=8&query=${encodeURIComponent(searchQuery)}`;
}

// 법령 서식 페이지 URL 생성 헬퍼 함수
function getLawFormPageUrl(lawName: string): string {
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=1&subMenuId=15&query=${encodeURIComponent(lawName)}#liBylSc`;
}

// 주요 서식 매핑 (안정적인 검색 URL 사용)
export const COMMON_FORMS: Record<string, FormSearchResult> = {
  // 식품위생법
  "영업신고서": {
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: getFormSearchUrl("식품위생법시행규칙", "영업신고서"),
    lawName: "식품위생법시행규칙",
    lawPage: getLawFormPageUrl("식품위생법시행규칙"),
  },
  "일반음식점": {
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: getFormSearchUrl("식품위생법시행규칙", "영업신고서"),
    lawName: "식품위생법시행규칙",
    lawPage: getLawFormPageUrl("식품위생법시행규칙"),
  },
  "휴게음식점": {
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: getFormSearchUrl("식품위생법시행규칙", "영업신고서"),
    lawName: "식품위생법시행규칙",
    lawPage: getLawFormPageUrl("식품위생법시행규칙"),
  },
  "카페": {
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: getFormSearchUrl("식품위생법시행규칙", "영업신고서"),
    lawName: "식품위생법시행규칙",
    lawPage: getLawFormPageUrl("식품위생법시행규칙"),
  },

  // 관광진흥법
  "관광사업등록신청서": {
    formName: "관광사업 등록신청서 (별지 제1호서식)",
    formUrl: getFormSearchUrl("관광진흥법시행규칙", "등록신청서"),
    lawName: "관광진흥법시행규칙",
    lawPage: getLawFormPageUrl("관광진흥법시행규칙"),
  },
  "사업계획승인신청서": {
    formName: "관광숙박업 사업계획승인신청서 (별지 제12호서식)",
    formUrl: getFormSearchUrl("관광진흥법시행규칙", "사업계획승인"),
    lawName: "관광진흥법시행규칙",
    lawPage: getLawFormPageUrl("관광진흥법시행규칙"),
  },
  "호텔업": {
    formName: "관광숙박업 사업계획승인신청서 (별지 제12호서식)",
    formUrl: getFormSearchUrl("관광진흥법시행규칙", "사업계획승인"),
    lawName: "관광진흥법시행규칙",
    lawPage: getLawFormPageUrl("관광진흥법시행규칙"),
  },
  "호스텔": {
    formName: "관광숙박업 사업계획승인신청서 (별지 제12호서식)",
    formUrl: getFormSearchUrl("관광진흥법시행규칙", "사업계획승인"),
    lawName: "관광진흥법시행규칙",
    lawPage: getLawFormPageUrl("관광진흥법시행규칙"),
  },

  // 공중위생관리법
  "숙박업신고서": {
    formName: "숙박업 신고서",
    formUrl: getFormSearchUrl("공중위생관리법시행규칙", "숙박업"),
    lawName: "공중위생관리법시행규칙",
    lawPage: getLawFormPageUrl("공중위생관리법시행규칙"),
  },
  "숙박업": {
    formName: "숙박업 신고서",
    formUrl: getFormSearchUrl("공중위생관리법시행규칙", "숙박업"),
    lawName: "공중위생관리법시행규칙",
    lawPage: getLawFormPageUrl("공중위생관리법시행규칙"),
  },

  // 건축법
  "건축허가신청서": {
    formName: "건축허가신청서 (별지 제1호의4서식)",
    formUrl: getFormSearchUrl("건축법시행규칙", "건축허가"),
    lawName: "건축법시행규칙",
    lawPage: getLawFormPageUrl("건축법시행규칙"),
  },
  "건축신고서": {
    formName: "건축신고서 (별지 제6호서식)",
    formUrl: getFormSearchUrl("건축법시행규칙", "건축신고"),
    lawName: "건축법시행규칙",
    lawPage: getLawFormPageUrl("건축법시행규칙"),
  },
  "건축허가": {
    formName: "건축허가신청서 (별지 제1호의4서식)",
    formUrl: getFormSearchUrl("건축법시행규칙", "건축허가"),
    lawName: "건축법시행규칙",
    lawPage: getLawFormPageUrl("건축법시행규칙"),
  },

  // 개발행위허가
  "개발행위허가신청서": {
    formName: "개발행위허가신청서 (별지 제9호서식)",
    formUrl: getFormSearchUrl("국토의계획및이용에관한법률시행규칙", "개발행위"),
    lawName: "국토의계획및이용에관한법률시행규칙",
    lawPage: getLawFormPageUrl("국토의계획및이용에관한법률시행규칙"),
  },
  "개발행위허가": {
    formName: "개발행위허가신청서 (별지 제9호서식)",
    formUrl: getFormSearchUrl("국토의계획및이용에관한법률시행규칙", "개발행위"),
    lawName: "국토의계획및이용에관한법률시행규칙",
    lawPage: getLawFormPageUrl("국토의계획및이용에관한법률시행규칙"),
  },

  // 산업집적활성화법 - 공장 관련
  "공장설립완료신고서": {
    formName: "공장설립등의 완료신고서 (별지 제7호서식)",
    formUrl: getFormSearchUrl("산업집적활성화및공장설립에관한법률시행규칙", "완료신고"),
    lawName: "산업집적활성화및공장설립에관한법률시행규칙",
    lawPage: getLawFormPageUrl("산업집적활성화및공장설립에관한법률시행규칙"),
  },
  "공장등록": {
    formName: "공장설립등의 완료신고서 (별지 제7호서식)",
    formUrl: getFormSearchUrl("산업집적활성화및공장설립에관한법률시행규칙", "완료신고"),
    lawName: "산업집적활성화및공장설립에관한법률시행규칙",
    lawPage: getLawFormPageUrl("산업집적활성화및공장설립에관한법률시행규칙"),
  },
  "공장설립승인": {
    formName: "공장설립등의 완료신고서 (별지 제7호서식)",
    formUrl: getFormSearchUrl("산업집적활성화및공장설립에관한법률시행규칙", "완료신고"),
    lawName: "산업집적활성화및공장설립에관한법률시행규칙",
    lawPage: getLawFormPageUrl("산업집적활성화및공장설립에관한법률시행규칙"),
  },
  "공장": {
    formName: "공장설립등의 완료신고서 (별지 제7호서식)",
    formUrl: getFormSearchUrl("산업집적활성화및공장설립에관한법률시행규칙", "완료신고"),
    lawName: "산업집적활성화및공장설립에관한법률시행규칙",
    lawPage: getLawFormPageUrl("산업집적활성화및공장설립에관한법률시행규칙"),
  },

  // 출입국관리법 - 비자/사증 관련 (하이코리아 공식 서식 페이지로 연결)
  "사증발급신청서": {
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    lawName: "출입국관리법시행규칙",
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
  },
  "비자발급신청서": {
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    lawName: "출입국관리법시행규칙",
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
  },
  "비자신청서": {
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    lawName: "출입국관리법시행규칙",
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
  },
  "F4비자": {
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    lawName: "출입국관리법시행규칙",
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
  },
  "재외동포비자": {
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    lawName: "출입국관리법시행규칙",
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
  },
  "사증발급인정신청서": {
    formName: "사증발급인정신청서 (별지 제21호서식)",
    formUrl: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    lawName: "출입국관리법시행규칙",
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
  },
  "체류자격변경허가신청서": {
    formName: "체류자격변경허가신청서 (별지 제34호서식)",
    formUrl: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    lawName: "출입국관리법시행규칙",
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
  },
  "체류기간연장허가신청서": {
    formName: "체류기간연장허가신청서 (별지 제34호서식)",
    formUrl: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    lawName: "출입국관리법시행규칙",
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
  },
  "외국인등록신청서": {
    formName: "외국인등록신청서 (별지 제34호서식)",
    formUrl: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    lawName: "출입국관리법시행규칙",
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
  },
};

// 서식 검색
export function searchForm(keyword: string): FormSearchResult | null {
  const lowerKeyword = keyword.toLowerCase().replace(/\s/g, "");

  for (const [key, form] of Object.entries(COMMON_FORMS)) {
    if (lowerKeyword.includes(key.toLowerCase().replace(/\s/g, "")) ||
        key.toLowerCase().replace(/\s/g, "").includes(lowerKeyword)) {
      return form;
    }
  }

  return null;
}

// 법령 정보 포맷팅
export function formatLawInfo(laws: LawSearchResult[]): string {
  if (laws.length === 0) {
    return "관련 법령을 찾을 수 없습니다.";
  }

  let result = "📚 **관련 법령 정보**\n\n";

  for (const law of laws.slice(0, 5)) {
    result += `- **${law.lawName}**\n`;
    result += `  🔗 [법령 바로가기](${law.lawUrl})\n\n`;
  }

  return result;
}

// 서식 다운로드 정보 포맷팅
export function formatFormInfo(form: FormSearchResult): string {
  return `
📋 **신청 서식 안내**

**서식명**: ${form.formName}
**근거법령**: ${form.lawName}

🔗 **다운로드 링크**
- [서식 다운로드](${form.formUrl})
- [법령 서식 페이지](${form.lawPage})

※ 위 링크를 클릭하면 국가법령정보센터에서 서식을 다운로드할 수 있습니다.
`;
}
