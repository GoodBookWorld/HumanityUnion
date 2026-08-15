export class CommunityIntelligenceError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "CommunityIntelligenceError";
    this.statusCode = statusCode;
  }
}
