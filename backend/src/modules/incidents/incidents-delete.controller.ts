import { Controller, Delete, HttpCode, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "../../generated/prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { AttachmentsService } from "../attachments/attachments.service";

@ApiTags("incidents")
@ApiBearerAuth()
@Controller("incidents")
export class IncidentAttachmentDeleteController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Roles(RoleName.ITSM_ADMINISTRATOR, RoleName.INCIDENT_MANAGER, RoleName.SUPPORT_AGENT, RoleName.REQUESTER)
  @Delete(":id/attachments/:attachmentId")
  @HttpCode(200)
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachments.remove(user, id, attachmentId);
  }
}
