import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { paginationMeta } from "../../common/pagination";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { presentUser } from "./user.presenter";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAuthUser(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, isActive: true },
      include: {
        roles: { include: { role: true } },
        memberships: true,
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((entry) => entry.role.name),
      groupIds: user.memberships.map((entry) => entry.groupId),
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: { include: { role: true } }, memberships: true },
    });
  }

  async list(search?: string, page = 1, pageSize = 25) {
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { employeeId: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};
    const [totalRecords, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { roles: { include: { role: true } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { data: rows.map(presentUser), pagination: paginationMeta(page, pageSize, totalRecords) };
  }
}
