import { Badge } from "@/components/ui/badge";
import { cn, riskTone } from "@/lib/utils";

export function RiskBadge({ score }: { score: number }) {
  const tone = riskTone(score);
  const variant = tone === "critical" ? "destructive" : tone === "high" ? "warning" : tone === "low" ? "success" : "cyan";
  return <Badge variant={variant} className={cn("min-w-14 justify-center font-mono text-sm tracking-normal")}>{score}</Badge>;
}
