import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ChangePriority, ChangeType, ImpactLevel, Prisma, Probability, RiskLevel, Urgency } from "../../generated/prisma/client";

export interface RiskFactorExplanation {
  factor: string;
  input: string;
  score: number;
  weight: number;
  contribution: number;
}

export interface RiskComputation {
  complete: boolean;
  missing: string[];
  level: RiskLevel | null;
  score: number | null;
  factors: RiskFactorExplanation[];
  summary: string;
  priority: ChangePriority | null;
  rollbackRequired: boolean;
  pirRequired: boolean;
}

export interface RiskInput {
  type: ChangeType;
  businessImpact?: ImpactLevel | null;
  technicalImpact?: ImpactLevel | null;
  urgency?: Urgency | null;
  probability?: Probability | null;
  downtimeRequired?: boolean | null;
  impactedUsers?: number | null;
}

@Injectable()
export class ChangeRiskService {
  async calculate(db: Prisma.TransactionClient, input: RiskInput): Promise<RiskComputation> {
    const config = await db.riskEngineConfig.findUnique({ where: { id: "default" } });
    if (!config) throw new InternalServerErrorException("Risk engine configuration is missing");
    const ranks = await db.riskLevelRank.findMany();
    const rankOf = (level: string | null | undefined) => ranks.find((row) => row.level === level)?.rank ?? 0;
    const missing: string[] = [];
    const impact = this.higherImpact(input.businessImpact, input.technicalImpact, rankOf);
    if (!impact) missing.push("impact");
    if (!input.probability) missing.push("probability");

    const factors: RiskFactorExplanation[] = [];
    let score: number | null = null;
    let level: RiskLevel | null = null;
    if (!missing.length && impact && input.probability) {
      const impactScore = await this.factorScore(db, "IMPACT", impact);
      const probabilityScore = await this.factorScore(db, "PROBABILITY", input.probability);
      const downtimeScore = await this.factorScore(db, "DOWNTIME", input.downtimeRequired ? "true" : "false");
      const userScore = await this.userBandScore(db, input.impactedUsers ?? 0);
      factors.push(
        this.factor("Impact", impact, impactScore, config.impactWeight),
        this.factor("Probability", input.probability, probabilityScore, config.probabilityWeight),
        this.factor("Downtime", input.downtimeRequired ? "required" : "not required", downtimeScore, config.downtimeWeight),
        this.factor("Impacted users", String(input.impactedUsers ?? 0), userScore, config.userImpactWeight),
      );
      score = Number(factors.reduce((sum, factor) => sum + factor.contribution, 0).toFixed(4));
      level = this.levelFor(score, config);
    }

    const priority = await this.priorityFor(db, input.businessImpact ?? input.technicalImpact ?? null, input.urgency ?? null);
    const rollbackRequired = level ? await this.rollbackRequired(db, input.type, level) : false;
    const pirRequired = await this.pirRequired(db, input.type, level);
    const summary =
      level == null || score == null
        ? `Risk is incomplete. Missing ${missing.join(", ")}.`
        : `${level.replaceAll("_", " ")} (score ${score.toFixed(2)}). ${factors
            .map((factor) => `${factor.factor} contributed ${factor.contribution.toFixed(2)}`)
            .join("; ")}.`;
    return { complete: missing.length === 0, missing, level, score, factors, summary, priority, rollbackRequired, pirRequired };
  }

  async priorityFor(db: Prisma.TransactionClient, impact: ImpactLevel | null, urgency: Urgency | null): Promise<ChangePriority | null> {
    if (!impact || !urgency) return null;
    const row = await db.changePriorityMatrix.findUnique({ where: { impact_urgency: { impact, urgency } } });
    if (!row) throw new BadRequestException("Priority matrix has no row for this impact and urgency");
    return row.priority;
  }

  async rollbackRequired(db: Prisma.TransactionClient, type: ChangeType, risk: RiskLevel): Promise<boolean> {
    const row = await db.rollbackRequirement.findUnique({ where: { changeType_risk: { changeType: type, risk } } });
    return row?.required ?? false;
  }

  async pirRequired(db: Prisma.TransactionClient, type: ChangeType, risk: RiskLevel | null): Promise<boolean> {
    const policy = await db.changeTypePolicy.findUnique({ where: { changeType: type } });
    if (!policy) return false;
    if (policy.pirRequired) return true;
    if (!policy.pirMinRisk || !risk) return false;
    const ranks = await db.riskLevelRank.findMany();
    const riskRank = ranks.find((row) => row.level === risk)?.rank ?? 0;
    const minRank = ranks.find((row) => row.level === policy.pirMinRisk)?.rank ?? 99;
    return riskRank >= minRank;
  }

  private higherImpact(
    business: ImpactLevel | null | undefined,
    technical: ImpactLevel | null | undefined,
    rankOf: (level: string | null | undefined) => number,
  ): ImpactLevel | null {
    if (!business && !technical) return null;
    if (!business) return technical ?? null;
    if (!technical) return business;
    return rankOf(business) >= rankOf(technical) ? business : technical;
  }

  private async factorScore(db: Prisma.TransactionClient, factorType: string, factorValue: string): Promise<number> {
    const row = await db.riskFactorScore.findUnique({ where: { factorType_factorValue: { factorType, factorValue } } });
    if (!row) throw new InternalServerErrorException(`Risk engine is not configured for ${factorType}=${factorValue}`);
    return row.score;
  }

  private async userBandScore(db: Prisma.TransactionClient, users: number): Promise<number> {
    const bands = await db.riskUserBand.findMany({ orderBy: { minUsers: "asc" } });
    const band = bands.find((row) => users >= row.minUsers && (row.maxUsers == null || users <= row.maxUsers));
    if (!band) throw new InternalServerErrorException(`Risk engine has no user band for ${users} users`);
    return band.score;
  }

  private factor(factor: string, input: string, score: number, weight: number): RiskFactorExplanation {
    return { factor, input, score, weight, contribution: Number((score * weight).toFixed(4)) };
  }

  private levelFor(score: number, config: { veryHighMin: number; highMin: number; mediumMin: number; lowMin: number }): RiskLevel {
    if (score >= config.veryHighMin) return RiskLevel.VERY_HIGH;
    if (score >= config.highMin) return RiskLevel.HIGH;
    if (score >= config.mediumMin) return RiskLevel.MEDIUM;
    if (score >= config.lowMin) return RiskLevel.LOW;
    return RiskLevel.VERY_LOW;
  }
}
