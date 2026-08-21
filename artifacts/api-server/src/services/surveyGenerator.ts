import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";

export interface PermitRecord {
  address: string;
  permitNo: string;
  permitType: string;
  issueDate: string;
  /** Epoch ms behind issueDate, when the source publishes one. */
  issueDateEpoch?: number;
  workDescription?: string;
  squareFootage?: number;
  zoningCode?: string;
  /** Property use classification from the county permit feed, when published. */
  useClass?: string;
  /** DOR use code and label from the Broward County Property Appraiser. */
  useCode?: string;
  useCodeLabel?: string;
  /** Year of construction from BCPA (ACTUAL_YEAR_BUILT). */
  yearBuilt?: number;
  /** Plaza classification derived from the BCPA use code, when known. */
  plazaType?: string;
  /** BCPA folio (the permit feed's PARCELID), used to join parcel attributes. */
  folio?: string;
  /** Point geometry from the permit feed, when published (WGS84). */
  latitude?: number;
  longitude?: number;
  horizon: "IMMINENT" | "NEAR-TERM" | "PROJECTED" | "EXPIRED";
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

/**
 * Fallback plaza vocabulary, used only when BCPA publishes no use code for the
 * parcel. Claude selects from it using the real address and permit context
 * rather than a value being drawn at random.
 */
const PLAZA_TYPE_VOCAB = [
  "Subtropical Retail Cluster",
  "Arterial Strip Complex",
  "Parking-Forward Commercial Node",
  "Corner Mercantile Unit",
  "Unclassified Commercial Structure",
];

/** Claude selects from this using the real BCPA year of construction. */
const ARCH_STYLE_VOCAB = [
  "Mediterranean Revival Strip",
  "Concrete Modernist Block",
  "Stucco Utilitarian",
  "Mid-Century Commercial",
  "Generic Post-1990 Retail",
];

/**
 * No permit or parcel source measures parking, shade, signage, vacancy or
 * pedestrian activity. These were previously drawn with Math.random() and
 * presented as measurements. They are now inferred by Claude from real permit,
 * parcel and corridor context, and the report labels them as inferred.
 */
const UNDETERMINED = "Undetermined";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join(
    "",
  );
}

const SYSTEM_PROMPT = `You are a field surveyor for Blasé Plaza Archives, a project that documents commercial plazas and strip malls in Broward County, Florida before they are demolished or renovated. You write neutral, observational, bureaucratic survey reports. Your tone is dry, precise, and documentary. Never use humor or editorial commentary. Infer the likely commercial character of each plaza from its address, square footage, use classification, and Broward County neighborhood context. Each bullet point must occupy a single line that begins with the literal character • followed by one space and then the text, exactly like this: • Convenience retail operator. Never put • alone on a line, and never break the line between • and its text. Never use <ul>, <li>, or markdown lists.`;

export async function generateSurvey(
  permit: PermitRecord,
  siteNum: number,
): Promise<SurveyEntry> {
  const siteId = pad2(siteNum);
  const documentRef = `BPA-2026-${siteId}-${randomDigits(4)}`;
  const sqftLine = permit.squareFootage
    ? `${permit.squareFootage.toLocaleString()} sq ft`
    : "Not published by BCPA";
  const zoningLine = permit.zoningCode ?? "Not published";
  const yearLine = permit.yearBuilt
    ? String(permit.yearBuilt)
    : "Not published by BCPA";
  const useLine = permit.useCodeLabel
    ? `${permit.useCodeLabel} (DOR ${permit.useCode})`
    : (permit.useClass ?? "Not published");

  // Derived from the real BCPA use code when available; otherwise Claude infers.
  const plazaType =
    permit.plazaType ??
    "[choose the best fit from: " + PLAZA_TYPE_VOCAB.join("; ") + "]";
  const archStyle =
    "[choose the best fit from: " + ARCH_STYLE_VOCAB.join("; ") + "]";

  const userPrompt = `Generate a survey entry for the following permit record:

Address: ${permit.address}, Broward County, Florida
Permit Number: ${permit.permitNo}
Permit Type: ${permit.permitType}
Issue Date: ${permit.issueDate}
Work Description: ${permit.workDescription ?? "Not specified"}
Building Square Footage (BCPA): ${sqftLine}
Zoning District (City of Fort Lauderdale): ${zoningLine}
Year Built (BCPA): ${yearLine}
Use Classification (BCPA): ${useLine}
Demolition Horizon: ${permit.horizon}

Infer the environmental metrics from the address, corridor, use classification,
square footage and year of construction above. They are not field-measured;
state the most probable value for a property of this type and vintage.

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

PARCEL RECORD
Building Area: ${sqftLine}
Zoning District: ${zoningLine}
Year Built: ${yearLine}
Use Classification: ${useLine}

ENVIRONMENTAL METRICS (INFERRED — NOT FIELD-VERIFIED)
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
Document Ref.: ${documentRef}

DATA PROVENANCE
Permit record: City of Fort Lauderdale building permit data, Broward County.
Parcel record: Broward County Property Appraiser.
Zoning district: City of Fort Lauderdale zoning districts layer.
Environmental metrics: inferred from permit, parcel and corridor context. Not field-verified.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  // Models occasionally emit the bullet character and its text on separate
  // lines. Rejoin them so the stored report always has "• text" on one line.
  const rawText =
    block.type === "text"
      ? block.text.replace(/^[ \t]*•[ \t]*\r?\n[ \t]*/gm, "• ").trim()
      : "";

  const extractLine = (prefix: string): string => {
    const match = rawText.match(new RegExp(`^${prefix}:\\s*(.+)$`, "m"));
    const value = match ? match[1].trim() : "";
    // Reject an unfilled prompt placeholder, e.g. "[choose the best fit from: …]",
    // so instruction text can never be stored as if it were survey data.
    return value.startsWith("[") ? "" : value;
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
    plazaType: (permit.plazaType ?? extractLine("Type")) || UNDETERMINED,
    architecturalStyle: extractLine("Architectural Style") || UNDETERMINED,
    parkingEntropy: extractLine("Parking Entropy") || UNDETERMINED,
    shadeCoverage: extractLine("Shade Coverage") || UNDETERMINED,
    signageDensity: extractLine("Signage Density") || UNDETERMINED,
    vacancyRatio: extractLine("Vacancy Ratio") || UNDETERMINED,
    pedestrianActivity: extractLine("Pedestrian Activity") || UNDETERMINED,
    reportText: rawText,
    permitNo: permit.permitNo,
    permitType: permit.permitType,
    permitIssueDate: permit.issueDate,
    documentRef,
  };
}

export { logger };
