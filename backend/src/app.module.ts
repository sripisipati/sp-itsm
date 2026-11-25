import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./config/env.validation";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { PrismaModule } from "./database/prisma.module";
import { AssignmentsModule } from "./modules/assignments/assignments.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ChangesModule } from "./modules/changes/changes.module";
import { ConfigurationModule } from "./modules/configuration/configuration.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { HealthModule } from "./modules/health/health.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { MajorIncidentsModule } from "./modules/major-incidents/major-incidents.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ProblemsModule } from "./modules/problems/problems.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../.env"],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>("THROTTLE_TTL") ?? 60_000,
            limit: config.get<number>("THROTTLE_LIMIT") ?? 300,
          },
        ],
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AssignmentsModule,
    AuditModule,
    ConfigurationModule,
    NotificationsModule,
    IncidentsModule,
    DashboardModule,
    HealthModule,
    MajorIncidentsModule,
    ProblemsModule,
    ChangesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
