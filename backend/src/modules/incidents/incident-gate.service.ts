import { Injectable, NotFoundException } from "@nestjs/common";
import { Incident } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { canViewIncident } from "./domain/incident-access";

@Injectable()
export class IncidentGate {
  constructor(private readonly prisma: PrismaService) {}

  async require(id: string, user: AuthenticatedUser): Promise<Incident> {
    const incident = await this.prisma.incident.findFirst({ where: { id, archivedAt: null } });
    if (!incident || !canViewIncident(user, incident)) {
      throw new NotFoundException("Incident not found.");
    }
    return incident;
  }
}
