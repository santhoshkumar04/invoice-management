import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "technician"]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "cancelled",
]);

export const invoiceSupplyTypeEnum = pgEnum("invoice_supply_type", [
  "intra_state",
  "inter_state",
]);

export const documentCopyEnum = pgEnum("document_copy", [
  "original",
  "duplicate",
  "triplicate",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "bank_transfer",
  "upi",
  "cheque",
  "card",
  "other",
]);

export const adjustmentTypeEnum = pgEnum("adjustment_type", [
  "credit",
  "debit",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "revoked",
  "expired",
]);
