// Shared WAREHOUSE.SYS brand mark (display face, pink-deep accent suffix).
// One definition so future chrome (Phase 3 sidebar/topbar) can't drift.
export function BrandMark({
  className = "",
}: Readonly<{ className?: string }>) {
  return (
    <span className={`font-display text-20 uppercase ${className}`}>
      WAREHOUSE<span className="text-accent-pink-deep">.SYS</span>
    </span>
  );
}
