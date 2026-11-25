import { Injectable } from "@nestjs/common";
import { IncidentStatus, Severity } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { buildIncidentWhere } from "../incidents/domain/incident-query";
import { OPEN_STATUSES } from "../incidents/domain/incident-rules";
import { listInclude, presentListItem } from "../incidents/incident.presenter";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthenticatedUser) {
    const where = buildIncidentWhere({}, user);
    const active = { AND: [where, { status: { notIn: [IncidentStatus.CLOSED, IncidentStatus.CANCELLED] } }] };
    const [total, open, inProgress, critical, resolved, byStatus, byPriority, byGroup, recent, mine] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.count({ where: { AND: [where, { status: { in: OPEN_STATUSES } }] } }),
      this.prisma.incident.count({ where: { AND: [where, { status: IncidentStatus.IN_PROGRESS }] } }),
      this.prisma.incident.count({ where: { AND: [where, { severity: Severity.CRITICAL, status: { notIn: [IncidentStatus.CLOSED, IncidentStatus.CANCELLED] } }] } }),
      this.prisma.incident.count({ where: { AND: [where, { status: IncidentStatus.RESOLVED }] } }),
      this.prisma.incident.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.incident.groupBy({ by: ["priority"], where, _count: { _all: true } }),
      this.prisma.incident.groupBy({ by: ["assignmentGroupId"], where, _count: { _all: true } }),
      this.prisma.incident.findMany({ where, orderBy: { createdAt: "desc" }, take: 8, include: listInclude }),
      this.prisma.incident.findMany({
        where: { AND: [active, { assignedToId: user.id }] },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: listInclude,
      }),
    ]);
    const groups = await this.prisma.assignmentGroup.findMany({ select: { id: true, name: true } });
    const names = new Map(groups.map((group) => [group.id, group.name]));
    return {
      data: {
        total,
        open,
        inProgress,
        critical,
        resolved,
        byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
        byPriority: byPriority.map((row) => ({ priority: row.priority, count: row._count._all })),
        byAssignmentGroup: byGroup.map((row) => ({
          assignmentGroupId: row.assignmentGroupId,
          name: row.assignmentGroupId ? names.get(row.assignmentGroupId) ?? "Unknown" : "Unassigned",
          count: row._count._all,
        })),
        recentlyCreated: recent.map(presentListItem),
        myAssigned: mine.map(presentListItem),
      },
    };
  }
}
