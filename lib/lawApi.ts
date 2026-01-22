// 국가법령정보센터 API 연동

interface LawSearchResult {
  lawId: string;
  lawName: string;
  lawType: string;
  lawUrl: string;
  score?: number;
}

export interface FormSearchResult {
  formName: string;
  formUrl: string;
  lawName: string;
  lawPage: string;
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

// 주요 서식 매핑 (실제 다운로드 가능한 URL 사용)
export const COMMON_FORMS: Record<string, FormSearchResult> = {
  // 식품위생법
  "영업신고서": {
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=31137355",
    lawName: "식품위생법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259052&ancYnChk=0#AJAX",
  },
  "일반음식점": {
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=31137355",
    lawName: "식품위생법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259052&ancYnChk=0#AJAX",
  },
  "휴게음식점": {
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=31137355",
    lawName: "식품위생법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259052&ancYnChk=0#AJAX",
  },
  "카페": {
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=31137355",
    lawName: "식품위생법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259052&ancYnChk=0#AJAX",
  },

  // 관광진흥법
  "관광사업등록신청서": {
    formName: "관광사업 등록신청서 (별지 제1호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=92402671",
    lawName: "관광진흥법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=256815&ancYnChk=0#AJAX",
  },
  "사업계획승인신청서": {
    formName: "관광숙박업 사업계획승인신청서 (별지 제12호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=92402683",
    lawName: "관광진흥법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=256815&ancYnChk=0#AJAX",
  },
  "호텔업": {
    formName: "관광숙박업 사업계획승인신청서 (별지 제12호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=92402683",
    lawName: "관광진흥법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=256815&ancYnChk=0#AJAX",
  },
  "호스텔": {
    formName: "관광숙박업 사업계획승인신청서 (별지 제12호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=92402683",
    lawName: "관광진흥법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=256815&ancYnChk=0#AJAX",
  },

  // 공중위생관리법
  "숙박업신고서": {
    formName: "숙박업 신고서",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=89631951",
    lawName: "공중위생관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=247614&ancYnChk=0#AJAX",
  },
  "숙박업": {
    formName: "숙박업 신고서",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=89631951",
    lawName: "공중위생관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=247614&ancYnChk=0#AJAX",
  },

  // 건축법
  "건축허가신청서": {
    formName: "건축허가신청서 (별지 제1호의4서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=89579201",
    lawName: "건축법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=255543&ancYnChk=0#AJAX",
  },
  "건축신고서": {
    formName: "건축신고서 (별지 제6호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=89579206",
    lawName: "건축법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=255543&ancYnChk=0#AJAX",
  },
  "건축허가": {
    formName: "건축허가신청서 (별지 제1호의4서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=89579201",
    lawName: "건축법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=255543&ancYnChk=0#AJAX",
  },

  // 개발행위허가
  "개발행위허가신청서": {
    formName: "개발행위허가신청서 (별지 제9호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=89505009",
    lawName: "국토의계획및이용에관한법률시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=255008&ancYnChk=0#AJAX",
  },
  "개발행위허가": {
    formName: "개발행위허가신청서 (별지 제9호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=89505009",
    lawName: "국토의계획및이용에관한법률시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=255008&ancYnChk=0#AJAX",
  },

  // 산업집적활성화법 - 공장 관련
  "공장설립완료신고서": {
    formName: "공장설립등의 완료신고서 (별지 제7호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=47178000",
    lawName: "산업집적활성화및공장설립에관한법률시행규칙",
    lawPage: "https://www.law.go.kr/법령/산업집적활성화및공장설립에관한법률시행규칙",
  },
  "공장등록": {
    formName: "공장설립등의 완료신고서 (별지 제7호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=47178000",
    lawName: "산업집적활성화및공장설립에관한법률시행규칙",
    lawPage: "https://www.law.go.kr/법령/산업집적활성화및공장설립에관한법률시행규칙",
  },
  "공장설립승인": {
    formName: "공장설립등의 완료신고서 (별지 제7호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=47178000",
    lawName: "산업집적활성화및공장설립에관한법률시행규칙",
    lawPage: "https://www.law.go.kr/법령/산업집적활성화및공장설립에관한법률시행규칙",
  },
  "공장": {
    formName: "공장설립등의 완료신고서 (별지 제7호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=47178000",
    lawName: "산업집적활성화및공장설립에관한법률시행규칙",
    lawPage: "https://www.law.go.kr/법령/산업집적활성화및공장설립에관한법률시행규칙",
  },

  // 출입국관리법 - 비자/사증 관련
  "사증발급신청서": {
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=78206341",
    lawName: "출입국관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259424&ancYnChk=0#AJAX",
  },
  "비자발급신청서": {
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=78206341",
    lawName: "출입국관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259424&ancYnChk=0#AJAX",
  },
  "비자신청서": {
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=78206341",
    lawName: "출입국관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259424&ancYnChk=0#AJAX",
  },
  "F4비자": {
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=78206341",
    lawName: "출입국관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259424&ancYnChk=0#AJAX",
  },
  "재외동포비자": {
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=78206341",
    lawName: "출입국관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259424&ancYnChk=0#AJAX",
  },
  "사증발급인정신청서": {
    formName: "사증발급인정신청서 (별지 제21호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=134343385",
    lawName: "출입국관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259424&ancYnChk=0#AJAX",
  },
  "체류자격변경허가신청서": {
    formName: "체류자격변경허가신청서 (별지 제34호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=78206355",
    lawName: "출입국관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259424&ancYnChk=0#AJAX",
  },
  "체류기간연장허가신청서": {
    formName: "체류기간연장허가신청서 (별지 제34호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=78206355",
    lawName: "출입국관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259424&ancYnChk=0#AJAX",
  },
  "외국인등록신청서": {
    formName: "외국인등록신청서 (별지 제34호서식)",
    formUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=78206355",
    lawName: "출입국관리법시행규칙",
    lawPage: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=259424&ancYnChk=0#AJAX",
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
