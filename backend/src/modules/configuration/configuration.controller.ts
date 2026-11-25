import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { Impact, Urgency } from "../../generated/prisma/client";
import { ConfigurationService } from "./configuration.service";

class PriorityQueryDto {
  @IsEnum(Impact)
  impact!: Impact;

  @IsEnum(Urgency)
  urgency!: Urgency;
}

class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

@ApiTags("configuration")
@ApiBearerAuth()
@Controller()
export class ConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get("categories")
  categories() {
    return this.configuration.categories();
  }

  @Get("configuration-items")
  configurationItems(@Query() query: SearchQueryDto) {
    return this.configuration.configurationItems(query.search);
  }

  @Get("business-services")
  businessServices() {
    return this.configuration.businessServices();
  }

  @Get("configuration/resolution-codes")
  resolutionCodes() {
    return this.configuration.resolutionCodes();
  }

  @Get("configuration/priority-matrix")
  priorityMatrix() {
    return this.configuration.priorityMatrix();
  }

  @Get("configuration/priority")
  priority(@Query() query: PriorityQueryDto) {
    return this.configuration.resolve(query.impact, query.urgency);
  }

  @Get("configuration/status-transitions")
  statusTransitions() {
    return this.configuration.statusTransitions();
  }

  @Get("configuration/settings")
  settings() {
    return this.configuration.settings();
  }
}
