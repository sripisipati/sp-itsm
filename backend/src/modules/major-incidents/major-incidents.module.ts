import { Controller, Get, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

@ApiTags("major-incidents")
@ApiBearerAuth()
@Controller("major-incidents")
class MajorIncidentsController {
  @Get()
  status() {
    return { data: { module: "major-incidents", status: "coming_soon" } };
  }
}

@Module({ controllers: [MajorIncidentsController] })
export class MajorIncidentsModule {}
