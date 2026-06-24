export type RiskLevel = "low" | "medium" | "high" | "critical";

export type GraphRelationship =
  | "CONTAINS_PAGE"
  | "MENTIONS"
  | "USES_WALLET"
  | "USES_PHONE"
  | "USES_HANDLE"
  | "LINKS_TO"
  | "SAME_TEXT_PATTERN"
  | "SELLS"
  | "DELIVERS_TO"
  | "CONNECTED_TO_LEAK"
  | "CLONE_OF"
  | "INCLUDED_IN_CASE";

export const LEGAL_NOTICE = "For authorized analysis of legally accessible sources only.";
