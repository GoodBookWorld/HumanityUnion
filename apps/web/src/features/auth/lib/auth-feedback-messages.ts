const INCORRECT_CODE_PATTERNS = [/incorrect/i, /code is incorrect/i];

/** Stable authored mapped message — translate via auth.incorrectCode at display. */
export const AUTH_INCORRECT_CODE_MESSAGE =
  "The code is incorrect. Check the latest email and try again.";

export function normalizeIncorrectCodeMessage(message: string): string {
  if (INCORRECT_CODE_PATTERNS.some((pattern) => pattern.test(message))) {
    return AUTH_INCORRECT_CODE_MESSAGE;
  }

  return message;
}

export function isIncorrectCodeMessage(message: string): boolean {
  return INCORRECT_CODE_PATTERNS.some((pattern) => pattern.test(message));
}

export function isCooldownMessage(message: string): boolean {
  return /please wait before requesting another code/i.test(message);
}
