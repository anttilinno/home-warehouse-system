import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DeclutterScoreBadgeProps {
  score: number;
  className?: string;
}

/**
 * Displays a colored badge indicating declutter priority.
 * Score ranges: 0-50 (low), 51-100 (medium), 101-150 (high)
 */
export function DeclutterScoreBadge({ score, className }: DeclutterScoreBadgeProps) {
  const getScoreLevel = (score: number) => {
    if (score >= 101) return { label: "High", variant: "destructive" as const };
    if (score >= 51) return { label: "Medium", variant: "secondary" as const };
    return { label: "Low", variant: "outline" as const };
  };

  const { variant } = getScoreLevel(score);

  return (
    <Badge
      variant={variant}
      className={cn("text-xs", className)}
      title={`Declutter score: ${score}`}
    >
      {score}
    </Badge>
  );
}
