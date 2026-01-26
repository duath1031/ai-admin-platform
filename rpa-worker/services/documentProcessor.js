/**
 * =============================================================================
 * Document Processor Service
 * =============================================================================
 * PDF, DOCX 등 문서에서 텍스트 추출
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');

/**
 * 파일 확장자로 문서 타입 판별
 * @param {string} filename
 * @returns {string}
 */
function getDocumentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.docx':
      return 'docx';
    case '.doc':
      return 'doc';
    case '.txt':
      return 'txt';
    case '.hwp':
      return 'hwp';
    default:
      return 'unknown';
  }
}

/**
 * PDF에서 텍스트 추출
 * @param {Buffer} buffer - PDF 파일 버퍼
 * @returns {Promise<{text: string, pages: Array<{pageNumber: number, text: string}>, metadata: Object}>}
 */
async function extractFromPdf(buffer) {
  try {
    const data = await pdfParse(buffer, {
      // 페이지별 텍스트 추출을 위한 커스텀 핸들러
      pagerender: function(pageData) {
        return pageData.getTextContent().then(function(textContent) {
          let text = '';
          let lastY = null;

          for (const item of textContent.items) {
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
              text += '\n';
            }
            text += item.str;
            lastY = item.transform[5];
          }

          return text;
        });
      }
    });

    // 페이지별로 분리 (pdf-parse는 기본적으로 페이지 정보를 제공하지 않음)
    // 단순히 전체 텍스트를 청크로 처리
    const pages = [{
      pageNumber: 1,
      text: data.text
    }];

    return {
      text: data.text,
      pages,
      metadata: {
        numPages: data.numpages,
        info: data.info,
        version: data.version,
      }
    };
  } catch (error) {
    console.error('[DocumentProcessor] PDF extraction error:', error);
    throw new Error(`PDF 텍스트 추출 실패: ${error.message}`);
  }
}

/**
 * DOCX에서 텍스트 추출
 * @param {Buffer} buffer - DOCX 파일 버퍼
 * @returns {Promise<{text: string, sections: Array<{title?: string, content: string}>}>}
 */
async function extractFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });

    // 섹션 분리 (제목 패턴 기반)
    const text = result.value;
    const sections = parseDocxSections(text);

    return {
      text,
      sections,
      metadata: {
        messages: result.messages,
      }
    };
  } catch (error) {
    console.error('[DocumentProcessor] DOCX extraction error:', error);
    throw new Error(`DOCX 텍스트 추출 실패: ${error.message}`);
  }
}

/**
 * DOCX 텍스트를 섹션으로 분리
 * @param {string} text
 * @returns {Array<{title?: string, content: string}>}
 */
function parseDocxSections(text) {
  // 제목 패턴: 숫자. 또는 제N장 또는 [제목] 등
  const sectionPatterns = [
    /^(제\d+[장조절항]\.?\s*.+)$/gm,
    /^(\d+\.\s*.+)$/gm,
    /^(【.+】)$/gm,
    /^(\[.+\])$/gm,
  ];

  const sections = [];
  const lines = text.split('\n');
  let currentSection = { content: '' };

  for (const line of lines) {
    let isTitle = false;

    for (const pattern of sectionPatterns) {
      if (pattern.test(line)) {
        // 이전 섹션 저장
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }
        // 새 섹션 시작
        currentSection = {
          title: line.trim(),
          content: ''
        };
        isTitle = true;
        pattern.lastIndex = 0; // 정규식 상태 리셋
        break;
      }
      pattern.lastIndex = 0;
    }

    if (!isTitle) {
      currentSection.content += line + '\n';
    }
  }

  // 마지막 섹션 저장
  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }

  // 섹션이 없으면 전체를 하나의 섹션으로
  if (sections.length === 0) {
    sections.push({ content: text });
  }

  return sections;
}

/**
 * TXT에서 텍스트 추출
 * @param {Buffer} buffer
 * @returns {Promise<{text: string}>}
 */
async function extractFromTxt(buffer) {
  const text = buffer.toString('utf-8');
  return { text };
}

/**
 * 문서에서 텍스트 추출 (통합 인터페이스)
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} filename - 파일명
 * @returns {Promise<{text: string, pages?: Array, sections?: Array, metadata?: Object}>}
 */
async function extractText(buffer, filename) {
  const docType = getDocumentType(filename);

  console.log(`[DocumentProcessor] Extracting text from ${filename} (type: ${docType})`);

  switch (docType) {
    case 'pdf':
      return await extractFromPdf(buffer);

    case 'docx':
      return await extractFromDocx(buffer);

    case 'txt':
      return await extractFromTxt(buffer);

    case 'hwp':
      // HWP는 별도 라이브러리 필요 - 현재는 미지원
      throw new Error('HWP 형식은 현재 지원하지 않습니다. PDF 또는 DOCX로 변환 후 업로드해주세요.');

    default:
      throw new Error(`지원하지 않는 파일 형식입니다: ${path.extname(filename)}`);
  }
}

/**
 * 추출된 텍스트 정리
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
  return text
    // 연속 공백 제거
    .replace(/[ \t]+/g, ' ')
    // 연속 줄바꿈 정리
    .replace(/\n{3,}/g, '\n\n')
    // 특수 문자 정리
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * 파일 크기 확인 (MB 단위)
 * @param {Buffer} buffer
 * @returns {number}
 */
function getFileSizeMB(buffer) {
  return buffer.length / (1024 * 1024);
}

module.exports = {
  extractText,
  extractFromPdf,
  extractFromDocx,
  extractFromTxt,
  getDocumentType,
  cleanText,
  getFileSizeMB,
};
