// =============================================================================
// [Patent Technology] Civil Service Submission RPA Module
// =============================================================================
//
// AI-Powered Automated Civil Service Application System
// Delegates browser automation to Railway RPA Worker
//
// [Architecture]
// Vercel (this module) → Railway Worker (Playwright) → Gov24/Hometax/etc
//
// [Security Considerations]
// - 위임장 유효성 검증 필수
// - 민감 정보는 메모리에서만 사용
// - 모든 단계 스크린샷/로그 기록
//
// @author AI Admin Platform
// @version 2.0.0
// =============================================================================

import prisma from '@/lib/prisma';
import { powerOfAttorneyService } from './powerOfAttorney';

// =============================================================================
// Type Definitions
// =============================================================================

export type TargetSite = 'gov24' | 'hometax' | 'wetax' | 'minwon';
export type SubmissionStatus = 'draft' | 'pending' | 'submitted' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ApplicationField {
  fieldId: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'radio' | 'file';
  value: string | boolean | string[];
  required: boolean;
  selector?: string;
}

export interface SubmissionInput {
  userId: string;
  serviceName: string;
  serviceCode?: string;
  targetSite: TargetSite;
  targetUrl?: string;
  applicantName: string;
  applicantBirth?: string;
  applicantPhone?: string;
  applicationData: ApplicationField[];
  powerOfAttorneyId?: string;
}

export interface SubmissionResult {
  success: boolean;
  submissionId: string;
  status: SubmissionStatus;
  applicationNumber?: string;
  message: string;
  error?: string;
}

export interface TrackingStep {
  step: string;
  stepOrder: number;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'skipped';
  message?: string;
  screenshotUrl?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
}

// =============================================================================
// Constants
// =============================================================================

const WORKER_URL = process.env.RPA_WORKER_URL || 'https://admini-rpa-worker-production.up.railway.app';
const WORKER_API_KEY = process.env.RPA_WORKER_API_KEY || 'admini-rpa-worker-2024-secure-key';
const WORKER_TIMEOUT = 120_000; // 2분

const SUBMISSION_STEPS = [
  { step: 'initialize', stepOrder: 1, name: '초기화' },
  { step: 'verify_poa', stepOrder: 2, name: '위임장 검증' },
  { step: 'login', stepOrder: 3, name: '인증 확인' },
  { step: 'submit_to_worker', stepOrder: 4, name: 'RPA 워커 전송' },
  { step: 'worker_processing', stepOrder: 5, name: '민원 처리 중' },
  { step: 'confirm', stepOrder: 6, name: '접수 확인' },
];

// =============================================================================
// Progress Callback Type
// =============================================================================

export type ProgressCallback = (progress: {
  step: string;
  stepOrder: number;
  status: string;
  message: string;
  progress: number;
}) => void;

// =============================================================================
// Worker API Helper
// =============================================================================

interface WorkerCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

