/**
 * BullMQ 작업 큐 시스템
 * Redis 기반 작업 대기열 관리 (Producer)
 */

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// Redis 연결 (Upstash/Railway Redis)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let connection;
try {
  connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  console.log('[Queue] Redis 연결 성공');
} catch (err) {
  console.warn('[Queue] Redis 연결 실패 - 직접 실행 모드로 동작:', err.message);
  connection = null;
}

// 작업 큐 정의
const rpaQueue = connection ? new Queue('rpa-tasks', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
}) : null;

/**
 * 작업 큐에 추가
 * @param {string} jobType - 작업 유형 (gov24_auth, gov24_submit, etc.)
 * @param {object} data - 작업 데이터
 * @param {object} opts - BullMQ 옵션
 * @returns {object} job 정보 또는 null (Redis 미연결 시)
 */
async function addJob(jobType, data, opts = {}) {
  if (!rpaQueue) {
    console.warn('[Queue] Redis 미연결 - 큐 적재 불가, 직접 실행 필요');
    return null;
  }

  const job = await rpaQueue.add(jobType, {
    ...data,
    createdAt: new Date().toISOString(),
  }, {
    priority: data.priority || 0,
    ...opts,
  });

  console.log(`[Queue] 작업 등록: ${jobType} (jobId: ${job.id})`);
  return { jobId: job.id, jobType, status: 'queued' };
}

/**
 * 작업 상태 조회
 */
async function getJobStatus(jobId) {
  if (!rpaQueue) return null;
  const job = await rpaQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    jobId: job.id,
    jobType: job.name,
    state,
    progress: job.progress,
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
  };
}

/**
 * Redis 연결 상태 확인
 */
function isQueueAvailable() {
  return connection !== null && rpaQueue !== null;
}

module.exports = {
  rpaQueue,
  connection,
  addJob,
  getJobStatus,
  isQueueAvailable,
};
