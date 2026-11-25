import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { CorrelationIdInterceptor } from "./common/interceptors/correlation-id.interceptor";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: config.getOrThrow<string>("FRONTEND_ORIGIN").split(",").map((origin) => origin.trim()),
    credentials: false,
  });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new CorrelationIdInterceptor(), new LoggingInterceptor());
  const swagger = new DocumentBuilder()
    .setTitle("ITSM API")
    .setDescription("Incident Management API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger));
  await app.listen(config.get<number>("PORT") ?? 3000);
}

void bootstrap();
