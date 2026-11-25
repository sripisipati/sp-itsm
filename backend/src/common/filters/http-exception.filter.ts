import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    const request = ctx.getRequest<{ correlationId?: string; originalUrl?: string; url?: string }>();
    const correlationId = request.correlationId ?? "unknown";
    const path = request.originalUrl ?? request.url ?? "";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "The request could not be completed.";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
        error = exception.name;
      } else if (typeof body === "object" && body !== null) {
        const record = body as { message?: string | string[]; error?: string };
        message = record.message ?? exception.message;
        error = record.error ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        message = "A record with that unique value already exists.";
        error = "Conflict";
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        message = "The requested record was not found.";
        error = "Not Found";
      }
      this.logger.error(JSON.stringify({ correlationId, code: exception.code, message: exception.message }));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = "The request contained invalid data.";
      error = "Bad Request";
      this.logger.error(JSON.stringify({ correlationId, message: exception.message }));
    } else {
      const detail = exception instanceof Error ? exception.message : "unknown error";
      this.logger.error(JSON.stringify({ correlationId, message: detail }));
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      correlationId,
      timestamp: new Date().toISOString(),
      path,
    });
  }
}
