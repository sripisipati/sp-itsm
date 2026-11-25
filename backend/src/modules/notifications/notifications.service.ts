import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(
    db: Prisma.TransactionClient | PrismaService,
    input: { userId: string; title: string; body: string; link?: string },
  ): Promise<void> {
    await db.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        link: input.link,
      },
    });
  }

  async listForUser(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return { data: rows };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { data: { updated: result.count } };
  }
}
