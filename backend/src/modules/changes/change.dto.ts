import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  ApprovalType,
  ChangeState,
  ChangeType,
  ImpactLevel,
  ImplementationOutcome,
  NoteType,
  PirResult,
  Probability,
  RiskLevel,
  TaskStatus,
  TestStatus,
  Urgency,
} from "../../generated/prisma/client";

export const SORT_FIELDS = [
  "number",
  "shortDescription",
  "type",
  "category",
  "riskLevel",
  "businessImpact",
  "priority",
  "requestedBy",
  "assignedTo",
  "assignmentGroup",
  "approvalStatus",
  "state",
  "plannedStart",
  "plannedEnd",
  "createdAt",
  "updatedAt",
] as const;

export const CHANGE_VIEWS = ["all", "mine", "pending_approvals", "scheduled", "emergency", "closed"] as const;

function blankToUndefined({ value }: { value: unknown }): unknown {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

function toStringArray({ value }: { value: unknown }): string[] | undefined {
  if (value == null || value === "") return undefined;
  if (Array.isArray(value)) return value.flatMap((item) => String(item).split(",")).map((item) => item.trim()).filter(Boolean);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function toInt({ value }: { value: unknown }): number | undefined {
  if (value === "" || value == null) return undefined;
  return Number(value);
}

export class ChangeQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsOptional() @IsEnum(ChangeType) type?: ChangeType;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsEnum(RiskLevel) riskLevel?: RiskLevel;
  @IsOptional() @IsEnum(ImpactLevel) impact?: ImpactLevel;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsUUID() requestedById?: string;
  @IsOptional() @IsUUID() assignedToId?: string;
  @IsOptional() @IsUUID() assignmentGroupId?: string;
  @IsOptional() @IsString() approvalStatus?: string;
  @IsOptional() @Transform(toStringArray) @IsArray() @IsEnum(ChangeState, { each: true }) state?: ChangeState[];
  @IsOptional() @IsDateString() plannedStartFrom?: string;
  @IsOptional() @IsDateString() plannedStartTo?: string;
  @IsOptional() @IsDateString() plannedEndFrom?: string;
  @IsOptional() @IsDateString() plannedEndTo?: string;
  @IsOptional() @IsUUID() createdById?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
  @IsOptional() @IsUUID() updatedById?: string;
  @IsOptional() @IsDateString() updatedFrom?: string;
  @IsOptional() @IsDateString() updatedTo?: string;
  @IsOptional() @IsIn(SORT_FIELDS) sortBy?: (typeof SORT_FIELDS)[number];
  @IsOptional() @IsIn(["asc", "desc"]) sortOrder?: "asc" | "desc";
  @IsOptional() @Transform(toInt) @IsInt() @Min(1) page?: number;
  @IsOptional() @Transform(toInt) @IsIn([10, 25, 50, 100]) pageSize?: number;
  @IsOptional() @IsIn(CHANGE_VIEWS) view?: (typeof CHANGE_VIEWS)[number];
  @IsOptional() @IsUUID() relatedIncidentId?: string;
  @IsOptional() @IsUUID() relatedProblemId?: string;
}

export class CreateChangeDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) shortDescription!: string;
  @ApiProperty() @IsString() @MinLength(3) description!: string;
  @ApiProperty({ enum: ChangeType }) @IsEnum(ChangeType) type!: ChangeType;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() categoryId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() subcategoryId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() requestedById?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() requestedForId?: string;
  @IsOptional() @IsString() businessJustification?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() businessServiceId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() configurationItemId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() relatedIncidentId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() relatedProblemId?: string;
  @IsOptional() @IsEnum(ImpactLevel) businessImpact?: ImpactLevel;
  @IsOptional() @IsEnum(ImpactLevel) technicalImpact?: ImpactLevel;
  @IsOptional() @IsEnum(Urgency) urgency?: Urgency;
  @IsOptional() @IsEnum(Probability) probability?: Probability;
  @IsOptional() @IsInt() @Min(0) impactedUsers?: number;
  @IsOptional() @IsBoolean() downtimeRequired?: boolean;
  @IsOptional() @IsInt() @Min(0) estimatedDowntimeMinutes?: number;
  @IsOptional() @IsString() riskAssessmentNarrative?: string;
  @IsOptional() @IsString() impactAnalysis?: string;
  @IsOptional() @IsDateString() plannedStart?: string;
  @IsOptional() @IsDateString() plannedEnd?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() maintenanceWindowId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() assignmentGroupId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() implementationGroupId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() changeOwnerId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() implementationLeadId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() changeCoordinatorId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() assignedToId?: string;
  @IsOptional() @IsBoolean() backoutRequired?: boolean;
  @IsOptional() @IsString() backoutPlan?: string;
  @IsOptional() @IsString() backoutTriggerConditions?: string;
  @IsOptional() @IsString() rollbackSteps?: string;
  @IsOptional() @IsInt() @Min(0) rollbackDurationMinutes?: number;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() rollbackOwnerId?: string;
  @IsOptional() @IsString() emergencyJustification?: string;
  @IsOptional() @IsString() testPlan?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() templateId?: string;
  @IsOptional() @IsArray() @IsUUID("4", { each: true }) affectedCiIds?: string[];
  @IsOptional() @IsArray() @IsUUID("4", { each: true }) affectedServiceIds?: string[];
}

