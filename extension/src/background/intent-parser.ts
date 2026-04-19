import type { DetectedContextSnapshot } from "../shared/context";
import type { SIPIntent } from "../shared/intent";
import { createOpenAIIntentParser } from "./openai-intent-parser";
import { mockParseIntent } from "./mock-services";

export interface IntentParser {
  parseIntent(
    userInput: string,
    context?: DetectedContextSnapshot
  ): Promise<SIPIntent>;
}

export function createMockIntentParser(): IntentParser {
  return {
    parseIntent(userInput: string): Promise<SIPIntent> {
      return mockParseIntent(userInput);
    }
  };
}

export function createDefaultIntentParser(): IntentParser {
  const openAIParser = createOpenAIIntentParser();

  return {
    async parseIntent(userInput: string, context?: DetectedContextSnapshot) {
      try {
        return await openAIParser.parseIntent(userInput, context);
      } catch {
        return mockParseIntent(userInput);
      }
    }
  };
}
