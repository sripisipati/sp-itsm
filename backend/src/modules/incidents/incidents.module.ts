import { Module } from "@nestjs/common";
import { AssignmentsModule } from "../assignments/assignments.module";
import { AttachmentsService } from "../attachments/attachments.service";
import { StorageService } from "../attachments/storage.service";
import { AuditModule } from "../audit/audit.module";
import { ConfigurationModule } from "../configuration/configuration.module";
import { NotesService } from "../notes/notes.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { IncidentGate } from "./incident-gate.service";
import { IncidentAttachmentDeleteController } from "./incidents-delete.controller";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";
import { TicketNumberService } from "./ticket-number.service";

@Module({
  imports: [AuditModule, ConfigurationModule, AssignmentsModule, NotificationsModule],
  controllers: [IncidentsController, IncidentAttachmentDeleteController],
  providers: [IncidentsService, IncidentGate, TicketNumberService, NotesService, AttachmentsService, StorageService],
  exports: [IncidentGate],
})
export class IncidentsModule {}
