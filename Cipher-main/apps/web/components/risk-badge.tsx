import { Badge } from "@/components/ui/badge";
import { RISK_BADGE } from "@/lib/colors";

export function RiskBadge({ score }: { score: number }) {
  const style = RISK_BADGE(score);
  return (
    <Badge
      variant="outline"
      className="min-w-14 justify-center font-mono text-sm tracking-normal"
      style={{ backgroundColor: style.background, borderColor: style.border, color: style.color }}
    >
      {score}
    </Badge>
  );
}
