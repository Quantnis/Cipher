export const CATEGORY_COLORS = {
  suspected_illicit_vape_sales: "#D29922",
  suspected_illicit_alcohol_sales: "#79C0FF",
  suspected_narcotics_market: "#F85149",
  suspected_drop_account_recruitment: "#D29922",
  suspected_crypto_fraud: "#BC8CFF",
  suspected_database_leak: "#2F81F7",
  suspected_document_forgery: "#E09B3D",
  suspected_payment_fraud: "#F85149",
  suspicious_marketplace: "#D29922",
  suspicious_but_unclear: "#8B949E",
  benign: "#3FB950",
  illegal_vape_sales: "#D29922",
  suspicious_crypto_wallet: "#BC8CFF",
  alcohol_smuggling: "#79C0FF",
  drug_related: "#F85149",
  narcotics_advertising: "#F85149",
  contraband: "#E09B3D",
  data_leak: "#2F81F7",
  data_leak_mentions: "#2F81F7",
  hidden_identity_link: "#A5A5A5",
  financial_pyramid: "#F85149",
  phishing: "#F85149",
  dropper_recruitment: "#D29922",
  suspicious_payment_infrastructure: "#D29922",
  suspicious_telegram_shop: "#D29922",
  default: "#8B949E"
} as const;

export const SEVERITY_COLORS = {
  CRITICAL: "#F85149",
  HIGH: "#D29922",
  MEDIUM: "#2F81F7",
  LOW: "#8B949E",
  NEW: "#3FB950"
} as const;

export const RISK_COLOR = (score: number): string => {
  if (score >= 70) return "#F85149";
  if (score >= 40) return "#D29922";
  return "#3FB950";
};

export const RISK_BADGE = (score: number) => {
  if (score >= 70) {
    return { background: "rgba(248, 81, 73, 0.15)", border: "rgba(248, 81, 73, 0.3)", color: "#F85149" };
  }
  if (score >= 40) {
    return { background: "rgba(210, 153, 34, 0.15)", border: "rgba(210, 153, 34, 0.3)", color: "#D29922" };
  }
  return { background: "rgba(63, 185, 80, 0.15)", border: "rgba(63, 185, 80, 0.3)", color: "#3FB950" };
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ?? CATEGORY_COLORS.default;
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

