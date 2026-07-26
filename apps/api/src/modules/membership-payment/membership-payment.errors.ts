export class MembershipPaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipPaymentValidationError";
  }
}

export class MembershipPaymentAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipPaymentAccessDeniedError";
  }
}

export class MembershipPaymentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipPaymentConflictError";
  }
}

export class MembershipPaymentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipPaymentNotFoundError";
  }
}

export class MembershipPaymentUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipPaymentUnavailableError";
  }
}

export class MembershipWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipWebhookSignatureError";
  }
}
