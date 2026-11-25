import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroups() {
    const data = await this.prisma.assignmentGroup.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } } } } },
    });
    return {
      data: data.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        isActive: group.isActive,
        members: group.members
          .filter((member) => member.user.isActive)
          .map((member) => ({
            id: member.user.id,
            name: `${member.user.firstName} ${member.user.lastName}`,
            email: member.user.email,
          })),
      })),
    };
  }

  async assertAssignment(db: Db, groupId: string | null, userId: string | null): Promise<void> {
    if (userId && !groupId) {
      throw new BadRequestException("Select an assignment group before assigning a user.");
    }
    if (groupId) {
      const group = await db.assignmentGroup.findFirst({ where: { id: groupId, isActive: true } });
      if (!group) throw new BadRequestException("Assignment group is not available.");
    }
    if (userId && groupId) {
      const member = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
      if (!member) throw new BadRequestException("Assigned user must belong to the selected assignment group.");
      const assignee = await db.user.findFirst({ where: { id: userId, isActive: true } });
      if (!assignee) throw new BadRequestException("Assigned user is not active.");
    }
  }
}
