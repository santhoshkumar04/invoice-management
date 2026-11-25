const ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertBelowThousand(value: number): string {
  if (value < 20) {
    return ONES[value];
  }

  if (value < 100) {
    const tens = Math.floor(value / 10);
    const remainder = value % 10;

    return remainder ? `${TENS[tens]}-${ONES[remainder]}` : TENS[tens];
  }

  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  return remainder
    ? `${ONES[hundreds]} Hundred ${convertBelowThousand(remainder)}`
    : `${ONES[hundreds]} Hundred`;
}

function convertIndianNumber(value: bigint): string {
  if (value === 0n) {
    return "Zero";
  }

  const scales: Array<{ value: bigint; label: string }> = [
    { value: 10000000000n, label: "Kharab" },
    { value: 100000000n, label: "Arab" },
    { value: 1000000n, label: "Crore" },
    { value: 100000n, label: "Lakh" },
    { value: 1000n, label: "Thousand" },
  ];

  const parts: string[] = [];
  let remaining = value;

  for (const scale of scales) {
    const quotient = remaining / scale.value;

    if (quotient > 0n) {
      parts.push(`${convertBelowThousand(Number(quotient))} ${scale.label}`);

      remaining %= scale.value;
    }
  }

  if (remaining > 0n) {
    parts.push(convertBelowThousand(Number(remaining)));
  }

  return parts.join(" ");
}

export function amountInWords(
  amount: string | number,
  currency = "INR",
): string | null {
  if (currency.toUpperCase() !== "INR") {
    return null;
  }

  const value = String(amount).trim();

  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [rupeesPart, paisePart = ""] = value.split(".");

  const rupees = BigInt(rupeesPart);
  const paise = Number(paisePart.padEnd(2, "0") || "0");

  let result = `Rupees ${convertIndianNumber(rupees)}`;

  if (paise > 0) {
    result += ` and ${convertBelowThousand(paise)} Paise`;
  }

  return `${result} Only`;
}
