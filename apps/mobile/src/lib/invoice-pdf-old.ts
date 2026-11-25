import type { InvoiceDetail, InvoiceLineItem } from "./invoices-api";
import { amountInWords } from "./amount-in-words";

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

  const datePart = value.slice(0, 10);
  const date = new Date(`${datePart}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

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

function addressLines(record: DataRecord): string[] {
  return [
    "addressLine1",
    "addressLine2",
    "city",
    "district",
    "state",
    "postalCode",
    "country",
  ]
    .map((key) => readString(record, key))
    .filter((value): value is string => Boolean(value));
}

function renderAddress(record: DataRecord): string {
  return addressLines(record)
    .map((line) => escapeHtml(line))
    .join("<br>");
}

function renderOptionalRow(label: string, value: string | null): string {
  if (!value) return "";

  return `
    <div class="info-line">
      <span class="muted">${escapeHtml(label)}</span>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
}

function renderItem(
  item: InvoiceLineItem,
  currency: string,
  gstEnabled: boolean,
): string {
  const quantity = Number(item.quantity);
  const rate = Number(item.rate);

  const taxColumns = gstEnabled
    ? `
      <td class="number">${Number(item.gstRate).toFixed(2)}%</td>
      <td class="number">${formatAmount(item.cgstAmount, currency)}</td>
      <td class="number">${formatAmount(item.sgstAmount, currency)}</td>
      <td class="number">${formatAmount(item.igstAmount, currency)}</td>
    `
    : "";

  return `
    <tr>
      <td class="description">
        <strong>${escapeHtml(item.description)}</strong>
      </td>
      <td class="number">${Number.isFinite(quantity) ? quantity.toLocaleString("en-IN") : "—"}</td>
      <td class="number">${formatAmount(rate, currency)}</td>
      <td class="number">${formatAmount(item.amount, currency)}</td>
      ${taxColumns}
    </tr>
  `;
}

