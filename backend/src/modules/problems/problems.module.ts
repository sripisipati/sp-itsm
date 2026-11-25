import { Controller, Get, Module, NotFoundException, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../database/prisma.service";

@ApiTags("problems")
@ApiBearerAuth()
@Controller("problems")
class ProblemsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query("search") search?: string) {
    const rows = await this.prisma.problem.findMany({
      where: search
        ? { OR: [{ number: { contains: search, mode: "insensitive" } }, { shortDescription: { contains: search, mode: "insensitive" } }] }
        : {},
      orderBy: { number: "asc" },
      include: { changes: { select: { id: true, number: true, shortDescription: true, state: true } } },
    });
    return { data: rows };
  }

  @Get(":id")
  async get(@Param("id", ParseUUIDPipe) id: string) {
    const row = await this.prisma.problem.findUnique({
      where: { id },
      include: { changes: { select: { id: true, number: true, shortDescription: true, state: true, type: true } } },
    });
    if (!row) throw new NotFoundException("Problem not found");
    return { data: row };
  }
}

@Module({ controllers: [ProblemsController] })
export class ProblemsModule {}
