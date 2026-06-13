// Clean fixture: uses a useDateFormat hook, no raw locale formatting.
import { useDateFormat } from "@/lib/format/useDateFormat";

export function CleanComponent({ when }: { when: Date }) {
  const fmt = useDateFormat();
  return <span>{fmt(when)}</span>;
}
