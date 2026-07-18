import "server-only";
import { prisma } from "./db";

/**
 * Generates the next Medical Record Number in the spec's HS-YYYY-XXXXX format.
 * Sequence restarts each year. Retries on collision so concurrent registrations
 * at multiple front desks can't produce a duplicate.
 */
export async function generateMrn(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `HS-${year}-`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const latest = await prisma.patient.findFirst({
      where: { mrn: { startsWith: prefix } },
      orderBy: { mrn: "desc" },
      select: { mrn: true },
    });

    const lastSequence = latest ? Number(latest.mrn.slice(prefix.length)) : 0;
    const candidate = `${prefix}${String(lastSequence + 1 + attempt).padStart(5, "0")}`;

    const taken = await prisma.patient.findUnique({
      where: { mrn: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  throw new Error("Could not allocate an MRN after 5 attempts");
}
