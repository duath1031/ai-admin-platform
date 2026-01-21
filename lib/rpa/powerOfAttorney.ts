// =============================================================================
// [Patent Technology] Electronic Power of Attorney (전자위임장) System
// =============================================================================
// This module provides:
// 1. Secure creation of electronic power of attorney documents
// 2. Digital signature capture and verification
// 3. Hash-based integrity validation
// 4. Delegation scope management for government services
// =============================================================================

import { createHash, randomBytes } from 'crypto';
import prisma from '@/lib/prisma';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface DelegatorInfo {
  name: string;           // 위임자 이름
  birthDate: string;      // 생년월일 (YYYYMMDD)
  phone: string;          // 연락처
  idNumber: string;       // 주민등록번호 (암호화하여 해시만 저장)
  address?: string;       // 주소 (선택)
}

export interface DelegationScope {
  serviceType: 'gov24' | 'hometax' | 'wetax' | 'minwon' | 'other';
  serviceName: string;    // 민원명
  serviceCode?: string;   // 민원 코드
  purposes: string[];     // 위임 목적 (열람, 발급, 제출 등)
  restrictions?: string[];// 제한 사항
}

export interface SignatureData {
  imageData: string;      // Base64 encoded signature image
  timestamp: Date;        // 서명 시간
  deviceInfo?: string;    // 서명 기기 정보
  ipAddress?: string;     // IP 주소
}

export interface PowerOfAttorneyCreateInput {
  delegator: DelegatorInfo;
  scope: DelegationScope;
  signature: SignatureData;
  validityDays?: number;  // 유효 기간 (일), 기본 30일
  userId: string;         // 대리인(행정사) ID
}

export interface PowerOfAttorneyDocument {
  id: string;
  documentNumber: string; // 위임장 번호
  delegatorName: string;
  serviceName: string;
  status: string;
  validFrom: Date;
  validTo: Date;
  createdAt: Date;
}

// =============================================================================
// Hash and Security Utilities
// =============================================================================

/**
 * 주민등록번호를 안전하게 해시화 (복호화 불가)
 * Salt를 포함하여 레인보우 테이블 공격 방지
 */
export function hashIdNumber(idNumber: string): string {
  const salt = process.env.ID_HASH_SALT || 'admini-secure-salt-2024';
  const normalized = idNumber.replace(/-/g, '');
  return createHash('sha256')
    .update(salt + normalized)
    .digest('hex');
}

/**
 * 서명 데이터의 무결성 해시 생성
 */
export function generateSignatureHash(signatureData: string, timestamp: Date): string {
  const data = signatureData + timestamp.toISOString();
  return createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * 위임장 문서 번호 생성
 * Format: POA-YYYYMMDD-XXXXXX
 */
export function generateDocumentNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `POA-${dateStr}-${random}`;
}

// =============================================================================
// Power of Attorney Service Class
// =============================================================================

export class PowerOfAttorneyService {

  /**
   * 새 전자위임장 생성
   */
  async create(input: PowerOfAttorneyCreateInput): Promise<PowerOfAttorneyDocument> {
    const { delegator, scope, signature, validityDays = 30, userId } = input;

    // 유효기간 계산
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + validityDays);

    // 주민번호 해시화
    const idHash = hashIdNumber(delegator.idNumber);

    // 서명 해시 생성
    const signatureHash = generateSignatureHash(signature.imageData, signature.timestamp);

    // 위임 범위 JSON
    const delegationScopeJson = JSON.stringify({
      purposes: scope.purposes,
      restrictions: scope.restrictions || [],
      deviceInfo: signature.deviceInfo,
      ipAddress: signature.ipAddress,
    });

    // 데이터베이스에 저장
    const poa = await prisma.powerOfAttorney.create({
      data: {
        delegatorName: delegator.name,
        delegatorBirth: delegator.birthDate,
        delegatorPhone: delegator.phone,
        delegatorIdHash: idHash,
        delegatorAddress: delegator.address,
        serviceType: scope.serviceType,
        serviceName: scope.serviceName,
        serviceCode: scope.serviceCode,
        delegationScope: delegationScopeJson,
        signatureData: signature.imageData,
        signatureHash: signatureHash,
        signedAt: signature.timestamp,
        validFrom: validFrom,
        validTo: validTo,
        status: 'active',
        userId: userId,
      },
    });