async function callWorker(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_TIMEOUT);

  try {
    const res = await fetch(`${WORKER_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WORKER_API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Worker ${endpoint} 오류 (${res.status}): ${text}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// [Patent] Civil Service Submission Service Class
// =============================================================================

export class CivilServiceSubmissionService {
  private submissionId: string | null = null;
  private progressCallback: ProgressCallback | null = null;

  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  private async updateTrackingLog(
    submissionId: string,
    step: string,
    stepOrder: number,
    status: string,
    message: string,
    screenshotUrl?: string
  ): Promise<void> {
    const startedAt = status === 'in_progress' ? new Date() : undefined;
    const completedAt = ['success', 'failed', 'skipped'].includes(status) ? new Date() : undefined;

    await prisma.submissionTrackingLog.create({
      data: {
        submissionId,
        step,
        stepOrder,
        status,
        message,
        screenshotUrl,
        startedAt,
        completedAt,
      },
    });

    if (this.progressCallback) {
      const progressPercent = Math.round((stepOrder / SUBMISSION_STEPS.length) * 100);
      this.progressCallback({
        step,
        stepOrder,
        status,
        message,
        progress: progressPercent,
      });
    }
  }

  /**
   * Create new submission record in DB
   */
  async createSubmission(input: SubmissionInput): Promise<string> {
    const submission = await prisma.civilServiceSubmission.create({
      data: {
        userId: input.userId,
        serviceName: input.serviceName,
        serviceCode: input.serviceCode,
        targetSite: input.targetSite,
        targetUrl: input.targetUrl,
        applicantName: input.applicantName,
        applicantBirth: input.applicantBirth,
        applicantPhone: input.applicantPhone,
        applicationData: JSON.stringify(input.applicationData),
        powerOfAttorneyId: input.powerOfAttorneyId,
        status: 'draft',
        progress: 0,
      },
    });

    this.submissionId = submission.id;
    return submission.id;
  }

  /**
   * [Patent] Execute submission via Railway RPA Worker
   */
  async executeSubmission(
    submissionId: string,
    authCookies?: WorkerCookie[]
  ): Promise<SubmissionResult> {
    this.submissionId = submissionId;

    try {
      // Get submission data
      const submission = await prisma.civilServiceSubmission.findUnique({
        where: { id: submissionId },
        include: { powerOfAttorney: true },
      });

      if (!submission) {
        throw new Error('민원 신청 정보를 찾을 수 없습니다');
      }

      // Update status to pending
      await prisma.civilServiceSubmission.update({
        where: { id: submissionId },
        data: { status: 'pending', progress: 0 },
      });

      // Step 1: Initialize
      await this.updateTrackingLog(submissionId, 'initialize', 1, 'in_progress', '민원 접수 준비 중...');
      await this.updateTrackingLog(submissionId, 'initialize', 1, 'success', '초기화 완료');

      // Step 2: Verify POA
      await this.updateTrackingLog(submissionId, 'verify_poa', 2, 'in_progress', '위임장 검증 중...');
      if (submission.powerOfAttorneyId) {
        const poaResult = await powerOfAttorneyService.verify(submission.powerOfAttorneyId);
        if (!poaResult.isValid) {
          await this.updateTrackingLog(submissionId, 'verify_poa', 2, 'failed', poaResult.reason || '위임장 검증 실패');
          throw new Error(poaResult.reason || '위임장 검증 실패');
        }
        await this.updateTrackingLog(submissionId, 'verify_poa', 2, 'success', '위임장 검증 완료');
      } else {
        await this.updateTrackingLog(submissionId, 'verify_poa', 2, 'skipped', '위임장 없음 (직접 신청)');
      }

      // Step 3: Verify auth cookies
      await this.updateTrackingLog(submissionId, 'login', 3, 'in_progress', '인증 상태 확인 중...');
      if (!authCookies || authCookies.length === 0) {
        await this.updateTrackingLog(submissionId, 'login', 3, 'failed', '인증 쿠키가 없습니다. 먼저 간편인증을 완료해주세요.');
        throw new Error('인증 쿠키가 없습니다. 먼저 간편인증을 완료해주세요.');
      }
      await this.updateTrackingLog(submissionId, 'login', 3, 'success', '인증 확인 완료');

      // Step 4: Send to Worker
      await this.updateTrackingLog(submissionId, 'submit_to_worker', 4, 'in_progress', 'RPA 워커로 전송 중...');

      // Convert ApplicationField[] to simple formData for worker
      const applicationData = JSON.parse(submission.applicationData) as ApplicationField[];
      const formData: Record<string, string> = {};
      const files: { fileName: string; fileBase64: string; mimeType: string }[] = [];

      for (const field of applicationData) {
        if (field.fieldType === 'file' && typeof field.value === 'string') {
          files.push({
            fileName: field.fieldName,
            fileBase64: field.value,
            mimeType: 'application/octet-stream',
          });
        } else {
          formData[field.fieldId] = String(field.value);
        }
      }

      await this.updateTrackingLog(submissionId, 'submit_to_worker', 4, 'success', 'RPA 워커 전송 완료');

      // Step 5: Worker processes the submission
      await this.updateTrackingLog(submissionId, 'worker_processing', 5, 'in_progress', '민원 양식 작성 및 제출 중...');

      await prisma.civilServiceSubmission.update({
        where: { id: submissionId },
        data: { status: 'submitted', progress: 50 },
      });

      const workerResult = await callWorker('/gov24/submit', {
        cookies: authCookies,
        serviceCode: submission.serviceCode,
        serviceUrl: submission.targetUrl,
        formData,
        files,
      });

      if (!workerResult.success) {
        await this.updateTrackingLog(
          submissionId, 'worker_processing', 5, 'failed',
          workerResult.error || '워커 처리 실패',
          workerResult.screenshotUrl
        );
        throw new Error(workerResult.error || '민원 제출에 실패했습니다');
      }

      await this.updateTrackingLog(
        submissionId, 'worker_processing', 5, 'success',
        '민원 제출 완료',
        workerResult.screenshotUrl
      );

      // Step 6: Confirm result
      await this.updateTrackingLog(submissionId, 'confirm', 6, 'in_progress', '접수 확인 중...');

      const applicationNumber = workerResult.applicationNumber || workerResult.receiptNumber || undefined;

      await this.updateTrackingLog(
        submissionId, 'confirm', 6, 'success',
        applicationNumber ? `접수번호: ${applicationNumber}` : '접수 완료 (번호 확인 중)',
        workerResult.receiptScreenshotUrl
      );

      // Mark POA as used
      if (submission.powerOfAttorneyId) {
        await powerOfAttorneyService.markAsUsed(submission.powerOfAttorneyId);
      }

      // Update final status
      await prisma.civilServiceSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'completed',
          progress: 100,
          applicationNumber,
          receiptUrl: workerResult.receiptScreenshotUrl || workerResult.screenshotUrl,
          resultData: JSON.stringify(workerResult),
          completedAt: new Date(),
        },
      });

      return {
        success: true,
        submissionId,
        status: 'completed',
        applicationNumber,
        message: '민원 접수가 완료되었습니다',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

      await prisma.civilServiceSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'failed',
          errorMessage,
          retryCount: { increment: 1 },
        },
      });

      return {
        success: false,
        submissionId,
        status: 'failed',
        message: '민원 접수에 실패했습니다',
        error: errorMessage,
      };
    }
  }

  /**
   * Get submission status with tracking logs
   */
  async getSubmissionStatus(submissionId: string): Promise<{
    status: SubmissionStatus;
    progress: number;
    applicationNumber?: string;
    trackingLogs: TrackingStep[];
  }> {
    const submission = await prisma.civilServiceSubmission.findUnique({
      where: { id: submissionId },
      include: {
        trackingLogs: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    return {
      status: submission.status as SubmissionStatus,
      progress: submission.progress,
      applicationNumber: submission.applicationNumber || undefined,
      trackingLogs: submission.trackingLogs.map(log => ({
        step: log.step,
        stepOrder: log.stepOrder,
        status: log.status as TrackingStep['status'],
        message: log.message || undefined,
        screenshotUrl: log.screenshotUrl || undefined,
        startedAt: log.startedAt || undefined,
        completedAt: log.completedAt || undefined,
        duration: log.duration || undefined,
      })),
    };
  }

  /**
   * Cancel submission
   */
  async cancelSubmission(submissionId: string): Promise<void> {
    await prisma.civilServiceSubmission.update({
      where: { id: submissionId },
      data: { status: 'cancelled' },
    });
  }

  /**
   * Retry failed submission
   */
  async retrySubmission(submissionId: string, authCookies?: WorkerCookie[]): Promise<SubmissionResult> {
    const submission = await prisma.civilServiceSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    if (submission.retryCount >= submission.maxRetries) {
      throw new Error('최대 재시도 횟수를 초과했습니다');
    }

    await prisma.civilServiceSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'pending',
        progress: 0,
        errorMessage: null,
      },
    });

    return this.executeSubmission(submissionId, authCookies);
  }
}

// =============================================================================
// Service Instance Export
// =============================================================================

export const civilServiceSubmissionService = new CivilServiceSubmissionService();
