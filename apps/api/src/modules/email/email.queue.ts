type EmailQueueJob = () => Promise<void>;

const pendingJobs: EmailQueueJob[] = [];
let processing = false;

async function drainEmailQueue(): Promise<void> {
  if (processing) {
    return;
  }

  processing = true;

  try {
    while (pendingJobs.length > 0) {
      const job = pendingJobs.shift();

      if (!job) {
        continue;
      }

      try {
        await job();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Email queue job failed.";
        console.error(`[email:queue] ${message}`);
      }
    }
  } finally {
    processing = false;
  }
}

export function enqueueEmailDelivery(job: EmailQueueJob): void {
  pendingJobs.push(job);
  void drainEmailQueue();
}

export async function drainEmailQueueForTests(): Promise<void> {
  while (pendingJobs.length > 0 || processing) {
    await drainEmailQueue();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export function clearEmailQueueForTests(): void {
  pendingJobs.length = 0;
  processing = false;
}
