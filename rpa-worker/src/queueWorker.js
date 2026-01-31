/**
 * BullMQ Worker - 큐에서 작업을 꺼내 실행 (Consumer)
 */

const { Worker } = require('bullmq');
const { connection } = require('./queue');
const {
  requestGov24Auth,
  confirmGov24Auth,
  submitGov24Service,
} = require('../gov24Logic');

let worker = null;

/**
 * 작업 처리 핸들러
 */
async function processJob(job) {
  const { name: jobType, data, id: jobId } = job;
  console.log(`[Worker] 작업 시작: ${jobType} (jobId: ${jobId})`);

  try {
    await job.updateProgress(10);

    let result;

    switch (jobType) {
      case 'gov24_auth_request':
        result = await requestGov24Auth(data);
        break;

      case 'gov24_auth_confirm':
        result = await confirmGov24Auth(data.sessionId);
        break;

      case 'gov24_submit':
        await job.updateProgress(30);
        result = await submitGov24Service(data);
        break;

      case 'generic_rpa':
        // 범용 RPA 작업 - 향후 확장
        result = { success: true, message: 'Generic RPA task placeholder' };
        break;

      default:
        throw new Error(`알 수 없는 작업 유형: ${jobType}`);
    }

    await job.updateProgress(100);
    console.log(`[Worker] 작업 완료: ${jobType} (jobId: ${jobId})`);
    return result;

  } catch (error) {
    console.error(`[Worker] 작업 실패: ${jobType} (jobId: ${jobId})`, error.message);
    throw error; // BullMQ 재시도 트리거
  }
}

/**
 * Worker 초기화
 */
function startWorker() {
  if (!connection) {
    console.log('[Worker] Redis 미연결 - Worker 비활성화 (직접 실행 모드)');
    return null;
  }

  worker = new Worker('rpa-tasks', processJob, {
    connection,
    concurrency: 1, // Chrome 메모리 제한 → 동시 1개만
    limiter: {
      max: 5,
      duration: 60000, // 분당 최대 5개
    },
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] 완료: ${job.name} (${job.id})`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] 실패: ${job?.name} (${job?.id}) - ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[Worker] 오류:', err.message);
  });

  console.log('[Worker] BullMQ Worker 시작 (concurrency: 1)');
  return worker;
}

function stopWorker() {
  if (worker) {
    worker.close();
    console.log('[Worker] Worker 종료');
  }
}

module.exports = { startWorker, stopWorker };
