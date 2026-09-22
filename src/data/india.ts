import raw from "./india-deals.json";

export interface IndiaDeal {
  date: string;
  name: string;
  sector: string;
  subsector: string;
  businessModel: string;
  /** Millions of USD, or null when the round size was never published. */
  amountUsdMn: number | null;
  amountRaw: string;
  roundType: string;
  investors: string[];
  source: string;
  isAI: boolean;
  aiLayer: "" | "application" | "infrastructure" | "foundation";
  isAIService: boolean;
}

export interface InvestorBet {
  name: string;
  date: string;
  amountUsdMn: number | null;
  stage: string;
  source: string;
  /** The company's own site, verified at build time, or null if unconfirmed. */
  website: string | null;
}

export interface IndiaInvestor {
  name: string;
  key: string;
  /** AI-services rounds this firm appeared in. */
  bets: number;
  disclosedBets: number;
  /**
   * Combined size of those rounds — NOT this firm's own cheque. Co-investors
   * each carry the whole round because the split is not published anywhere.
   */
  roundValueUsdMn: number;
  medianRoundUsdMn: number | null;
  allDeals: number;
  aiDeals: number;
  aiShare: number;
  stages: { stage: string; count: number }[];
  firstBet: string;
  lastBet: string;
  companies: InvestorBet[];
}

export interface IndiaSummary {
  windowStart: string;
  windowMonths: number;
  totalDeals: number;
  aiDeals: number;
  serviceDeals: number;
  serviceCompanies: number;
  serviceInvestors: number;
  serviceRoundValueUsdMn: number;
  serviceDisclosedDeals: number;
  serviceUndisclosedDeals: number;
  medianServiceRoundUsdMn: number | null;
  stages: { stage: string; count: number }[];
  monthly: { month: string; all: number; ai: number; service: number; serviceUsdMn: number }[];
}

export interface IndiaData {
  generatedAt: string;
  windowStart: string;
  windowMonths: number;
  source: string;
  sourceUrl: string;
  summary: IndiaSummary;
  investors: IndiaInvestor[];
  deals: IndiaDeal[];
}

export const india = raw as unknown as IndiaData;
export const indiaInvestors = india.investors;
export const indiaSummary = india.summary;
export const indiaServiceDeals = india.deals.filter((d) => d.isAIService);

/** "2026-09" -> "Sep '26", for axis labels. */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m) - 1]} '${y.slice(2)}`;
}

/** "$13.3M", "$1.2B", "—" for an undisclosed round. */
export function usd(mn: number | null | undefined): string {
  if (mn == null) return "—";
  if (mn >= 1000) return `$${(mn / 1000).toFixed(1)}B`;
  if (mn >= 10) return `$${Math.round(mn)}M`;
  if (mn >= 1) return `$${mn.toFixed(1)}M`;
  return `$${Math.round(mn * 1000)}K`;
}

export function shortDate(iso: string): string {
  const [y, m] = iso.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m) - 1]} '${y.slice(2)}`;
}
