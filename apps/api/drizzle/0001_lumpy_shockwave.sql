CREATE TYPE "public"."invoice_supply_type" AS ENUM('intra_state', 'inter_state');--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_totals_nonnegative";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_gst_applicable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "supply_type" "invoice_supply_type";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "cgst_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sgst_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "igst_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "total_tax" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "gst_rate" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "cgst_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "sgst_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "igst_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_gst_supply_type_check" CHECK (
        ("invoices"."is_gst_applicable" = true AND "invoices"."supply_type" IS NOT NULL)
        OR
        ("invoices"."is_gst_applicable" = false AND "invoices"."supply_type" IS NULL)
      );--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_totals_nonnegative" CHECK (
        "invoices"."subtotal" >= 0
        AND "invoices"."cgst_total" >= 0
        AND "invoices"."sgst_total" >= 0
        AND "invoices"."igst_total" >= 0
        AND "invoices"."total_tax" >= 0
        AND "invoices"."grand_total" >= 0
      );--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_gst_rate_allowed" CHECK ("invoice_items"."gst_rate" IN (0, 5, 12, 18, 28));--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tax_amounts_nonnegative" CHECK (
        "invoice_items"."cgst_amount" >= 0
        AND "invoice_items"."sgst_amount" >= 0
        AND "invoice_items"."igst_amount" >= 0
      );