/**
 * In-Memory Job Queue System
 * Redis 없이 메모리 기반으로 작업 관리
 *
 * Note: 서버 재시작 시 작업 상태가 초기화됨
 */

// 인메모리 작업 저장소
const jobs = new Map();

// 작업 상태 enum
const JobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * 작업 ID 생성
 */
function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 작업 큐에 추가
 * @param {string} jobType - 작업 유형 (gov24_auth, gov24_submit, etc.)
 * @param {object} data - 작업 데이터
 * @returns {object} job 정보
 */
async function addJob(jobType, data) {
  const jobId = generateJobId();
  const job = {
    id: jobId,
    type: jobType,
    data,
    status: JobStatus.PENDING,
    progress: 0,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  jobs.set(jobId, job);
  console.log(`[Queue] 작업 등록: ${jobType} (jobId: ${jobId})`);

  return { jobId, jobType, status: 'queued' };
}

/**
 * 작업 상태 업데이트
 */
function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) return null;

  Object.assign(job, updates, { updatedAt: new Date().toISOString() });
  jobs.set(jobId, job);
  return job;
}

/**
 * 작업 상태 조회
 */
async function getJobStatus(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;

  return {
    jobId: job.id,
    jobType: job.type,
    state: job.status,
    progress: job.progress,
    data: job.data,
    result: job.result,
    failedReason: job.error,
    timestamp: job.createdAt,
  };
}

/**
 * 큐 사용 가능 여부 (인메모리는 항상 true)
 */
function isQueueAvailable() {
  return true;
}

/**
 * 오래된 작업 정리 (1시간 이상 지난 완료/실패 작업)
 */
function cleanupOldJobs() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let cleaned = 0;

  for (const [jobId, job] of jobs.entries()) {
    if (
      (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) &&
      job.updatedAt < oneHourAgo
    ) {
      jobs.delete(jobId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Queue] 오래된 작업 ${cleaned}개 정리됨`);
  }
}

// 10분마다 오래된 작업 정리
setInterval(cleanupOldJobs, 10 * 60 * 1000);

module.exports = {
  jobs,
  JobStatus,
  addJob,
  updateJob,
  getJobStatus,
  isQueueAvailable,
};
