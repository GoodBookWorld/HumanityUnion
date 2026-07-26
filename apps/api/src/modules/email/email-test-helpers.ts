import { clearEmailQueueForTests, drainEmailQueueForTests } from "./email.queue.js";
import { MockEmailProvider } from "./providers/mock.provider.js";
import { resetSmtpTransportForTests } from "./smtp-transport.js";

export { drainEmailQueueForTests };

export function resetMockEmailOutboxForTests(): void {
  MockEmailProvider.clearForTests();
}

export function getMockEmailSendCount(): number {
  return MockEmailProvider.sentMessages.length;
}

export function disposeEmailWorkersForTests(): void {
  clearEmailQueueForTests();
  resetMockEmailOutboxForTests();
  resetSmtpTransportForTests();
}
