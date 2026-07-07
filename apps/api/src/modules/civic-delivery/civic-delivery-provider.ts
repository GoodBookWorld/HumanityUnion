import type { CivicActionPackage, CivicDeliveryRecipient } from "@hu/types";

export interface CivicDeliverySendResult {
  recipientId: string;
  success: boolean;
  errorMessage?: string;
}

export interface CivicDeliveryProvider {
  readonly mode: string;
  sendCivicActionPackage(
    capPackage: CivicActionPackage,
    recipients: CivicDeliveryRecipient[],
  ): Promise<CivicDeliverySendResult[]>;
}

export class DevSimulatedCivicDeliveryProvider implements CivicDeliveryProvider {
  readonly mode = "dev_simulated" as const;

  async sendCivicActionPackage(
    _capPackage: CivicActionPackage,
    deliveryRecipients: CivicDeliveryRecipient[],
  ): Promise<CivicDeliverySendResult[]> {
    return deliveryRecipients.map((recipient) => ({
      recipientId: recipient.recipientId,
      success: true,
    }));
  }
}

export function resolveCivicDeliveryProvider(): CivicDeliveryProvider {
  const mode = process.env.CIVIC_DELIVERY_PROVIDER ?? "dev_simulated";

  if (mode === "dev_simulated") {
    return new DevSimulatedCivicDeliveryProvider();
  }

  return new DevSimulatedCivicDeliveryProvider();
}
