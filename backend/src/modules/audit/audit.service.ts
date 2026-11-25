import { Injectable } from "@nestjs/common";
import { HistoryActionType, Prisma } from "../../generated/prisma/client";

export interface AuditWrite {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  actionType: HistoryActionType;
}

@Injectable()
export class AuditService {
  async record(
    tx: Prisma.TransactionClient,
    incidentId: string,
    changedById: string,
    entries: AuditWrite[],
    changedAt = new Date(),
  ): Promise<void> {
    const meaningful = entries.filter((entry) => entry.oldValue !== entry.newValue || entry.actionType === HistoryActionType.CREATED);
    if (meaningful.length === 0) return;
    await tx.incidentHistory.createMany({
      data: meaningful.map((entry) => ({
        incidentId,
        fieldName: entry.fieldName,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        actionType: entry.actionType,
        changedById,
        changedAt,
      })),
    });
  }
}
