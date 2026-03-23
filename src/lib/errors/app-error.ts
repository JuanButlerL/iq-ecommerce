export class AppError extends Error {
  readonly statusCode: number;
  readonly exposeMessage: boolean;

  constructor(message: string, statusCode = 400, exposeMessage = true) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.exposeMessage = exposeMessage;
  }
}
