import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";

export interface PermitRecord {
  address: string;
  permitNo: string;
  permitType: string;
  issueDate: string;
  workDescription?: string;
  squareFootage?: number;
  zoningCode?: string;
  /** Property use classification from the county permit feed, when published. */
  useClass?: string;
  /** Point geometry from the permit feed, when published (WGS84). */
  latitude?: number;
  longitude?: number;
  horizon: "IMMINENT" | "NEAR-TERM" | "PROJECTED";
}

export interface SurveyEntry {
  siteId: string;
  plazaName: string;
  location: string;
  surveyDate: string;
  demolitionHorizon: string;
  plazaType: string;
  architecturalStyle: string;
  parkingEntropy: string;
  shadeCoverage: string;
  signageDensity: string;
  vacancyRatio: string;
  pedestrianActivity: string;
  reportText: string;
  permitNo: string;
  permitType: string;
  permitIssueDate: string;
  documentRef: string;
}

const PLAZA_TYPES = [
  "Subtropical Retail Cluster",
  "Arterial Strip Complex",
  "Parking-Forward Commercial Node",
  "Corner Mercantile Unit",
];

const ARCH_STYLES = [
  "Mediterranean Revival Strip",
  "Concrete Modernist Block",
  "Stucco Utilitarian",
  "Mid-Century Commercial",
  "Generic Post-1990 Retail",
];

const METRICS = ["Low", "Moderate", "High"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomMetric() {
  return randomFrom(METRICS);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join(
    "",
  );
}

const SYSTEM_PROMPT = `You are a field surveyor for Blasé Plaza Archives, a project that documents commercial plazas and strip malls in Broward County, Florida before they are demolished or renovated. You write neutral, observational, bureaucratic survey reports. Your tone is dry, precise, and documentary. Never use humor or editorial commentary. Infer the likely commercial character of each plaza from its address, square footage, use classification, and Broward County neighborhood context. All bullet points must use the literal • character on their own line. Never use <ul>, <li>, or markdown lists.`;

export async function generateSurvey(
  permit: PermitRecord,
  siteNum: number,
): Promise<SurveyEntry> {
  const siteId = pad2(siteNum);
  const documentRef = `BPA-2026-${siteId}-${randomDigits(4)}`;
  const plazaType = randomFrom(PLAZA_TYPES);
  const archStyle = randomFrom(ARCH_STYLES);

  const sqft = permit.squareFootage
    ? `${permit.squareFootage.toLocaleString()} sq ft`
    : "unknown square footage";
  const zoning = permit.zoningCode ?? "unspecified zoning classification";
  const useClass = permit.useClass ?? "unspecified use classification";

  const userPrompt = `Generate a survey entry for the following permit record:

Address: ${permit.address}, Broward County, Florida
Permit Number: ${permit.permitNo}
Permit Type: ${permit.permitType}
Issue Date: ${permit.issueDate}
Work Description: ${permit.workDescription ?? "Not specified"}
Square Footage: ${sqft}
Zoning: ${zoning}
Use Classification: ${useClass}
Demolition Horizon: ${permit.horizon}
Plaza Type: ${plazaType}
Architectural Style: ${archStyle}
Parking Entropy: ${randomMetric()}
Shade Coverage: ${randomMetric()}
Signage Density: ${randomMetric()}
Vacancy Ratio: ${randomMetric()}
Pedestrian Activity: ${randomMetric()}

Output EXACTLY the following survey format, filling in all bracketed fields. Do not alter the structure. Use • characters for bullet points, never markdown lists:

BLASÉ PLAZA ARCHIVES

SITE ID: ${siteId}
PLAZA NAME: [derive from address, business name, or neighborhood — a plausible local name]
LOCATION: ${permit.address}, Broward County, Florida
SURVEY DATE: [month and year of the permit issue date, e.g. "March 2024"]
DEMOLITION HORIZON: ${permit.horizon}

PLAZA CLASSIFICATION
Type: ${plazaType}
Architectural Style: ${archStyle}

ENVIRONMENTAL METRICS
Parking Entropy: [Low/Moderate/High]
Shade Coverage: [Low/Moderate/High]
Signage Density: [Low/Moderate/High]
Vacancy Ratio: [Low/Moderate/High]
Pedestrian Activity: [Low/Moderate/High]

COMMERCIAL SPECIES OBSERVED
Dominant Species
• [business type 1]
• [business type 2]
• [business type 3]

Secondary Species
• [business type 1]
• [business type 2]
• [business type 3]

FIELD NOTES
[One paragraph, 3-5 sentences. Neutral, observational, bureaucratic tone. Describe the physical structure, parking situation, signage, and commercial character based on the address, square footage, use classification, and Broward County neighborhood context. No humor. No commentary. Dry and precise.]

PERMIT REFERENCE
Permit No.: ${permit.permitNo}
Permit Type: ${permit.permitType === "DEMOLITION" ? "DEMOLITION" : permit.permitType === "BUILDING" ? "REDEVELOPMENT" : "RENOVATION"}
Issue Date: ${permit.issueDate}
Document Ref.: ${documentRef}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  const rawText = block.type === "text" ? block.text.trim() : "";

  const extractLine = (prefix: string): string => {
    const match = rawText.match(new RegExp(`^${prefix}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : "";
  };

  const plazaName =
    extractLine("PLAZA NAME") || `${permit.address.split(",")[0]} Commercial`;
  const surveyDate = extractLine("SURVEY DATE") || permit.issueDate;

  return {
    siteId,
    plazaName,
    location: `${permit.address}, Broward County, Florida`,
    surveyDate,
    demolitionHorizon: permit.horizon,
    plazaType,
    architecturalStyle: archStyle,
    parkingEntropy: extractLine("Parking Entropy") || randomMetric(),
    shadeCoverage: extractLine("Shade Coverage") || randomMetric(),
    signageDensity: extractLine("Signage Density") || randomMetric(),
    vacancyRatio: extractLine("Vacancy Ratio") || randomMetric(),
    pedestrianActivity: extractLine("Pedestrian Activity") || randomMetric(),
    reportText: rawText,
    permitNo: permit.permitNo,
    permitType: permit.permitType,
    permitIssueDate: permit.issueDate,
    documentRef,
  };
}

export { logger };
