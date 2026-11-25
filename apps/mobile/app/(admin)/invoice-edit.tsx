import { useLocalSearchParams } from "expo-router";

import { InvoiceCreateForm } from "../../src/components/invoices/InvoiceCreateForm";

export default function AdminInvoiceEditScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();

  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!invoiceId) {
    return null;
  }

  return <InvoiceCreateForm invoiceId={invoiceId} />;
}
