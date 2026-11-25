const MAX_NUMERIC_14_2_CENTS = 99_999_999_999_999n;

function toScaledInteger(value: number, scale: number): bigint {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("INVALID_INVOICE_AMOUNT");
  }

  const scaled = Math.round(value * scale);

  if (!Number.isSafeInteger(scaled)) {
    throw new Error("INVOICE_AMOUNT_OUT_OF_RANGE");
  }

  return BigInt(scaled);
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error("INVALID_CALCULATION_DENOMINATOR");
  }

  return (numerator + denominator / 2n) / denominator;
}

function assertNumeric14_2(value: bigint): void {
  if (value < 0n || value > MAX_NUMERIC_14_2_CENTS) {
    throw new Error("INVOICE_AMOUNT_OUT_OF_RANGE");
  }
}

export function formatPaise(value: bigint): string {
  assertNumeric14_2(value);

  const rupees = value / 100n;
  const paise = (value % 100n).toString().padStart(2, "0");

  return `${rupees}.${paise}`;
}

function formatSignedPaise(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;

  const rupees = absolute / 100n;
  const paise = (absolute % 100n).toString().padStart(2, "0");

  return `${sign}${rupees}.${paise}`;
}

export function getFinancialYear(invoiceDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
    throw new Error("INVALID_INVOICE_DATE");
  }

  const [yearText, monthText, dayText] = invoiceDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("INVALID_INVOICE_DATE");
  }

  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;

  return `${startYear}-${String(endYear).slice(-2)}`;
}

export type InvoiceSupplyType = "intra_state" | "inter_state";

export interface InvoiceCalculationItemInput {
  quantity: number;
  rate: number;
  gstRate?: number;
}

export interface CalculatedInvoiceItem {
  amount: string;
  gstRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
}

export interface InvoiceTotals {
  subtotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  totalTax: string;
  roundOff: string;
  grandTotal: string;
}

export function calculateInvoiceItem(
  input: InvoiceCalculationItemInput,
  isGstApplicable: boolean,
  supplyType: InvoiceSupplyType | null,
): CalculatedInvoiceItem {
  const quantityMilli = toScaledInteger(input.quantity, 1000);
  const ratePaise = toScaledInteger(input.rate, 100);

  const amountPaise = roundHalfUp(quantityMilli * ratePaise, 1000n);

  assertNumeric14_2(amountPaise);

  const gstRate = isGstApplicable ? (input.gstRate ?? 0) : 0;

  if (![0, 5, 12, 18, 28].includes(gstRate)) {
    throw new Error("INVALID_GST_RATE");
  }

  if (isGstApplicable && !supplyType) {
    throw new Error("GST_SUPPLY_TYPE_REQUIRED");
  }

  let cgstPaise = 0n;
  let sgstPaise = 0n;
  let igstPaise = 0n;

  if (isGstApplicable) {
    const totalGstPaise = roundHalfUp(
      amountPaise * BigInt(gstRate),
      100n,
    );

    if (supplyType === "intra_state") {
      cgstPaise = totalGstPaise / 2n;
      sgstPaise = totalGstPaise - cgstPaise;
    }

    if (supplyType === "inter_state") {
      igstPaise = totalGstPaise;
    }
  }

  assertNumeric14_2(cgstPaise);
  assertNumeric14_2(sgstPaise);
  assertNumeric14_2(igstPaise);

  return {
    amount: formatPaise(amountPaise),
    gstRate: gstRate.toFixed(2),
    cgstAmount: formatPaise(cgstPaise),
    sgstAmount: formatPaise(sgstPaise),
    igstAmount: formatPaise(igstPaise),
  };
}

// export function calculateInvoiceTotals(
//   items: CalculatedInvoiceItem[],
// ): InvoiceTotals {
//   let subtotalPaise = 0n;
//   let cgstTotalPaise = 0n;
//   let sgstTotalPaise = 0n;
//   let igstTotalPaise = 0n;

//   for (const item of items) {
//     subtotalPaise += toScaledInteger(Number(item.amount), 100);
//     cgstTotalPaise += toScaledInteger(Number(item.cgstAmount), 100);
//     sgstTotalPaise += toScaledInteger(Number(item.sgstAmount), 100);
//     igstTotalPaise += toScaledInteger(Number(item.igstAmount), 100);
//   }

//   const totalTaxPaise = cgstTotalPaise + sgstTotalPaise + igstTotalPaise;

//   const grandTotalPaise = subtotalPaise + totalTaxPaise;

//   assertNumeric14_2(subtotalPaise);
//   assertNumeric14_2(cgstTotalPaise);
//   assertNumeric14_2(sgstTotalPaise);
//   assertNumeric14_2(igstTotalPaise);
//   assertNumeric14_2(totalTaxPaise);
//   assertNumeric14_2(grandTotalPaise);

//   return {
//     subtotal: formatPaise(subtotalPaise),
//     cgstTotal: formatPaise(cgstTotalPaise),
//     sgstTotal: formatPaise(sgstTotalPaise),
//     igstTotal: formatPaise(igstTotalPaise),
//     totalTax: formatPaise(totalTaxPaise),
//     roundOff: "0.00",
//     grandTotal: formatPaise(grandTotalPaise),
//   };
// }

export function calculateInvoiceTotals(
  items: CalculatedInvoiceItem[],
): InvoiceTotals {
  let subtotalPaise = 0n;
  let cgstTotalPaise = 0n;
  let sgstTotalPaise = 0n;
  let igstTotalPaise = 0n;

  for (const item of items) {
    subtotalPaise += toScaledInteger(Number(item.amount), 100);
    cgstTotalPaise += toScaledInteger(Number(item.cgstAmount), 100);
    sgstTotalPaise += toScaledInteger(Number(item.sgstAmount), 100);
    igstTotalPaise += toScaledInteger(Number(item.igstAmount), 100);
  }

  const totalTaxPaise = cgstTotalPaise + sgstTotalPaise + igstTotalPaise;

  const amountBeforeRoundOff = subtotalPaise + totalTaxPaise;

  // Round the final invoice amount to the nearest whole rupee.
  // 0.50 and above rounds up; below 0.50 rounds down.
  const roundedGrandTotalPaise = ((amountBeforeRoundOff + 50n) / 100n) * 100n;

  const roundOffPaise = roundedGrandTotalPaise - amountBeforeRoundOff;

  assertNumeric14_2(subtotalPaise);
  assertNumeric14_2(cgstTotalPaise);
  assertNumeric14_2(sgstTotalPaise);
  assertNumeric14_2(igstTotalPaise);
  assertNumeric14_2(totalTaxPaise);
  assertNumeric14_2(roundedGrandTotalPaise);

  return {
    subtotal: formatPaise(subtotalPaise),
    cgstTotal: formatPaise(cgstTotalPaise),
    sgstTotal: formatPaise(sgstTotalPaise),
    igstTotal: formatPaise(igstTotalPaise),
    totalTax: formatPaise(totalTaxPaise),
    roundOff: formatSignedPaise(roundOffPaise),
    grandTotal: formatPaise(roundedGrandTotalPaise),
  };
}
