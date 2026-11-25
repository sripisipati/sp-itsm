import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AssignmentsService } from "./assignments.service";

@ApiTags("assignment-groups")
@ApiBearerAuth()
@Controller("assignment-groups")
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  list() {
    return this.assignments.listGroups();
  }
}
