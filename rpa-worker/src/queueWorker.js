/**
 * In-Memory Job Worker
 * 메모리 큐에서 작업을 꺼내 실행
 */

const { jobs, JobStatus, updateJob } = require('./queue');
const {
  requestGov24Auth,
  confirmGov24Auth,
  submitGov24Service,
} = require('../gov24Logic');

let workerInterval = null;
const POLL_INTERVAL = 1000; // 1초마다 큐 확인

/**
 * 작업 처리 핸들러
 */
async function processJob(job) {
  const { type: jobType, data, id: jobId } = job;
  console.log(`[Worker] 작업 시작: ${jobType} (jobId: ${jobId})`);

  updateJob(jobId, { status: JobStatus.PROCESSING, progress: 10 });

  try {
    let result;

    switch (jobType) {
      case 'gov24_auth_request':
        result = await requestGov24Auth(data);
        break;

      case 'gov24_auth_confirm':
        result = await confirmGov24Auth(data.sessionId || data);
        break;

      case 'gov24_submit':
        updateJob(jobId, { progress: 20 });
        result = await submitGov24Service(data, (progress) => updateJob(jobId, { progress }));
        break;

      case 'generic_rpa':
        result = { success: true, message: 'Generic RPA task placeholder' };
        break;

      default:
        throw new Error(`알 수 없는 작업 유형: ${jobType}`);
    }

    updateJob(jobId, {
      status: JobStatus.COMPLETED,
      progress: 100,
      result,
    });

    console.log(`[Worker] 작업 완료: ${jobType} (jobId: ${jobId})`);
    return result;

  } catch (error) {
    console.error(`[Worker] 작업 실패: ${jobType} (jobId: ${jobId})`, error.message);

    updateJob(jobId, {
      status: JobStatus.FAILED,
      error: error.message,
    });

    throw error;
  }
}

/**
 * 대기 중인 작업 처리
 */
async function processNextJob() {
  for (const [jobId, job] of jobs.entries()) {
    if (job.status === JobStatus.PENDING) {
      try {
        await processJob(job);
      } catch (error) {
        // 에러는 processJob 내부에서 처리됨
      }
      break; // 한 번에 하나씩만 처리
    }
  }
}

/**
 * Worker 시작
 */
function startWorker() {
  if (workerInterval) {
    console.log('[Worker] 이미 실행 중');
    return workerInterval;
  }

  workerInterval = setInterval(processNextJob, POLL_INTERVAL);
  console.log('[Worker] In-Memory Worker 시작 (poll: 1초)');
  return workerInterval;
}

/**
 * Worker 종료
 */
function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[Worker] Worker 종료');
  }
}

module.exports = { startWorker, stopWorker, processJob };