    return {
      id: poa.id,
      documentNumber: generateDocumentNumber(),
      delegatorName: poa.delegatorName,
      serviceName: poa.serviceName,
      status: poa.status,
      validFrom: poa.validFrom,
      validTo: poa.validTo,
      createdAt: poa.createdAt,
    };
  }

  /**
   * 위임장 유효성 검증
   */
  async verify(poaId: string): Promise<{
    isValid: boolean;
    reason?: string;
    poa?: PowerOfAttorneyDocument;
  }> {
    const poa = await prisma.powerOfAttorney.findUnique({
      where: { id: poaId },
    });

    if (!poa) {
      return { isValid: false, reason: '위임장을 찾을 수 없습니다.' };
    }

    // 상태 확인
    if (poa.status !== 'active') {
      return {
        isValid: false,
        reason: `위임장 상태가 유효하지 않습니다: ${poa.status}`
      };
    }

    // 유효기간 확인
    const now = new Date();
    if (now < poa.validFrom) {
      return { isValid: false, reason: '위임장 유효기간이 아직 시작되지 않았습니다.' };
    }
    if (now > poa.validTo) {
      // 만료 처리
      await this.expire(poaId);
      return { isValid: false, reason: '위임장 유효기간이 만료되었습니다.' };
    }

    // 서명 무결성 검증
    const expectedHash = generateSignatureHash(poa.signatureData, poa.signedAt);
    if (expectedHash !== poa.signatureHash) {
      return { isValid: false, reason: '서명 데이터가 손상되었습니다.' };
    }

    return {
      isValid: true,
      poa: {
        id: poa.id,
        documentNumber: generateDocumentNumber(),
        delegatorName: poa.delegatorName,
        serviceName: poa.serviceName,
        status: poa.status,
        validFrom: poa.validFrom,
        validTo: poa.validTo,
        createdAt: poa.createdAt,
      },
    };
  }

  /**
   * 위임장 취소
   */
  async revoke(poaId: string, reason: string): Promise<void> {
    await prisma.powerOfAttorney.update({
      where: { id: poaId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  /**
   * 위임장 만료 처리
   */
  async expire(poaId: string): Promise<void> {
    await prisma.powerOfAttorney.update({
      where: { id: poaId },
      data: {
        status: 'expired',
      },
    });
  }

  /**
   * 위임장 사용 처리 (민원 제출 시)
   */
  async markAsUsed(poaId: string): Promise<void> {
    await prisma.powerOfAttorney.update({
      where: { id: poaId },
      data: {
        status: 'used',
      },
    });
  }

  /**
   * 사용자의 위임장 목록 조회
   */
  async listByUser(userId: string, options?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: PowerOfAttorneyDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { status, page = 1, limit = 10 } = options || {};

    const where = {
      userId,
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      prisma.powerOfAttorney.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.powerOfAttorney.count({ where }),
    ]);

    return {
      items: items.map(poa => ({
        id: poa.id,
        documentNumber: generateDocumentNumber(),
        delegatorName: poa.delegatorName,
        serviceName: poa.serviceName,
        status: poa.status,
        validFrom: poa.validFrom,
        validTo: poa.validTo,
        createdAt: poa.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 특정 서비스에 대한 유효한 위임장 조회
   */
  async findValidForService(
    userId: string,
    serviceType: string,
    serviceName: string
  ): Promise<PowerOfAttorneyDocument | null> {
    const now = new Date();

    const poa = await prisma.powerOfAttorney.findFirst({
      where: {
        userId,
        serviceType,
        serviceName,
        status: 'active',
        validFrom: { lte: now },
        validTo: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!poa) return null;

    return {
      id: poa.id,
      documentNumber: generateDocumentNumber(),
      delegatorName: poa.delegatorName,
      serviceName: poa.serviceName,
      status: poa.status,
      validFrom: poa.validFrom,
      validTo: poa.validTo,
      createdAt: poa.createdAt,
    };
  }

  /**
   * 만료된 위임장 일괄 처리 (배치 작업용)
   */
  async processExpiredPOAs(): Promise<number> {
    const now = new Date();

    const result = await prisma.powerOfAttorney.updateMany({
      where: {
        status: 'active',
        validTo: { lt: now },
      },
      data: {
        status: 'expired',
      },
    });

    return result.count;
  }
}

// =============================================================================
// [Patent Technology] POA Document Generator
// 전자위임장 문서 생성기
// =============================================================================

export interface POADocumentContent {
  title: string;
  delegatorSection: string;
  agentSection: string;
  scopeSection: string;
  validitySection: string;
  signatureSection: string;
  legalNotice: string;
}

export function generatePOADocumentContent(
  delegator: DelegatorInfo,
  scope: DelegationScope,
  agentName: string,
  validFrom: Date,
  validTo: Date
): POADocumentContent {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const serviceTypeNames: Record<string, string> = {
    gov24: '정부24',
    hometax: '홈택스',
    wetax: '위택스',
    minwon: '민원24',
    other: '기타',
  };

  return {
    title: '위 임 장',

    delegatorSection: `
위임인(본인)
성    명: ${delegator.name}
생년월일: ${delegator.birthDate.substring(0, 4)}년 ${delegator.birthDate.substring(4, 6)}월 ${delegator.birthDate.substring(6, 8)}일
연 락 처: ${delegator.phone}
${delegator.address ? `주    소: ${delegator.address}` : ''}
    `.trim(),

    agentSection: `
수임인(대리인)
성    명: ${agentName}
자    격: 행정사
    `.trim(),

    scopeSection: `
위임 내용
1. 위임 사무: ${scope.serviceName}
2. 처리 기관: ${serviceTypeNames[scope.serviceType] || scope.serviceType}
3. 위임 범위: ${scope.purposes.join(', ')}
${scope.serviceCode ? `4. 민원 코드: ${scope.serviceCode}` : ''}
${scope.restrictions && scope.restrictions.length > 0 ? `5. 제한 사항: ${scope.restrictions.join(', ')}` : ''}
    `.trim(),

    validitySection: `
유효 기간
- 시작일: ${formatDate(validFrom)}
- 종료일: ${formatDate(validTo)}
    `.trim(),

    signatureSection: `
위와 같이 위임합니다.

${formatDate(new Date())}

위임인: ${delegator.name} (서명)
    `.trim(),

    legalNotice: `
[법적 고지]
본 위임장은 「행정사법」 및 관련 법령에 따라 작성되었으며,
전자문서 및 전자거래 기본법에 의해 법적 효력을 가집니다.
위임인의 전자서명이 포함되어 있으며, 위·변조 방지를 위한
해시값이 기록됩니다.
    `.trim(),
  };
}

// =============================================================================
// Service Instance Export
// =============================================================================

export const powerOfAttorneyService = new PowerOfAttorneyService();
