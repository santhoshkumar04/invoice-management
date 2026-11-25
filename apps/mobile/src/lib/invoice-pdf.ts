import type { InvoiceDetail, InvoiceLineItem } from "./invoices-api";
import { amountInWords } from "./amount-in-words";

export type InvoiceCopyType = "ORIGINAL" | "DUPLICATE" | "TRIPLICATE";

type DataRecord = Record<string, unknown>;

function asRecord(value: unknown): DataRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as DataRecord;
  }

  return {};
}

function readString(record: DataRecord, key: string): string | null {
  const value = record[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return escapeHtml(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(
  value: string | number | null | undefined,
  currency: string,
): string {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return "—";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatQuantity(value: string | number): string {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? amount.toLocaleString("en-IN", {
        maximumFractionDigits: 3,
      })
    : "—";
}

function addressLines(record: DataRecord): string[] {
  return [
    "addressLine1",
    "addressLine2",
    "state",
    "district",
    "city",
    "postalCode",
    // "country",
  ]
    .map((key) => readString(record, key))
    .filter((value): value is string => Boolean(value));
}

function renderAddress(record: DataRecord): string {
  return addressLines(record)
    .map((line) => escapeHtml(line))
    .join("<br>");
}

function renderInfoRow(label: string, value: string | null): string {
  if (!value) return "";

  return `
    <div class="info-row">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
}

function renderItem(
  item: InvoiceLineItem,
  index: number,
  currency: string,
  gstEnabled: boolean,
  supplyType: string | null,
): string {
  const taxColumns = !gstEnabled
    ? ""
    : supplyType === "intra_state"
      ? `
        <td class="number">${Number(item.gstRate).toFixed(2)}%</td>
        <td class="number">${formatAmount(item.cgstAmount, currency)}</td>
        <td class="number">${formatAmount(item.sgstAmount, currency)}</td>
      `
      : `
        <td class="number">${Number(item.gstRate).toFixed(2)}%</td>
        <td class="number">${formatAmount(item.igstAmount, currency)}</td>
      `;

  return `
    <tr>
      <td class="serial">${index + 1}</td>
      <td class="description">${escapeHtml(item.description)}</td>
      <td class="number">${formatQuantity(item.quantity)}</td>
      <td class="number">${formatAmount(item.rate, currency)}</td>
      <td class="number">${formatAmount(item.amount, currency)}</td>
      ${taxColumns}
    </tr>
  `;
}

function renderCopySelection(selected: InvoiceCopyType): string {
  const copies: InvoiceCopyType[] = ["ORIGINAL", "DUPLICATE", "TRIPLICATE"];

  return copies
    .map((copy) => {
      const checked = selected === copy ? "checked" : "";

      return `
        <span class="copy-option">
          <span class="checkbox">${checked ? "&#10003;" : ""}</span>
          ${copy}
        </span>
      `;
    })
    .join("");
}

export function buildInvoiceHtml(
  invoice: InvoiceDetail,
  copyType: InvoiceCopyType = "ORIGINAL",
): string {
  const snapshot = asRecord(invoice.snapshot);
  const organization = asRecord(snapshot.organization);

  const snapshotCustomer = asRecord(snapshot.customer);
  const customer =
    Object.keys(snapshotCustomer).length > 0
      ? snapshotCustomer
      : asRecord(invoice.customer);

  const organizationName = readString(organization, "name") || "Company Name";

  const businessDescription = readString(organization, "businessDescription");

  const customerName =
    readString(customer, "companyName") ||
    readString(customer, "customerName") ||
    "Customer";

  const currency = invoice.currency || "INR";
  const gstEnabled = invoice.isGstApplicable;
  const supplyType = invoice.supplyType;

  const customerVendorCode =
    readString(customer, "vendorCode") ||
    readString(asRecord(invoice), "vendorCode");

  const customerState = readString(customer, "state");
  const customerStateCode = readString(customer, "stateCode");

  const customerStateLine =
    customerState || customerStateCode
      ? `${customerState || ""}${customerStateCode ? `, Code: ${customerStateCode}` : ""}`
      : null;

  const grandTotalInWords = amountInWords(invoice.grandTotal, currency);

  const logoUrl = readString(organization, "logoUrl");
  const safeLogoUrl =
    logoUrl && /^https?:\/\//i.test(logoUrl) ? escapeHtml(logoUrl) : null;

  const companyAddress = renderAddress(organization);
  const customerAddress = renderAddress(customer);

  const itemsHtml = invoice.items
    .map((item, index) =>
      renderItem(item, index, currency, gstEnabled, supplyType),
    )
    .join("");

  const gstHeaders = !gstEnabled
    ? ""
    : supplyType === "intra_state"
      ? `
        <th>GST %</th>
        <th>CGST</th>
        <th>SGST</th>
      `
      : `
        <th>GST %</th>
        <th>IGST</th>
      `;

  const gstSummary = !gstEnabled
    ? ""
    : supplyType === "intra_state"
      ? `
        <div class="total-row">
          <span>CGST</span>
          <strong>${formatAmount(invoice.cgstTotal, currency)}</strong>
        </div>
        <div class="total-row">
          <span>SGST</span>
          <strong>${formatAmount(invoice.sgstTotal, currency)}</strong>
        </div>
      `
      : `
        <div class="total-row">
          <span>IGST</span>
          <strong>${formatAmount(invoice.igstTotal, currency)}</strong>
        </div>
      `;

  const bankName = readString(organization, "bankName");
  const bankAccountName = readString(organization, "bankAccountName");
  const bankAccountNumber = readString(organization, "bankAccountNumber");
  const bankIfsc = readString(organization, "bankIfsc");

  const hasBankDetails = Boolean(
    bankName || bankAccountName || bankAccountNumber || bankIfsc,
  );

  const bankHtml = hasBankDetails
    ? `
      <section class="bank-details">
        <strong class="section-heading">BANK DETAILS</strong>
        ${renderInfoRow("Bank", bankName)}
        ${renderInfoRow("Account name", bankAccountName)}
        ${renderInfoRow("Account number", bankAccountNumber)}
        ${renderInfoRow("IFSC", bankIfsc)}
      </section>
    `
    : "";

  const signatory = readString(organization, "authorizedSignatory");

  const footer =
    readString(organization, "invoiceFooter") || "Thank you for your business.";

  const companyContact = [
    readString(organization, "email"),
    readString(organization, "mobile")
      ? `Mobile: ${readString(organization, "mobile")}`
      : null,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" &nbsp; ");

  const companyRegistration = [
    readString(organization, "gstin")
      ? `GSTIN: ${readString(organization, "gstin")}`
      : null,
    readString(organization, "pan")
      ? `PAN: ${readString(organization, "pan")}`
      : null,
    readString(organization, "vendorCode")
      ? `Company Vendor Code: ${readString(organization, "vendorCode")}`
      : null,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" &nbsp; | &nbsp; ");

  const customerRegistration = [
    readString(customer, "gstin")
      ? `GSTIN/UIN: ${readString(customer, "gstin")}`
      : null,
    readString(customer, "pan") ? `PAN: ${readString(customer, "pan")}` : null,
    customerStateLine ? `State Name: ${customerStateLine}` : null,
  ].filter(Boolean);

  const customerContact = [
    readString(customer, "contactPerson")
      ? `Contact: ${readString(customer, "contactPerson")}`
      : null,
    readString(customer, "mobile")
      ? `Mobile: ${readString(customer, "mobile")}`
      : null,
    readString(customer, "email"),
  ].filter(Boolean);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(invoice.invoiceNumber || "Invoice")}</title>

  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      line-height: 1.4;
    }

    .document {
      width: 100%;
      margin: 0 auto;
      border: 1px solid #222222;
    }

    .copy-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 5px 9px;
      border-bottom: 1px solid #222222;
      font-size: 9px;
      font-weight: 700;
    }

    .copy-option {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }

    .checkbox {
      width: 10px;
      height: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #222222;
      font-size: 9px;
    }

    .company-header {
      padding: 9px 10px 7px;
      text-align: center;
      border-bottom: 1px solid #222222;
    }

    .company-logo {
      display: block;
      max-width: 75px;
      max-height: 45px;
      object-fit: contain;
      margin: 0 auto 5px;
    }

    .company-name {
      margin: 0;
      font-size: 19px;
      line-height: 1.2;
      font-weight: 800;
    }

    .business-description {
      margin-top: 3px;
      font-size: 11px;
      font-style: italic;
    }

    .company-address {
      margin-top: 5px;
      font-weight: 700;
    }

    .company-contact {
      margin-top: 2px;
      font-weight: 700;
    }

    .company-registration {
      margin-top: 3px;
      font-size: 8px;
      overflow-wrap: anywhere;
    }

    .invoice-title {
      padding: 6px;
      border-bottom: 1px solid #222222;
      text-align: center;
      font-size: 15px;
      font-weight: 800;
    }

    .invoice-identification {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #222222;
    }

    .identification-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 32px;
      padding: 7px 9px;
    }

    .identification-cell:first-child {
      border-right: 1px solid #222222;
    }

    .field-label {
      font-weight: 800;
      white-space: nowrap;
    }

    .field-value {
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .billing-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #222222;
    }

    .billing-cell {
      min-width: 0;
      padding: 9px;
    }

    .billing-cell:first-child {
      border-right: 1px solid #222222;
    }

    .section-heading {
      display: block;
      margin-bottom: 5px;
      font-size: 10px;
      font-weight: 800;
    }

    .customer-name {
      margin-bottom: 3px;
      font-weight: 800;
      font-size: 11px;
    }

    .address {
      line-height: 1.55;
      overflow-wrap: anywhere;
    }

    .registration-line {
      margin-top: 5px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .vendor-code {
      margin-bottom: 5px;
    }

    .billing-period {
      margin-top: 35px;
    }

    .billing-period .field-value {
      display: inline-block;
      margin-left: 8px;
    }

    .invoice-items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .invoice-items thead {
      display: table-header-group;
    }

    .invoice-items th,
    .invoice-items td {
      border-right: 1px solid #222222;
      padding: 5px 4px;
      vertical-align: top;
    }

    .invoice-items th:last-child,
    .invoice-items td:last-child {
      border-right: none;
    }

    .invoice-items th {
      border-bottom: 1px solid #222222;
      font-weight: 800;
      text-align: center;
      font-size: 9px;
      background: #ffffff;
    }

    .invoice-items td {
      font-size: 9px;
    }

    .invoice-items tbody tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .serial {
      width: 6%;
      text-align: right;
    }

    .description {
      width: 44%;
      text-align: left;
      overflow-wrap: anywhere;
    }

    .number {
      text-align: right;
      white-space: nowrap;
    }

    .totals-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-top: 1px solid #222222;
    }

    .currency-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      border-right: 1px solid #222222;
      font-weight: 800;
    }

    .totals-cell {
      min-width: 0;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 5px 8px;
      border-bottom: 1px solid #222222;
    }

    .total-row strong {
      white-space: nowrap;
    }

    .grand-total {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 8px;
      font-size: 12px;
      font-weight: 800;
    }

    .grand-total span:last-child {
      white-space: nowrap;
    }

    .amount-words {
      padding: 7px 9px;
      border-top: 1px solid #222222;
      border-bottom: 1px solid #222222;
      overflow-wrap: anywhere;
    }

    .amount-words-label {
      display: inline-block;
      margin-right: 12px;
      font-weight: 800;
    }

    .amount-words-value {
      font-weight: 500;
    }

    .bank-details {
      padding: 9px;
      border-bottom: 1px solid #222222;
      break-inside: avoid;
    }

    .bank-details .info-row {
      display: flex;
      gap: 10px;
      padding: 2px 0;
    }

    .bank-details .info-row strong {
      min-width: 105px;
    }

    .notes {
      padding: 8px 9px;
      border-bottom: 1px solid #222222;
      overflow-wrap: anywhere;
    }

    .signature-section {
      min-height: 105px;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 12px;
    }

    .signature {
      min-width: 180px;
      text-align: center;
      font-weight: 800;
    }

    .signature-name {
      margin-bottom: 5px;
    }

    .footer {
      padding: 5px 9px;
      border-top: 1px solid #222222;
      text-align: center;
      font-size: 9px;
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .document {
        width: 100%;
      }

      .billing-section,
      .invoice-identification,
      .totals-section,
      .amount-words,
      .signature-section {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>

<body>
  <main class="document">

    <div class="copy-row">
      ${renderCopySelection(copyType)}
    </div>

    <header class="company-header">
      ${
        safeLogoUrl
          ? `<img class="company-logo" src="${safeLogoUrl}" alt="Company logo" />`
          : ""
      }

      <h1 class="company-name">${escapeHtml(organizationName)}</h1>

      ${
        businessDescription
          ? `<div class="business-description">${escapeHtml(businessDescription)}</div>`
          : ""
      }

      ${
        companyAddress
          ? `<div class="company-address">${companyAddress}</div>`
          : ""
      }

      ${
        companyContact
          ? `<div class="company-contact">${companyContact}</div>`
          : ""
      }

      ${
        companyRegistration
          ? `<div class="company-registration">${companyRegistration}</div>`
          : ""
      }
    </header>

    <div class="invoice-title">INVOICE</div>

    <section class="invoice-identification">
      <div class="identification-cell">
        <span class="field-label">INVOICE NO :</span>
        <span class="field-value">
          ${escapeHtml(invoice.invoiceNumber || "—")}
        </span>
      </div>

      <div class="identification-cell">
        <span class="field-label">DATE :</span>
        <span class="field-value">
          ${formatDate(invoice.invoiceDate)}
        </span>
      </div>
    </section>

    <section class="billing-section">
      <div class="billing-cell">
        <strong class="section-heading">BILLING ADDRESS</strong>

        <div class="customer-name">${escapeHtml(customerName)}</div>

        ${
          customerAddress ? `<div class="address">${customerAddress}</div>` : ""
        }

        ${
          customerContact.length
            ? `<div class="registration-line">${customerContact.map(escapeHtml).join("<br>")}</div>`
            : ""
        }

        ${
          customerRegistration.length
            ? `<div class="registration-line">${customerRegistration.map(escapeHtml).join("<br>")}</div>`
            : ""
        }
      </div>

      <div class="billing-cell">
        ${
          customerVendorCode
            ? `
              <div class="vendor-code">
                <strong>VENDOR CODE :</strong>
                ${escapeHtml(customerVendorCode)}
              </div>
            `
            : ""
        }

        ${renderInfoRow("PAN :", readString(customer, "pan"))}

        <div class="billing-period">
          <strong class="field-label">Bill Period :</strong>
          <span class="field-value">
            ${formatDate(invoice.billingPeriodStart)}
            to
            ${formatDate(invoice.billingPeriodEnd)}
          </span>
        </div>

        ${
          invoice.dueDate
            ? `
              <div class="registration-line">
                <strong>Due Date :</strong>
                ${formatDate(invoice.dueDate)}
              </div>
            `
            : ""
        }
      </div>
    </section>

    <table class="invoice-items">
      <thead>
        <tr>
          <th class="serial">SI.No</th>
          <th class="description">PARTICULARS</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
          ${gstHeaders}
        </tr>
      </thead>

      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <section class="totals-section">
      <div class="currency-cell">
        Currency: ${escapeHtml(currency)}
      </div>

      <div class="totals-cell">
        <div class="total-row">
          <span>Total</span>
          <strong>${formatAmount(invoice.subtotal, currency)}</strong>
        </div>

        ${gstSummary}

        ${
          gstEnabled
            ? `
              <div class="total-row">
                <span>Total Tax</span>
                <strong>${formatAmount(invoice.totalTax, currency)}</strong>
              </div>
            `
            : ""
        }

        <div class="total-row">
          <span>Round Off</span>
          <strong>${formatAmount(invoice.roundOff, currency)}</strong>
        </div>

        <div class="grand-total">
          <span>GRAND TOTAL</span>
          <span>${formatAmount(invoice.grandTotal, currency)}</span>
        </div>
      </div>
    </section>

    ${
      grandTotalInWords
        ? `
          <section class="amount-words">
            <span class="amount-words-label">Invoice Total in Words :</span>
            <span class="amount-words-value">
              ${escapeHtml(grandTotalInWords)}
            </span>
          </section>
        `
        : ""
    }

    ${
      invoice.notes
        ? `
          <section class="notes">
            <strong>Notes:</strong>
            ${escapeHtml(invoice.notes)}
          </section>
        `
        : ""
    }

    ${bankHtml}

    <section class="signature-section">
      <div class="signature">
        ${
          signatory
            ? `<div class="signature-name">${escapeHtml(signatory)}</div>`
            : ""
        }
        <div>AUTHORIZED SIGNATORY</div>
      </div>
    </section>

    <footer class="footer">
      ${escapeHtml(footer)}
    </footer>

  </main>
</body>
</html>
  `;
}
