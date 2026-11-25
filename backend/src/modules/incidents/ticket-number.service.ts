import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { formatTicketNumber } from "./domain/incident-rules";

@Injectable()
export class TicketNumberService {
  async next(tx: Prisma.TransactionClient): Promise<string> {
    const settings = await tx.appSetting.findMany({
      where: { key: { in: ["ticket.prefix", "ticket.padLength"] } },
    });
    const prefix = settings.find((row) => row.key === "ticket.prefix")?.value ?? "INC";
    const pad = Number(settings.find((row) => row.key === "ticket.padLength")?.value ?? 7);
    const rows = await tx.$queryRaw<Array<{ next_number: number }>>`
      UPDATE ticket_sequences
      SET next_number = next_number + 1
      WHERE prefix = ${prefix}
      RETURNING next_number
    `;
    const sequence = Number(rows[0]?.next_number);
    if (!Number.isInteger(sequence)) {
      throw new InternalServerErrorException("Ticket numbering is not configured.");
    }
    return formatTicketNumber(prefix, sequence, pad);
  }
}
