import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
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
  ValidateIf,
} from "class-validator";
import { Impact, IncidentStatus, NoteType, Priority, Severity, Urgency } from "../../../generated/prisma/client";

function emptyToNull({ value }: { value: unknown }) {
  if (value === "" || value === undefined) return undefined;
  return value;
}

export class IncidentQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ enum: [10, 25, 50, 100] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(40)
  sortBy?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(40)
  ticketNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ enum: Severity })
  @IsOptional()
  @Transform(emptyToNull)
  @IsEnum(Severity)
  severity?: Severity;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @Transform(emptyToNull)
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(80)
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  assignedOnFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  assignedOnTo?: string;

  @ApiPropertyOptional({ description: "Comma-separated statuses" })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  createdOnFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  createdOnTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  updatedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  updatedOnFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  updatedOnTo?: string;

  @ApiPropertyOptional({ enum: ["all", "mine", "unassigned"] })
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(["all", "mine", "unassigned"])
  view?: "all" | "mine" | "unassigned";
}

export class IncidentFieldsDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  shortDescription!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(8000)
  description!: string;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  subcategoryId?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  callerId?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  contactInformation?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  configurationItemId?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  businessServiceId?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  affectedLocation?: string | null;

  @ApiProperty({ enum: Impact })
  @IsEnum(Impact)
  impact!: Impact;

  @ApiProperty({ enum: Urgency })
  @IsEnum(Urgency)
  urgency!: Urgency;

  @ApiProperty({ enum: Severity })
  @IsEnum(Severity)
  severity!: Severity;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  impactedUsers?: number;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignmentGroupId?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignedToId?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  resolutionCode?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(8000)
  resolutionNotes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  initialWorkNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  initialComment?: string;
}

export class UpdateIncidentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  subcategoryId?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  callerId?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => (typeof value === "string" && value.trim() === "" ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  contactInformation?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  configurationItemId?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  businessServiceId?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => (typeof value === "string" && value.trim() === "" ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  affectedLocation?: string | null;

  @ApiPropertyOptional({ enum: Impact })
  @IsOptional()
  @IsEnum(Impact)
  impact?: Impact;

  @ApiPropertyOptional({ enum: Urgency })
  @IsOptional()
  @IsEnum(Urgency)
  urgency?: Urgency;

  @ApiPropertyOptional({ enum: Severity })
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  impactedUsers?: number;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignmentGroupId?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignedToId?: string | null;

  @ApiPropertyOptional({ enum: IncidentStatus })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional()
  @Transform(({ value }) => (typeof value === "string" && value.trim() === "" ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  resolutionCode?: string | null;

  @ApiPropertyOptional()
  @Transform(({ value }) => (typeof value === "string" && value.trim() === "" ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(8000)
  resolutionNotes?: string | null;
}

export class UpdateStatusDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ enum: IncidentStatus })
  @IsEnum(IncidentStatus)
  status!: IncidentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  resolutionCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  resolutionNotes?: string;
}

export class AssignIncidentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignmentGroupId?: string | null;

  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignedToId?: string | null;
}

export class CreateNoteDto {
  @ApiProperty({ enum: NoteType })
  @IsEnum(NoteType)
  noteType!: NoteType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}
