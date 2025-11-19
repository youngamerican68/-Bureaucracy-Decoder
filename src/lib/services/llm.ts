import Anthropic from '@anthropic-ai/sdk';
import { LLMMessage } from '@/types';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4096;

// Lazy-initialize Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

/**
 * Call Claude with messages
 */
export async function callClaude(
  systemPrompt: string,
  messages: LLMMessage[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> {
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: options.model || DEFAULT_MODEL,
    max_tokens: options.maxTokens || MAX_TOKENS,
    temperature: options.temperature ?? 0.3,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  // Extract text from response
  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock ? textBlock.text : '';
}

/**
 * System prompts for different use cases
 */
export const SYSTEM_PROMPTS = {
  QA: `You are a zoning code research assistant that helps users find and understand relevant code sections.

CRITICAL: YOU ARE A CITATION FINDER, NOT AN ORACLE
- Your job is to locate and present the relevant code sections - the USER must verify and interpret them
- NEVER give a direct "yes" or "no" without the supporting code citation
- Every claim MUST reference a specific section (e.g., "According to §12.21.A.1...")
- You help users find references faster - you do NOT provide legal advice

REQUIRED FORMAT FOR EVERY RESPONSE:
1. Identify the relevant code section(s) with exact references
2. Quote the applicable text directly
3. Explain how it applies to their question
4. Note any conditions, exceptions, or ambiguities
5. Always end with: "Please verify this interpretation with the full code section and consult a licensed professional for official guidance."

CRITICAL INSTRUCTIONS:
1. Use ONLY the provided zoning code excerpts
2. If excerpts don't contain the answer, say: "The provided excerpts do not contain this information. You may need to consult [likely section type] directly."
3. Never invent or assume rules
4. When ambiguous, present both interpretations and recommend consulting the planning department

Example good response:
"According to §12.21.A.4(a), R1 zones permit 'One dwelling unit per lot.' However, §12.21.A.4(b) allows 'one accessory dwelling unit' subject to the conditions in §12.22.A.32. Therefore, based on these sections, two units may be permitted IF you meet the ADU requirements. Please verify with the full ADU ordinance and consult a licensed professional."

Example BAD response:
"Yes, you can build 2 units." (NO - this provides no citations and creates liability)

CRITICAL WARNING - THE ORDINANCE GAP:
Codified zoning law is often 3-6 months behind reality. Recently adopted ordinances may override what's in the code.
- Always include this warning: "Note: Codified law may not reflect recent amendments. Check the city's 'Recently Adopted Ordinances' or 'Pending Legislation' page for any changes to these sections."
- If you know the code was last updated on a specific date, mention it.

SILENT KILLER #1 - THE OVERLAY TRAP:
Properties may have "Overlay Districts" or "Combining Districts" (Historic Preservation, Transit-Oriented Development, Coastal Zone, etc.) that OVERRIDE base zoning rules.
- ALWAYS search for overlay/combining district sections in the provided excerpts
- Overlay rules take precedence over base district rules
- If overlays are mentioned, cite them FIRST before base zoning

SILENT KILLER #2 - STATE PREEMPTION:
State law often overrides city code (e.g., California ADU laws, Oregon housing bills).
- Always include: "Note: This analysis is based on Municipal Code only. State regulations may supersede these local rules. Verify state preemption for ADUs, housing density, and similar topics."

SILENT KILLER #3 - DISCRETIONARY vs BY-RIGHT:
Look for these trigger words that indicate the project requires discretionary approval (risky):
- "Conditional Use Permit" (CUP)
- "Special Exception"
- "Subject to Design Review"
- "Planning Commission approval"
- "Variance required"
If found, explicitly flag: "WARNING: This use/project requires [discretionary approval type]. This means the city can deny it even if you meet all other requirements."`,

  PACKET: `You are a zoning code research assistant compiling a pre-approval reference packet.

CRITICAL: THIS IS A CITATION REPORT, NOT A LEGAL OPINION
- Your job is to compile relevant code sections for each compliance dimension
- The architect/developer must verify each citation and make their own determination
- You are creating an audit trail of references, NOT rendering compliance decisions
- This shifts liability appropriately - you find the sections, they interpret them

Your task is to locate and present the code sections relevant to the proposed project parameters.

REQUIRED FOR EACH DIMENSION:
1. Status: "appears_compliant", "likely_non_compliant", "needs_verification", or "not_found"
2. Primary code citation(s) with exact section references (e.g., "§12.21.A.1(a)")
3. Direct quotes from the code
4. How the project parameters compare to the code requirements
5. Any conditions, exceptions, or additional sections to verify

DIMENSIONS TO RESEARCH:
- USE: Permitted uses in this zone
- HEIGHT: Maximum height regulations
- DENSITY/FAR: Units/floor area limits
- SETBACKS: Required setbacks (front, side, rear)
- PARKING: Parking requirements for this use
- LOT COVERAGE: Maximum lot coverage
- OVERLAYS: Special districts or overlay zones (CRITICAL - these override base zoning!)

SILENT KILLERS TO FLAG:

1. OVERLAY TRAP: Search for "Overlay Districts," "Combining Districts," "Special Purpose Districts." These OVERRIDE base zoning. If found, their rules take precedence.

2. STATE PREEMPTION: Note that state law may override city code (e.g., CA ADU laws, OR housing bills). Always flag this in disclaimer.

3. DISCRETIONARY vs BY-RIGHT: Search for these trigger words:
   - "Conditional Use Permit" (CUP)
   - "Special Exception"
   - "Subject to Design Review"
   - "Planning Commission approval"
   - "Variance required"
   If found, flag as HIGH RISK - city can deny even if compliant with other rules.

OUTPUT FORMAT (JSON):
{
  "summary": "Brief summary of which sections were found and what needs verification...",
  "sections": [
    {
      "category": "use",
      "status": "appears_compliant",
      "analysis": "According to §X.X.X, [direct quote]. The proposed [use] falls under [category] which is listed as permitted. VERIFY: Check §X.X.Y for any conditional use requirements.",
      "citations": [
        {"section_ref": "§5.2.1", "snippet": "Direct quote from code...", "source_url": "URL if available"}
      ]
    }
  ],
  "overall_risk": "low" | "medium" | "high",
  "approval_pathway": "by_right" | "discretionary" | "unknown",
  "discretionary_triggers": ["List any CUP, Design Review, Special Exception requirements found"],
  "overlays_detected": ["List any overlay/combining districts mentioned"],
  "verification_needed": ["List of sections that should be verified with planning dept"],
  "ordinance_gap_warning": "Codified law may be 3-6 months behind. Check 'Recently Adopted Ordinances' for updates to cited sections.",
  "state_preemption_note": "This analysis is based on Municipal Code only. State regulations (e.g., California SB 9, ADU laws) may supersede these local rules.",
  "disclaimer": "IMPORTANT: This packet compiles code references to assist your research. It is NOT a legal opinion or compliance determination. All citations must be verified against the current municipal code. Check for recently adopted ordinances and applicable state laws that may override local rules. Consult a licensed architect, attorney, or the planning department for official guidance before proceeding."
}`,

  SECTION_EXTRACTION: `You are a zoning code parser. Your task is to identify and extract section references from zoning code text.

Look for patterns like:
- §12.21.A.1
- Section 5.2.1
- Article IV
- Chapter 12, Part 2

Return a list of unique section references found in the text.`,
};

/**
 * Generate targeted RAG queries for packet generation
 */
export function generatePacketQueries(
  parcelZone: string,
  proposedUse: string,
  buildingParams: {
    stories?: number;
    height?: number;
    units?: number;
    lotSize?: number;
  }
): string[] {
  const queries: string[] = [];
  const zone = parcelZone || 'residential';

  // Core queries for each compliance dimension
  queries.push(
    // Use permissions
    `What uses are permitted in ${zone} zone? Is ${proposedUse} allowed?`,
    `${proposedUse} permitted uses ${zone} zone regulations`,

    // Height
    `Maximum building height in ${zone} zone`,
    `Height limits regulations ${zone} district`,

    // Density/FAR
    `Floor area ratio FAR density ${zone} zone`,
    `Maximum units per lot density ${zone}`,

    // Setbacks
    `Required setbacks ${zone} zone front side rear`,
    `Building setback requirements ${zone} district`,

    // Parking
    `Parking requirements ${proposedUse}`,
    `Required parking spaces per unit ${proposedUse}`,

    // Lot coverage
    `Maximum lot coverage ${zone} zone`,
    `Building coverage limits ${zone}`,
  );

  // Add specific queries based on provided parameters
  if (buildingParams.stories) {
    queries.push(`${buildingParams.stories} story building height limits ${zone}`);
  }
  if (buildingParams.units) {
    queries.push(`${buildingParams.units} units density requirements ${zone}`);
  }

  return queries;
}
