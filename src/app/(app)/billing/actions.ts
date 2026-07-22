"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { PAYMENT_METHODS } from "@/lib/enums";

export type BillingState = { error?: string };

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
});
const itemsArraySchema = z.array(lineItemSchema).min(1, "Add at least one line item");

const invoiceSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  appointmentId: z.string().optional(),
  itemsJson: z.string().min(1),
  dueDate: z.string().optional(),
});

export async function createInvoice(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const session = await requireSession();
  authorize(session, "billing:write");

  const parsed = invoiceSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let itemsRaw: unknown;
  try {
    itemsRaw = JSON.parse(parsed.data.itemsJson);
  } catch {
    return { error: "Invalid line items" };
  }
  const items = itemsArraySchema.safeParse(itemsRaw);
  if (!items.success) return { error: items.error.issues[0].message };

  const total = items.data.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const invoice = await prisma.invoice.create({
    data: {
      patientId: parsed.data.patientId,
      createdById: session.id,
      appointmentId: parsed.data.appointmentId || null,
      items: JSON.stringify(items.data),
      total,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
  });

  await audit(session, "invoice.create", "invoice", invoice.id, {
    patientId: parsed.data.patientId,
    total,
  });

  revalidatePath("/billing");
  redirect(`/billing/${invoice.id}`);
}

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().optional(),
});

export async function recordPayment(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const session = await requireSession();
  authorize(session, "billing:write");

  const parsed = paymentSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { invoiceId, amount, method, reference } = parsed.data;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status === "void") return { error: "This invoice has been voided" };

  await prisma.payment.create({
    data: { invoiceId, amount, method, reference: reference || null, recordedById: session.id },
  });

  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0) + amount;
  const newStatus = totalPaid >= invoice.total ? "paid" : "partial";
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });

  await audit(session, "invoice.payment", "invoice", invoiceId, { amount, method });

  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
  return {};
}

export async function voidInvoice(formData: FormData) {
  const session = await requireSession();
  authorize(session, "billing:write");

  const id = String(formData.get("invoiceId") ?? "");
  if (!id) return;

  await prisma.invoice.update({ where: { id }, data: { status: "void" } });
  await audit(session, "invoice.void", "invoice", id);

  revalidatePath("/billing");
  revalidatePath(`/billing/${id}`);
}