export class UpdateChangeDto extends CreateChangeDto {
  @ApiProperty() @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() assessmentSummary?: string;
  @IsOptional() @IsDateString() actualStart?: string;
  @IsOptional() @IsDateString() actualEnd?: string;
  @IsOptional() @IsString() implementationStatus?: string;
  @IsOptional() @IsString() implementationSummary?: string;
  @IsOptional() @IsEnum(ImplementationOutcome) implementationOutcome?: ImplementationOutcome;
  @IsOptional() @IsString() serviceImpactSummary?: string;
  @IsOptional() @IsString() issuesEncountered?: string;
  @IsOptional() @IsBoolean() rollbackExecuted?: boolean;
  @IsOptional() @IsString() resolutionDetails?: string;
}

export class StateDto {
  @IsEnum(ChangeState) toState!: ChangeState;
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() justification?: string;
  @IsOptional() @IsEnum(ImplementationOutcome) implementationOutcome?: ImplementationOutcome;
}

export class AssessDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsBoolean() complete?: boolean;
  @IsOptional() @IsString() assessmentSummary?: string;
}

export class AssignDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() assignmentGroupId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() assignedToId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() changeOwnerId?: string;
  @IsOptional() @Transform(blankToUndefined) @IsUUID() implementationLeadId?: string;
}

export class PreviewDto {
  @IsEnum(ChangeType) type!: ChangeType;
  @IsOptional() @IsEnum(ImpactLevel) businessImpact?: ImpactLevel;
  @IsOptional() @IsEnum(ImpactLevel) technicalImpact?: ImpactLevel;
  @IsOptional() @IsEnum(Urgency) urgency?: Urgency;
  @IsOptional() @IsEnum(Probability) probability?: Probability;
  @IsOptional() @IsBoolean() downtimeRequired?: boolean;
  @IsOptional() @IsInt() @Min(0) impactedUsers?: number;
}

export class DecisionDto {
  @IsIn(["APPROVED", "REJECTED", "MORE_INFO", "DELEGATED"]) decision!: "APPROVED" | "REJECTED" | "MORE_INFO" | "DELEGATED";
  @IsOptional() @IsString() comments?: string;
  @IsOptional() @IsUUID() delegateUserId?: string;
  @IsInt() @Min(1) version!: number;
}

export class CreateApprovalDto {
  @IsEnum(ApprovalType) approvalType!: ApprovalType;
  @IsInt() @Min(1) sequence!: number;
  @IsString() requiredRole!: string;
  @IsOptional() @IsUUID() approverId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class TaskDto {
  @IsString() @MinLength(3) description!: string;
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsUUID() assignmentGroupId?: string;
  @IsOptional() @IsDateString() plannedStart?: string;
  @IsOptional() @IsDateString() plannedEnd?: string;
  @IsOptional() @IsInt() @Min(0) estimatedMinutes?: number;
  @IsOptional() @IsDateString() actualStart?: string;
  @IsOptional() @IsDateString() actualEnd?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsString() completionComments?: string;
  @IsOptional() @IsArray() @IsUUID("4", { each: true }) dependsOnIds?: string[];
}

export class TestCaseDto {
  @IsString() @MinLength(3) description!: string;
  @IsString() @MinLength(1) expectedResults!: string;
  @IsOptional() @IsString() validationCriteria?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() actualResults?: string;
  @IsOptional() @IsEnum(TestStatus) status?: TestStatus;
}

export class NoteDto {
  @IsEnum(NoteType) noteType!: NoteType;
  @IsString() @MinLength(1) @MaxLength(8000) content!: string;
}

export class PirActionDto {
  @IsString() description!: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class PirDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsUUID() conductedById?: string;
  @IsOptional() @IsDateString() conductedAt?: string;
  @IsOptional() @IsString() expectedVsActual?: string;
  @IsOptional() @IsString() disruption?: string;
  @IsOptional() @IsString() customerImpact?: string;
  @IsOptional() @IsBoolean() successCriteriaMet?: boolean;
  @IsOptional() @IsString() lessonsLearned?: string;
  @IsOptional() @IsEnum(PirResult) result?: PirResult;
  @IsOptional() @IsArray() @Type(() => PirActionDto) actions?: PirActionDto[];
}

export class CalendarQueryDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
}

export class ConflictQueryDto {
  @IsDateString() plannedStart!: string;
  @IsDateString() plannedEnd!: string;
  @IsOptional() @IsUUID() configurationItemId?: string;
  @IsOptional() @IsUUID() businessServiceId?: string;
  @IsOptional() @Transform(toStringArray) @IsArray() affectedCiIds?: string[];
  @IsOptional() @Transform(toStringArray) @IsArray() affectedServiceIds?: string[];
  @IsOptional() @IsUUID() excludeChangeId?: string;
}
