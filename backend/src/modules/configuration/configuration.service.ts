import { BadRequestException, Injectable } from "@nestjs/common";
import { Impact, Prisma, Urgency } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { resolvePriority } from "../incidents/domain/incident-rules";

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  async categories() {
    const data = await this.prisma.incidentCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return { data };
  }

  async configurationItems(search?: string) {
    const data = await this.prisma.configurationItem.findMany({
      where: {
        isActive: true,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });
    return { data };
  }

  async businessServices() {
    const data = await this.prisma.businessService.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    return { data };
  }

  async resolutionCodes() {
    const data = await this.prisma.resolutionCode.findMany({ where: { isActive: true }, orderBy: { label: "asc" } });
    return { data };
  }

  async priorityMatrix() {
    const data = await this.prisma.priorityMatrix.findMany({ where: { isActive: true }, orderBy: [{ impact: "asc" }, { urgency: "asc" }] });
    return { data };
  }

  async statusTransitions() {
    const data = await this.prisma.statusTransition.findMany({ where: { isActive: true }, orderBy: [{ fromStatus: "asc" }, { toStatus: "asc" }] });
    return { data };
  }

  async settings() {
    const rows = await this.prisma.appSetting.findMany({ orderBy: { key: "asc" } });
    return { data: Object.fromEntries(rows.map((row) => [row.key, row.value])) };
  }

  async resolve(impact: Impact, urgency: Urgency) {
    const priority = await this.calculatePriority(this.prisma, impact, urgency);
    const rule = await this.prisma.priorityMatrix.findUnique({ where: { impact_urgency: { impact, urgency } } });
    return {
      data: {
        impact,
        urgency,
        priority,
        explanation: `Impact ${impact} and urgency ${urgency} map to ${priority} in the active priority matrix.`,
        ruleId: rule?.id ?? null,
      },
    };
  }

  async calculatePriority(db: Db, impact: Impact, urgency: Urgency) {
    const rules = await db.priorityMatrix.findMany();
    const priority = resolvePriority(rules, impact, urgency);
    if (!priority) {
      throw new BadRequestException("No active priority matrix row matches this impact and urgency.");
    }
    return priority;
  }

  async assertReferences(
    db: Db,
    input: {
      categoryId?: string | null;
      subcategoryId?: string | null;
      callerId?: string | null;
      configurationItemId?: string | null;
      businessServiceId?: string | null;
      resolutionCode?: string | null;
    },
  ): Promise<void> {
    if (input.categoryId) {
      const category = await db.incidentCategory.findFirst({ where: { id: input.categoryId, isActive: true, parentId: null } });
      if (!category) throw new BadRequestException("Category is not available.");
    }
    if (input.subcategoryId) {
      const subcategory = await db.incidentCategory.findFirst({ where: { id: input.subcategoryId, isActive: true } });
      if (!subcategory || !subcategory.parentId || subcategory.parentId !== input.categoryId) {
        throw new BadRequestException("Subcategory does not belong to the selected category.");
      }
    }
    if (input.callerId) {
      const caller = await db.user.findFirst({ where: { id: input.callerId, isActive: true } });
      if (!caller) throw new BadRequestException("Caller is not available.");
    }
    if (input.configurationItemId) {
      const item = await db.configurationItem.findFirst({ where: { id: input.configurationItemId, isActive: true } });
      if (!item) throw new BadRequestException("Configuration item is not available.");
    }
    if (input.businessServiceId) {
      const service = await db.businessService.findFirst({ where: { id: input.businessServiceId, isActive: true } });
      if (!service) throw new BadRequestException("Business service is not available.");
    }
    if (input.resolutionCode) {
      const code = await db.resolutionCode.findFirst({ where: { code: input.resolutionCode, isActive: true } });
      if (!code) throw new BadRequestException("Resolution code is not available.");
    }
  }
}
