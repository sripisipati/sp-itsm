import { Module } from "@nestjs/common";
import { StorageService } from "../attachments/storage.service";
import { CabController } from "./cab.controller";
import { ChangeRiskService } from "./change-risk.service";
import { ChangeWorkflowService } from "./change-workflow.service";
import { ApprovalsController, ChangesController } from "./changes.controller";
import { ChangesService } from "./changes.service";
import { ChangePoliciesController } from "./policies.controller";

@Module({
  controllers: [ChangesController, ApprovalsController, CabController, ChangePoliciesController],
  providers: [ChangesService, ChangeWorkflowService, ChangeRiskService, StorageService],
  exports: [ChangesService, ChangeRiskService],
})
export class ChangesModule {}
