import { describe, expect, it } from "vitest";
import { invoiceItemSchema } from "./schemas/invoices.schema.js";

import {
  calculateInvoiceItem,
  calculateInvoiceTotals,
  getFinancialYear,
} from "./invoice-calculations.js";


describe("invoiceItemSchema decimal precision", () => {
  const validItem = {
    description: "Precision test item",
    quantity: 1,
    rate: 1,
  };

  it("accepts quantity with three decimal places", () => {
    expect(
      invoiceItemSchema.safeParse({
        ...validItem,
        quantity: 1.234,
      }).success,
    ).toBe(true);
  });

  it("rejects quantity with more than three decimal places", () => {
    expect(
      invoiceItemSchema.safeParse({
        ...validItem,
        quantity: 1.23400000001,
      }).success,
    ).toBe(false);
  });

  it("accepts a valid two-decimal rate such as 0.29", () => {
    expect(
      invoiceItemSchema.safeParse({
        ...validItem,
        rate: 0.29,
      }).success,
    ).toBe(true);
  });

  it("rejects a rate with fractional paise", () => {
    expect(
      invoiceItemSchema.safeParse({
        ...validItem,
        rate: 0.29000000001,
      }).success,
    ).toBe(false);
  });
});
describe("getFinancialYear", () => {
  it("uses the previous financial year before April", () => {
    expect(getFinancialYear("2026-03-31")).toBe("2025-26");
  });

  it("starts the new financial year on April 1", () => {
    expect(getFinancialYear("2026-04-01")).toBe("2026-27");
  });

  it("handles dates within the same financial year", () => {
    expect(getFinancialYear("2026-11-23")).toBe("2026-27");
  });

  it("rejects an invalid calendar date", () => {
    expect(() => getFinancialYear("2026-02-30")).toThrow(
      "INVALID_INVOICE_DATE",
    );
  });
});

describe("calculateInvoiceItem", () => {
  it("calculates taxable amount using decimal quantities", () => {
    const result = calculateInvoiceItem(
      { quantity: 1.234, rate: 10 },
      false,
      null,
    );

    expect(result).toEqual({
      amount: "12.34",
      gstRate: "0.00",
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: "0.00",
    });
  });

  it("calculates intra-state CGST and SGST", () => {
    const result = calculateInvoiceItem(
      { quantity: 2, rate: 100, gstRate: 18 },
      true,
      "intra_state",
    );

    expect(result).toEqual({
      amount: "200.00",
      gstRate: "18.00",
      cgstAmount: "18.00",
      sgstAmount: "18.00",
      igstAmount: "0.00",
    });
  });

  it("rounds intra-state GST once and assigns an odd paisa remainder to SGST", () => {
    const result = calculateInvoiceItem(
      { quantity: 1, rate: 0.1, gstRate: 5 },
      true,
      "intra_state",
    );

    expect(result).toEqual({
      amount: "0.10",
      gstRate: "5.00",
      cgstAmount: "0.00",
      sgstAmount: "0.01",
      igstAmount: "0.00",
    });
  });

  it("produces the same rounded GST total for intra-state and inter-state supplies", () => {
    const intraState = calculateInvoiceItem(
      { quantity: 1, rate: 0.1, gstRate: 5 },
      true,
      "intra_state",
    );

    const interState = calculateInvoiceItem(
      { quantity: 1, rate: 0.1, gstRate: 5 },
      true,
      "inter_state",
    );

    expect(intraState.cgstAmount).toBe("0.00");
    expect(intraState.sgstAmount).toBe("0.01");
    expect(interState.igstAmount).toBe("0.01");
  });
  it("calculates inter-state IGST", () => {
    const result = calculateInvoiceItem(
      { quantity: 2, rate: 100, gstRate: 18 },
      true,
      "inter_state",
    );

    expect(result).toEqual({
      amount: "200.00",
      gstRate: "18.00",
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: "36.00",
    });
  });

  it("supports zero-rated GST", () => {
    const result = calculateInvoiceItem(
      { quantity: 1, rate: 500, gstRate: 0 },
      true,
      "intra_state",
    );

    expect(result.amount).toBe("500.00");
    expect(result.cgstAmount).toBe("0.00");
    expect(result.sgstAmount).toBe("0.00");
  });

  it("rounds taxable amounts to two decimal places", () => {
    const result = calculateInvoiceItem(
      { quantity: 1.005, rate: 10 },
      false,
      null,
    );

    expect(result.amount).toBe("10.05");
  });

  it("rejects GST calculations without a supply type", () => {
    expect(() =>
      calculateInvoiceItem({ quantity: 1, rate: 100, gstRate: 18 }, true, null),
    ).toThrow("GST_SUPPLY_TYPE_REQUIRED");
  });
});

describe("calculateInvoiceTotals", () => {
  it("calculates subtotal, tax and grand total", () => {
    const item1 = calculateInvoiceItem(
      { quantity: 2, rate: 100, gstRate: 18 },
      true,
      "intra_state",
    );

    const item2 = calculateInvoiceItem(
      { quantity: 1, rate: 50, gstRate: 5 },
      true,
      "intra_state",
    );

    const totals = calculateInvoiceTotals([item1, item2]);

    expect(totals).toEqual({
      subtotal: "250.00",
      cgstTotal: "19.25",
      sgstTotal: "19.25",
      igstTotal: "0.00",
      totalTax: "38.50",
      roundOff: "0.50",
      grandTotal: "289.00",
    });
  });

  it("calculates totals for inter-state invoices", () => {
    const item = calculateInvoiceItem(
      { quantity: 1, rate: 1000, gstRate: 12 },
      true,
      "inter_state",
    );

    const totals = calculateInvoiceTotals([item]);

    expect(totals.subtotal).toBe("1000.00");
    expect(totals.igstTotal).toBe("120.00");
    expect(totals.totalTax).toBe("120.00");
    expect(totals.grandTotal).toBe("1120.00");
  });

  it("does not add tax when GST is disabled", () => {
    const item = calculateInvoiceItem({ quantity: 3, rate: 125 }, false, null);

    const totals = calculateInvoiceTotals([item]);

    expect(totals.subtotal).toBe("375.00");
    expect(totals.totalTax).toBe("0.00");
    expect(totals.grandTotal).toBe("375.00");
  });

  it("rounds down when the paise amount is below 50", () => {
    const item = calculateInvoiceItem(
      { quantity: 1, rate: 288.49 },
      false,
      null,
    );

    const totals = calculateInvoiceTotals([item]);

    expect(totals.subtotal).toBe("288.49");
    expect(totals.roundOff).toBe("-0.49");
    expect(totals.grandTotal).toBe("288.00");
  });

  it("rounds up when the paise amount is exactly 50", () => {
    const item = calculateInvoiceItem(
      { quantity: 1, rate: 288.5 },
      false,
      null,
    );

    const totals = calculateInvoiceTotals([item]);

    expect(totals.subtotal).toBe("288.50");
    expect(totals.roundOff).toBe("0.50");
    expect(totals.grandTotal).toBe("289.00");
  });
});
