// Offender fixture: raw locale formatting that the guard MUST flag.
export function OffenderComponent({ when }: { when: Date }) {
  const a = new Date(when).toLocaleString();
  const b = when.toLocaleDateString();
  const c = when.toLocaleTimeString();
  return (
    <span>
      {a}
      {b}
      {c}
    </span>
  );
}