export function buildInvoiceHtml(invoice: InvoiceDetail): string {
  const snapshot = asRecord(invoice.snapshot);

  const snapshotOrganization = asRecord(snapshot.organization);
  const snapshotCustomer = asRecord(snapshot.customer);

  const organization =
    Object.keys(snapshotOrganization).length > 0 ? snapshotOrganization : {};

  const customer =
    Object.keys(snapshotCustomer).length > 0
      ? snapshotCustomer
      : asRecord(invoice.customer);

  const organizationName = readString(organization, "name") || "Organization";

  const customerName =
    readString(customer, "companyName") ||
    readString(customer, "customerName") ||
    "Customer";

  const currency = invoice.currency || "INR";

  const grandTotalInWords = amountInWords(invoice.grandTotal, currency);

  const gstEnabled = invoice.isGstApplicable;

  const logoUrl = readString(organization, "logoUrl");
  const safeLogoUrl =
    logoUrl && /^https?:\/\//i.test(logoUrl) ? escapeHtml(logoUrl) : null;

  const itemsHtml = invoice.items
    .map((item) => renderItem(item, currency, gstEnabled))
    .join("");

  const gstHeaders = gstEnabled
    ? `
      <th class="number">GST</th>
      <th class="number">CGST</th>
      <th class="number">SGST</th>
      <th class="number">IGST</th>
    `
    : "";

  const supplyType =
    invoice.supplyType === "intra_state"
      ? "Intra-state supply"
      : invoice.supplyType === "inter_state"
        ? "Inter-state supply"
        : "—";

  const gstSummary = gstEnabled
    ? invoice.supplyType === "intra_state"
      ? `
        <div class="total-row">
          <span>CGST</span>
          <span>${formatAmount(invoice.cgstTotal, currency)}</span>
        </div>
        <div class="total-row">
          <span>SGST</span>
          <span>${formatAmount(invoice.sgstTotal, currency)}</span>
        </div>
      `
      : `
        <div class="total-row">
          <span>IGST</span>
          <span>${formatAmount(invoice.igstTotal, currency)}</span>
        </div>
      `
    : "";

  const bankName = readString(organization, "bankName");
  const bankAccountName = readString(organization, "bankAccountName");
  const bankAccountNumber = readString(organization, "bankAccountNumber");
  const bankIfsc = readString(organization, "bankIfsc");

  const hasBankDetails = Boolean(
    bankName || bankAccountName || bankAccountNumber || bankIfsc,
  );

  const bankHtml = hasBankDetails
    ? `
      <section class="bank-card">
        <h3>Bank details</h3>
        ${renderOptionalRow("Bank", bankName)}
        ${renderOptionalRow("Account name", bankAccountName)}
        ${renderOptionalRow("Account number", bankAccountNumber)}
        ${renderOptionalRow("IFSC", bankIfsc)}
      </section>
    `
    : "";

  const footer = readString(organization, "invoiceFooter");
  const signatory = readString(organization, "authorizedSignatory");

  const description = readString(organization, "businessDescription");

  const statusLabel = invoice.status.replace(/_/g, " ").toUpperCase();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${escapeHtml(invoice.invoiceNumber || "Invoice")}</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 24px;
      background: #ffffff;
      color: #172033;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.5;
    }

    .document {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
    }

    .top-line {
      height: 5px;
      background: #2457d6;
      margin-bottom: 24px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      padding-bottom: 22px;
      border-bottom: 1px solid #e6eaf0;
    }

    .company {
      flex: 1;
      min-width: 0;
    }

    .company-logo {
      max-width: 110px;
      max-height: 65px;
      object-fit: contain;
      margin-bottom: 10px;
    }

    .company-name {
      margin: 0;
      font-size: 21px;
      font-weight: 800;
      color: #172033;
    }

    .company-description {
      color: #697586;
      margin-top: 3px;
    }

    .company-details {
      margin-top: 8px;
      color: #697586;
      line-height: 1.7;
    }

    .invoice-heading {
      text-align: right;
      min-width: 180px;
    }

    .invoice-heading h1 {
      margin: 0;
      color: #2457d6;
      font-size: 27px;
      letter-spacing: 1px;
    }

    .invoice-number {
      font-size: 13px;
      font-weight: 700;
      margin-top: 5px;
      overflow-wrap: anywhere;
    }

    .status {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 9px;
      border-radius: 4px;
      background: #eaf0ff;
      color: #2457d6;
      font-size: 9px;
      font-weight: 700;
    }

    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin: 24px 0;
    }

    .party-card,
    .bank-card {
      border: 1px solid #e6eaf0;
      border-radius: 7px;
      padding: 13px;
      min-width: 0;
    }

    .section-label {
      margin: 0 0 9px;
      color: #697586;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .party-name {
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 5px;
    }

    .party-details {
      color: #536174;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    .metadata {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 20px;
      padding: 14px;
      background: #f6f8fc;
      border-radius: 7px;
      margin-bottom: 24px;
    }

    .meta-label {
      display: block;
      color: #697586;
      font-size: 9px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .meta-value {
      font-weight: 700;
    }

    h2 {
      font-size: 13px;
      margin: 0 0 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
    }

    thead {
      display: table-header-group;
    }

    th {
      padding: 10px 7px;
      background: #172033;
      color: #ffffff;
      font-size: 9px;
      text-align: left;
      white-space: nowrap;
    }

    td {
      padding: 10px 7px;
      border-bottom: 1px solid #e6eaf0;
      vertical-align: top;
    }

    .number {
      text-align: right;
      white-space: nowrap;
    }

    .description {
      min-width: 130px;
      overflow-wrap: anywhere;
    }

    .summary-area {
      display: flex;
      justify-content: flex-end;
      margin-top: 18px;
    }

    .summary {
      width: 300px;
      max-width: 100%;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      padding: 6px 0;
      border-bottom: 1px solid #e6eaf0;
    }

    .grand-total {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      padding: 12px;
      margin-top: 8px;
      border-radius: 5px;
      background: #eaf0ff;
      color: #1943a8;
      font-size: 14px;
      font-weight: 800;
    }

    .amount-in-words {
      margin-top: 10px;
      padding: 11px;
      border: 1px solid #dbe5ff;
      border-radius: 5px;
      background: #f6f8ff;
    }

    .amount-in-words-label {
      display: block;
      margin-bottom: 4px;
      color: #697586;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .amount-in-words-value {
      color: #172033;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.6;
    }

    .bank-card {
      margin-top: 28px;
      max-width: 390px;
    }

    .bank-card h3 {
      margin: 0 0 10px;
      font-size: 12px;
    }

    .info-line {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 3px 0;
      overflow-wrap: anywhere;
    }

    .muted {
      color: #697586;
    }

    .bottom {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      margin-top: 35px;
      padding-top: 15px;
      border-top: 1px solid #e6eaf0;
    }

    .footer {
      color: #697586;
      white-space: pre-line;
      max-width: 65%;
    }

    .signature {
      min-width: 150px;
      text-align: center;
    }

    .signature-space {
      height: 42px;
      border-bottom: 1px solid #697586;
      margin-bottom: 7px;
    }

    .signature-name {
      font-weight: 700;
    }

    @media print {
      body {
        padding: 0;
      }

      .document {
        max-width: none;
      }

      .party-card,
      .bank-card,
      .metadata,
      .grand-total {
        break-inside: avoid;
      }

      tr {
        break-inside: avoid;
      }
    }
  </style>
</head>

<body>
  <main class="document">
    <div class="top-line"></div>

    <header class="header">
      <div class="company">
        ${
          safeLogoUrl
            ? `<img class="company-logo" src="${safeLogoUrl}" alt="Company logo" />`
            : ""
        }

        <h1 class="company-name">${escapeHtml(organizationName)}</h1>

        ${
          description
            ? `<div class="company-description">${escapeHtml(description)}</div>`
            : ""
        }

        <div class="company-details">
          ${renderAddress(organization)}
          ${readString(organization, "vendorCode") ? `<br>Vendor Code: ${escapeHtml(readString(organization, "vendorCode"))}` : ""}
          ${readString(organization, "email") ? `<br>${escapeHtml(readString(organization, "email"))}` : ""}
          ${readString(organization, "mobile") ? `<br>${escapeHtml(readString(organization, "mobile"))}` : ""}
          ${readString(organization, "gstin") ? `<br>GSTIN: ${escapeHtml(readString(organization, "gstin"))}` : ""}
          ${readString(organization, "pan") ? `<br>PAN: ${escapeHtml(readString(organization, "pan"))}` : ""}
        </div>
      </div>

      <div class="invoice-heading">
        <h1>INVOICE</h1>
        <div class="invoice-number">
          ${escapeHtml(invoice.invoiceNumber || "Unnumbered")}
        </div>
        <div class="status">${escapeHtml(statusLabel)}</div>
      </div>
    </header>

    <section class="parties">
      <div class="party-card">
        <div class="section-label">Bill to</div>
        <div class="party-name">${escapeHtml(customerName)}</div>

        <div class="party-details">
          ${readString(customer, "companyName") && readString(customer, "customerName") ? `${escapeHtml(readString(customer, "customerName"))}<br>` : ""}
          ${renderAddress(customer)}
          ${readString(customer, "contactPerson") ? `<br>Contact: ${escapeHtml(readString(customer, "contactPerson"))}` : ""}
          ${readString(customer, "mobile") ? `<br>Mobile: ${escapeHtml(readString(customer, "mobile"))}` : ""}
          ${readString(customer, "email") ? `<br>Email: ${escapeHtml(readString(customer, "email"))}` : ""}
          ${readString(customer, "gstin") ? `<br>GSTIN: ${escapeHtml(readString(customer, "gstin"))}` : ""}
          ${readString(customer, "pan") ? `<br>PAN: ${escapeHtml(readString(customer, "pan"))}` : ""}
        </div>
      </div>

      <div class="party-card">
        <div class="section-label">Invoice details</div>

        <div class="info-line">
          <span class="muted">Invoice date</span>
          <strong>${formatDate(invoice.invoiceDate)}</strong>
        </div>

        <div class="info-line">
          <span class="muted">Due date</span>
          <strong>${formatDate(invoice.dueDate)}</strong>
        </div>

        <div class="info-line">
          <span class="muted">Billing from</span>
          <strong>${formatDate(invoice.billingPeriodStart)}</strong>
        </div>

        <div class="info-line">
          <span class="muted">Billing to</span>
          <strong>${formatDate(invoice.billingPeriodEnd)}</strong>
        </div>

        <div class="info-line">
          <span class="muted">Currency</span>
          <strong>${escapeHtml(currency)}</strong>
        </div>

        ${
          gstEnabled
            ? `
              <div class="info-line">
                <span class="muted">Supply type</span>
                <strong>${escapeHtml(supplyType)}</strong>
              </div>
            `
            : `
              <div class="info-line">
                <span class="muted">GST</span>
                <strong>Not applicable</strong>
              </div>
            `
        }
      </div>
    </section>

    <h2>Invoice items</h2>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="number">Qty</th>
          <th class="number">Rate</th>
          <th class="number">Taxable amount</th>
          ${gstHeaders}
        </tr>
      </thead>

      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <section class="summary-area">
      <div class="summary">
        <div class="total-row">
          <span>Subtotal</span>
          <strong>${formatAmount(invoice.subtotal, currency)}</strong>
        </div>

        ${gstSummary}

        ${
          gstEnabled
            ? `
              <div class="total-row">
                <span>Total tax</span>
                <strong>${formatAmount(invoice.totalTax, currency)}</strong>
              </div>
            `
            : ""
        }

        <div class="total-row">
          <span>Round off</span>
          <strong>${formatAmount(invoice.roundOff, currency)}</strong>
        </div>

        <div class="grand-total">
          <span>Grand total</span>
          <span>${formatAmount(invoice.grandTotal, currency)}</span>
        </div>

        ${
          grandTotalInWords
            ? `
                <div class="amount-in-words">
                  <span class="amount-in-words-label">Amount in words</span>
                  <span class="amount-in-words-value">
                    ${escapeHtml(grandTotalInWords)}
                  </span>
                </div>
              `
            : ""
        }
      </div>
    </section>

    ${bankHtml}

    <footer class="bottom">
      <div class="footer">
        ${footer ? escapeHtml(footer) : "Thank you for your business."}
      </div>

      ${
        signatory
          ? `
            <div class="signature">
              <div class="signature-space"></div>
              <div class="signature-name">${escapeHtml(signatory)}</div>
              <div class="muted">Authorized signatory</div>
            </div>
          `
          : ""
      }
    </footer>
  </main>
</body>
</html>
  `;
}
