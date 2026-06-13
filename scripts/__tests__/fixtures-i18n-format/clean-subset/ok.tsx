// Clean-subset fixture: no raw locale formatting; ignore-tagged + Intl are safe.
export function Ok({ when, cents }: { when: Date; cents: number }) {
  const t = when.toLocaleTimeString("en-US"); // i18n-format-ignore
  const money = new Intl.NumberFormat("en-US").format(cents / 100);
  return (
    <span>
      {t}
      {money}
    </span>
  );
}
