// Ignored fixture: locale formatting explicitly allow-listed, plus Intl.NumberFormat
// (money) which must NEVER be flagged.
export function IgnoredComponent({ when, cents }: { when: Date; cents: number }) {
  const t = when.toLocaleTimeString("en-US"); // i18n-format-ignore
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
  return (
    <span>
      {t}
      {money}
    </span>
  );
}
