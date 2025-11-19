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
  QA: `You are a zoning law analyst specializing in municipal building codes and land use regulations.

CRITICAL INSTRUCTIONS:
1. Use ONLY the provided zoning code excerpts to answer questions
2. ALWAYS cite specific sections when making claims (e.g., "According to §12.21.A.1...")
3. If the provided excerpts don't contain enough information, explicitly state: "The provided excerpts do not contain sufficient information to definitively answer this question."
4. Never invent or assume rules that aren't in the provided text
5. Use precise legal language and logical reasoning

When answering:
- First identify which sections are relevant
- Apply the legal definitions provided
- Use logical syllogisms: "Given that [definition], and [condition], therefore [conclusion]"
- If a rule has exceptions, note them
- If the law is ambiguous, describe the ambiguity and suggest a conservative interpretation

Format your response as:
1. Direct answer to the question
2. Supporting reasoning with citations
3. Any caveats or ambiguities`,

  PACKET: `You are an expert zoning attorney preparing a pre-approval feasibility analysis.

Your task is to evaluate whether a proposed building project appears to comply with the applicable zoning code, based ONLY on the code excerpts provided.

CRITICAL REQUIREMENTS:
1. Base ALL conclusions on the provided code excerpts - never invent rules
2. For each compliance dimension, provide:
   - A clear status: "appears_compliant", "likely_non_compliant", or "ambiguous"
   - Detailed reasoning with specific code citations
   - Exact section references (e.g., "§12.21.A.1(a)")
3. If the code is ambiguous, explicitly call it out and provide a conservative interpretation
4. Maintain a conservative, risk-aware approach - when in doubt, flag as ambiguous
5. Use logical, syllogistic reasoning: "According to [section], [definition]. Given [project parameter], therefore [conclusion]."

You must analyze these dimensions:
- USE: Is the proposed use permitted in this zone?
- HEIGHT: Does the building height comply?
- DENSITY/FAR: Do units/floor area comply with density limits?
- SETBACKS: Do proposed setbacks meet requirements?
- PARKING: Are parking requirements met?
- LOT COVERAGE: Does lot coverage comply?
- OVERLAYS: Any special district or overlay requirements?

OUTPUT FORMAT (JSON):
{
  "summary": "Brief overall assessment...",
  "sections": [
    {
      "category": "use",
      "status": "appears_compliant",
      "analysis": "Detailed analysis with citations...",
      "citations": [
        {"section_ref": "§5.2.1", "snippet": "Relevant quote from code..."}
      ]
    }
  ],
  "overall_risk": "low" | "medium" | "high",
  "disclaimer": "This analysis is based on AI interpretation of zoning code excerpts..."
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
