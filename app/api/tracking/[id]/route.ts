// =============================================================================
// [Patent Technology] Real-time Progress Tracking SSE API
// GET /api/tracking/[id] - Server-Sent Events for submission progress
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const submission = await prisma.civilServiceSubmission.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!submission) {
    return new Response('Not found', { status: 404 });
  }

  if (submission.userId !== session.user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial state
      const initialData = await getSubmissionState(id);
      sendEvent({ type: 'init', data: initialData });

      // Poll for updates
      let lastLogCount = initialData.trackingLogs.length;
      let lastProgress = initialData.progress;
      let lastStatus = initialData.status;

      const interval = setInterval(async () => {
        try {
          const currentData = await getSubmissionState(id);

          // Check for changes
          if (
            currentData.trackingLogs.length !== lastLogCount ||
            currentData.progress !== lastProgress ||
            currentData.status !== lastStatus
          ) {
            // Send new logs
            if (currentData.trackingLogs.length > lastLogCount) {
              const newLogs = currentData.trackingLogs.slice(lastLogCount);
              for (const log of newLogs) {
                sendEvent({ type: 'log', data: log });
              }
            }

            // Send progress update
            if (currentData.progress !== lastProgress) {
              sendEvent({
                type: 'progress',
                data: { progress: currentData.progress }
              });
            }

            // Send status update
            if (currentData.status !== lastStatus) {
              sendEvent({
                type: 'status',
                data: {
                  status: currentData.status,
                  applicationNumber: currentData.applicationNumber,
                  errorMessage: currentData.errorMessage,
                }
              });

              // Close stream if completed or failed
              if (['completed', 'failed', 'cancelled'].includes(currentData.status)) {
                sendEvent({ type: 'done', data: { status: currentData.status } });
                clearInterval(interval);
                controller.close();
              }
            }

            // Update tracking state
            lastLogCount = currentData.trackingLogs.length;
            lastProgress = currentData.progress;
            lastStatus = currentData.status;
          }
        } catch (error) {
          console.error('SSE poll error:', error);
        }
      }, 1000); // Poll every second

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function getSubmissionState(id: string) {
  const submission = await prisma.civilServiceSubmission.findUnique({
    where: { id },
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
    status: submission.status,
    progress: submission.progress,
    applicationNumber: submission.applicationNumber,
    errorMessage: submission.errorMessage,
    trackingLogs: submission.trackingLogs.map(log => ({
      id: log.id,
      step: log.step,
      stepOrder: log.stepOrder,
      status: log.status,
      message: log.message,
      screenshotUrl: log.screenshotUrl,
      startedAt: log.startedAt?.toISOString(),
      completedAt: log.completedAt?.toISOString(),
    })),
  };
}
