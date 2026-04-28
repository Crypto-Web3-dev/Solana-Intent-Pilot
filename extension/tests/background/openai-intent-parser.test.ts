import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOpenAIIntentParser,
  formatContextForPrompt,
  normalizeIntentWithContext
} from "../../src/background/openai-intent-parser";
import type { SIPIntent } from "../../src/shared/intent";
import type { DetectedContextSnapshot } from "../../src/shared/context";

const validIntent: SIPIntent = {
  intentId: "req-1",
  actions: [
    {
      id: "action-1",
      type: "SWAP",
      payload: {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        amount: "1000000000",
        amountMode: "exact",
        slippageBps: 50,
        platform: "Jupiter"
      },
      status: "pending"
    }
  ],
  mode: "SINGLE",
  metadata: {
    strategyGoal: "Swap SOL into BONK using page context.",
    estimatedNetChange: {},
    jitoTipLamports: 0,
    reasoning: "Swap SOL into BONK using page context.",
    sourceContext: ["page-token", "selected-text"],
    needsClarification: false
  }
};

const contextSnapshot: DetectedContextSnapshot = {
  tabId: 2,
  url: "https://x.com/some-post",
  title: "A post on X",
  selectedText: "buy this token",
  rawHints: ["buy", "bonk", "jupiter"],
  detectedTokens: [
    {
      symbol: "BONK",
      source: "twitter",
      confidence: 0.82
    }
  ],
  detectedAt: "2026-04-19T00:00:00.000Z"
};

const ambiguousContext: DetectedContextSnapshot = {
  ...contextSnapshot,
  selectedText: undefined,
  detectedTokens: [
    {
      symbol: "BONK",
      source: "twitter",
      confidence: 0.82
    }
  ]
};

const multiTokenContext: DetectedContextSnapshot = {
  ...contextSnapshot,
  detectedTokens: [
    {
      symbol: "BONK",
      source: "twitter",
      confidence: 0.82
    },
    {
      symbol: "WIF",
      source: "twitter",
      confidence: 0.82
    }
  ]
};

const weakMintContext: DetectedContextSnapshot = {
  ...contextSnapshot,
  selectedText: undefined,
  detectedTokens: [],
  rawHints: ["moon", "buy"]
};

const noMintContext: DetectedContextSnapshot = {
  ...contextSnapshot,
  selectedText: undefined,
  detectedTokens: [],
  rawHints: []
};

const verifiedPumpContext: DetectedContextSnapshot = {
  ...contextSnapshot,
  detectedTokens: [
    {
      mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
      symbol: "PUMP",
      name: "Pump",
      source: "generic",
      confidence: 0.92,
      verified: true,
      verificationSource: "jupiter",
      decimals: 6
    }
  ]
};

const multiVerifiedContext: DetectedContextSnapshot = {
  ...contextSnapshot,
  detectedTokens: [
    {
      mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
      symbol: "PUMP",
      name: "Pump",
      source: "generic",
      confidence: 0.92,
      verified: true,
      verificationSource: "jupiter",
      decimals: 6
    },
    {
      mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      symbol: "JUP",
      name: "Jupiter",
      source: "generic",
      confidence: 0.92,
      verified: true,
      verificationSource: "jupiter",
      decimals: 6
    }
  ]
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("openai intent parser", () => {
  it("calls OpenRouter Responses API for AI-backed parsing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          token: "BONK",
          amount: "1",
          amountUnit: "SOL",
          swapMode: "ExactIn"
        })
      })
    });

    const parser = createOpenAIIntentParser({
      apiKey: "or-test-key",
      model: "openai/gpt-oss-120b:free",
      fetchImpl
    });

    const result = await parser.parseIntent("buy 1 SOL of BONK", contextSnapshot);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/responses");
    expect(request.headers.Authorization).toBe("Bearer or-test-key");
    expect(JSON.parse(request.body)).toMatchObject({
      model: "openai/gpt-oss-120b:free",
      temperature: 0,
      max_output_tokens: 128
    });
    expect(JSON.parse(request.body).reasoning).toBeUndefined();
    expect(JSON.parse(request.body).text).toBeUndefined();
    expect(result.actions[0].payload.outputSymbol).toBe("BONK");
  });

  it("falls back to deterministic parsing when OpenRouter returns completed with no output", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "gen-empty",
        object: "response",
        status: "completed",
        output: [],
        error: null
      })
    });

    const parser = createOpenAIIntentParser({
      apiKey: "or-test-key",
      fetchImpl
    });

    const result = await parser.parseIntent("buy 1 SOL of CRIS", {
      ...contextSnapshot,
      selectedText: "cris",
      detectedTokens: [
        {
          mint: "2VuEj1YCQXknpBKPonqBxUCfqvHSJ21FgF5qSgQEpump",
          symbol: "cris",
          name: "cris mayhem donkdong rasta",
          source: "generic",
          confidence: 0.96,
          verified: true,
          decimals: 6,
          verificationSource: "jupiter"
        }
      ]
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.metadata.needsClarification).toBe(false);
    expect(result.actions[0].payload.inputSymbol).toBe("SOL");
    expect(result.actions[0].payload.outputSymbol).toBe("cris");
    expect(result.actions[0].payload.outputDecimals).toBe(6);
    expect(result.actions[0].payload.amount).toBe("1000000000");
  });

  it("ignores OpenRouter reasoning items and parses only assistant output_text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "gen-test",
        object: "response",
        status: "completed",
        output: [
          {
            id: "rs-test",
            type: "reasoning",
            status: "completed",
            content: [
              {
                type: "reasoning_text",
                text: "This text should never be parsed or shown."
              }
            ]
          },
          {
            id: "msg-test",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: "{\"intent\":\"swap\",\"token\":\"CRIS\",\"amount\":1,\"amountUnit\":\"SOL\",\"swapMode\":\"ExactIn\"}"
              }
            ]
          }
        ]
      })
    });

    const parser = createOpenAIIntentParser({
      apiKey: "or-test-key",
      fetchImpl
    });

    const result = await parser.parseIntent("buy 1 SOL of CRIS", {
      ...contextSnapshot,
      selectedText: "cris",
      detectedTokens: [
        {
          mint: "2VuEj1YCQXknpBKPonqBxUCfqvHSJ21FgF5qSgQEpump",
          symbol: "cris",
          name: "cris mayhem donkdong rasta",
          source: "generic",
          confidence: 0.96,
          verified: true,
          decimals: 6,
          verificationSource: "jupiter"
        }
      ]
    });

    expect(result.metadata.needsClarification).toBe(false);
    expect(result.actions[0].payload.outputSymbol).toBe("cris");
    expect(result.actions[0].payload.outputDecimals).toBe(6);
  });

  it("binds the default fetch when calling OpenRouter from a worker runtime", async () => {
    const fetchSpy = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            token: "BONK",
            amount: "1",
            amountUnit: "SOL",
            swapMode: "ExactIn"
          })
        })
      } as Response);
    });
    vi.stubGlobal("fetch", fetchSpy);

    const parser = createOpenAIIntentParser({
      apiKey: "or-test-key",
      model: "openai/gpt-oss-120b:free"
    });

    const result = await parser.parseIntent("buy 1 SOL of BONK", contextSnapshot);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.actions[0].payload.outputSymbol).toBe("BONK");
  });

  it("asks the user to confirm page token candidates before calling AI for this", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: JSON.stringify({ token: "BONK", amount: "1", amountUnit: "SOL" }) } }] };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of this", contextSnapshot);

    expect(completionsCreate).not.toHaveBeenCalled();
    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.clarification?.candidateSymbols).toEqual(["BONK"]);
  });

  it("uses AI for symbol-based exact-in requests like BONK", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: JSON.stringify({ token: "BONK", amount: "1", amountUnit: "SOL" }) } }] };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of BONK", contextSnapshot);

    expect(completionsCreate).toHaveBeenCalledTimes(1);
    expect(result.metadata.needsClarification).toBe(false);
    expect(result.actions[0].payload.inputSymbol).toBe("SOL");
    expect(result.actions[0].payload.outputSymbol).toBe("BONK");
  });

  it("still sends explicit mint requests through AI", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield {
          choices: [
            {
              delta: {
                content: JSON.stringify({
                  token: "4UeLCRqARmfb6e6KQijtiktqqXUxbfk6jZng7DhuBAGS",
                  amount: "1",
                  amountUnit: "SOL",
                  swapMode: "ExactIn"
                })
              }
            }
          ]
        };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);
    const mint = "4UeLCRqARmfb6e6KQijtiktqqXUxbfk6jZng7DhuBAGS";

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent(`buy 1 SOL of ${mint}`, contextSnapshot);

    expect(completionsCreate).toHaveBeenCalledTimes(1);
    expect(result.metadata.needsClarification).toBe(false);
    expect(result.actions[0].payload.swapMode).toBe("ExactIn");
    expect(result.actions[0].payload.inputSymbol).toBe("SOL");
    expect(result.actions[0].payload.outputMint).toBe(mint);
  });

  it("still works when no context snapshot is provided", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: JSON.stringify({ token: "BONK", amount: "1", amountUnit: "SOL" }) } }] };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of this");

    expect(result.actions[0].type).toBe("SWAP");
  });

  it("uses AI for symbol-based ExactOut phrasing like USD1 with SOL", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: JSON.stringify({ token: "USD1", amount: "100", amountUnit: "SOL", swapMode: "ExactOut" }) } }] };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);
    const exactOutContext: DetectedContextSnapshot = {
      ...contextSnapshot,
      detectedTokens: [
        {
          mint: "2b1kV6DkP5Vv7Xr5pH8Vqg7Wk9LwYk8Y9mQx7Vd1USD",
          symbol: "USD1",
          name: "USD1",
          source: "twitter",
          confidence: 0.9,
          verified: true,
          verificationSource: "jupiter",
          decimals: 6
        }
      ]
    };

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 100 USD1 with SOL", exactOutContext);

    expect(completionsCreate).toHaveBeenCalledTimes(1);
    expect(result.metadata.needsClarification).toBe(false);
    expect(result.actions[0].payload.swapMode).toBe("ExactOut");
    expect(result.actions[0].payload.outputSymbol).toBe("USD1");
    expect(result.actions[0].payload.inputSymbol).toBe("SOL");
    expect(result.metadata.reasoning).toContain("Receiving 100 USD1");
  });

  it("uses AI for receive phrasing when only symbols are present", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: JSON.stringify({ token: "USD1", amount: "100", amountUnit: "SOL", swapMode: "ExactOut" }) } }] };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);
    const exactOutContext: DetectedContextSnapshot = {
      ...contextSnapshot,
      detectedTokens: [
        {
          mint: "2b1kV6DkP5Vv7Xr5pH8Vqg7Wk9LwYk8Y9mQx7Vd1USD",
          symbol: "USD1",
          name: "USD1",
          source: "twitter",
          confidence: 0.9,
          verified: true,
          verificationSource: "jupiter",
          decimals: 6
        }
      ]
    };

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("receive 100 USD1 with SOL", exactOutContext);

    expect(completionsCreate).toHaveBeenCalledTimes(1);
    expect(result.metadata.needsClarification).toBe(false);
    expect(result.actions[0].payload.swapMode).toBe("ExactOut");
    expect(result.actions[0].payload.outputSymbol).toBe("USD1");
    expect(result.actions[0].payload.inputSymbol).toBe("SOL");
  });

  it("requires clarification when a short symbol like AI cannot be uniquely verified", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield {
          choices: [
            {
              delta: {
                content: JSON.stringify({
                  token: "AI",
                  amount: "1",
                  amountUnit: "SOL",
                  swapMode: "ExactIn"
                })
              }
            }
          ]
        };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of AI", contextSnapshot);

    expect(completionsCreate).toHaveBeenCalledTimes(1);
    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.reasoning).toContain("could not uniquely verify the token symbol AI");
    expect(result.actions[0].payload.outputMint).toBe("");
  });

  it("offers name and mint choices when a symbol like USD1 has multiple exact matches", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield {
          choices: [
            {
              delta: {
                content: JSON.stringify({
                  token: "USD1",
                  amount: "1",
                  amountUnit: "SOL",
                  swapMode: "ExactIn"
                })
              }
            }
          ]
        };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
            name: "World Liberty Financial USD",
            symbol: "USD1",
            decimals: 6
          },
          {
            id: "DwDbxZhdDyqDzZFuQpHAvj7ZoxijDwW4e3PWnoDtpump",
            name: "USD1",
            symbol: "USD1",
            decimals: 6
          }
        ]
      } as any);

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of USD1", contextSnapshot);

    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.clarification?.kind).toBe("ambiguous-output-mint");
    expect(result.metadata.clarification?.candidateSymbols).toEqual([
      "USD1 | World Liberty Financial USD | USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
      "USD1 | USD1 | DwDbxZhdDyqDzZFuQpHAvj7ZoxijDwW4e3PWnoDtpump"
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockRestore();
  });

  it("does not query Jupiter again when the user has already provided a mint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => []
    } as any);
    const mintCompletion = {
      async *[Symbol.asyncIterator]() {
        yield {
          choices: [
            {
              delta: {
                content: JSON.stringify({
                  token: "4UeLCRqARmfb6e6KQijtiktqqXUxbfk6jZng7DhuBAGS",
                  amount: "1",
                  amountUnit: "SOL",
                  swapMode: "ExactIn"
                })
              }
            }
          ]
        };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mintCompletion);
    const mint = "4UeLCRqARmfb6e6KQijtiktqqXUxbfk6jZng7DhuBAGS";

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent(`buy 1 SOL of ${mint}`, contextSnapshot);

    expect(completionsCreate).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.actions[0].payload.outputMint).toBe(mint);

    fetchMock.mockRestore();
  });

  it("reuses cached decimals for a confirmed mint after ambiguous symbol selection", async () => {
    const ambiguousSymbolCompletion = {
      async *[Symbol.asyncIterator]() {
        yield {
          choices: [
            {
              delta: {
                content: JSON.stringify({
                  token: "USD1",
                  amount: "1",
                  amountUnit: "SOL",
                  swapMode: "ExactIn"
                })
              }
            }
          ]
        };
      }
    };
    const confirmedMintCompletion = {
      async *[Symbol.asyncIterator]() {
        yield {
          choices: [
            {
              delta: {
                content: JSON.stringify({
                  token: "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
                  amount: "100",
                  amountUnit: "SOL",
                  swapMode: "ExactIn"
                })
              }
            }
          ]
        };
      }
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
            name: "World Liberty Financial USD",
            symbol: "USD1",
            decimals: 6
          },
          {
            id: "DwDbxZhdDyqDzZFuQpHAvj7ZoxijDwW4e3PWnoDtpump",
            name: "USD1",
            symbol: "USD1",
            decimals: 6
          }
        ]
      } as any);
    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: vi
              .fn()
              .mockResolvedValueOnce(ambiguousSymbolCompletion)
              .mockResolvedValueOnce(confirmedMintCompletion)
          }
        }
      } as any,
      apiKey: "test-key"
    });

    await parser.parseIntent("buy 1 SOL of USD1", contextSnapshot);
    fetchMock.mockClear();

    const result = await parser.parseIntent(
      "buy 100 SOL of USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
      contextSnapshot
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.actions[0].payload.outputMint).toBe("USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB");
    expect(result.actions[0].payload.outputDecimals).toBe(6);

    fetchMock.mockRestore();
  });

  it("asks for user confirmation even when a single verified page token exists", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: JSON.stringify({ token: "this", amount: "1", amountUnit: "SOL" }) } }] };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of this", verifiedPumpContext);

    expect(completionsCreate).not.toHaveBeenCalled();
    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.clarification?.candidateSymbols).toEqual(["PUMP"]);
  });

  it("does not let AI hallucinate a token name before user confirms this", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: JSON.stringify({ token: "OG", amount: "1", amountUnit: "SOL" }) } }] };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of this", verifiedPumpContext);

    expect(completionsCreate).not.toHaveBeenCalled();
    expect(result.actions[0].payload.outputSymbol).not.toBe("OG");
    expect(result.metadata.strategyGoal).toBe("Confirm token");
    expect(result.metadata.needsClarification).toBe(true);
  });

  it("asks for user confirmation when this page has multiple verified tokens", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: JSON.stringify({ token: "PUMP", amount: "1", amountUnit: "SOL" }) } }] };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of this", multiVerifiedContext);

    expect(completionsCreate).not.toHaveBeenCalled();
    expect(result.metadata.clarification?.candidateSymbols).toEqual(["PUMP", "JUP"]);
    expect(result.metadata.needsClarification).toBe(true);
  });

  it("requires clarification when AI chooses a token outside verified candidates", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: JSON.stringify({ token: "OG", amount: "1", amountUnit: "SOL" }) } }] };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of this", multiVerifiedContext);

    expect(result.actions[0].payload.outputSymbol).not.toBe("OG");
    expect(result.metadata.needsClarification).toBe(true);
  });

  it("does not treat this as a token name when no verified page token exists", async () => {
    const mockCompletion = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: JSON.stringify({ token: "this", amount: "1", amountUnit: "SOL" }) } }] };
      }
    };
    const completionsCreate = vi.fn().mockResolvedValue(mockCompletion);

    const parser = createOpenAIIntentParser({
      client: {
        chat: {
          completions: {
            create: completionsCreate
          }
        }
      } as any,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of this", contextSnapshot);

    expect(result.actions[0].payload.outputSymbol).not.toBe("THIS");
    expect(result.metadata.needsClarification).toBe(true);
  });

  it("formats context into a stable summary block", () => {
    const summary = formatContextForPrompt(contextSnapshot);

    expect(summary).toContain("Page URL:");
    expect(summary).toContain("Selected Text:");
    expect(summary).toContain("Detected Tokens:");
  });

  it("includes verified token metadata in the prompt context", () => {
    const summary = formatContextForPrompt({
      tabId: 1,
      url: "https://solscan.io/token/pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
      title: "PUMP",
      detectedAt: "2026-04-26T00:00:00.000Z",
      rawHints: [],
      detectedTokens: [
        {
          mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
          symbol: "PUMP",
          name: "Pump.fun",
          source: "generic",
          confidence: 0.92,
          verified: true,
          verificationSource: "jupiter",
          decimals: 6
        }
      ]
    });

    expect(summary).toContain(
      "generic:pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn:0.92:verified:decimals=6:PUMP Pump.fun"
    );
  });

  it("keeps high certainty for a specific request with strong context", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy 1 SOL of BONK"
    );

    expect(normalized.metadata.needsClarification).toBe(false);
    expect(normalized.metadata.sourceContext).toContain("user-input");
    expect(normalized.metadata.sourceContext).toContain("detected-token");
  });

  it("requires clarification when multiple token candidates exist", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      multiTokenContext,
      "buy this"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
  });

  it("requires clarification for extremely underspecified requests", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
  });

  it("keeps a resolved outputMint when explicit intent matches strong single-token context", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy 1 SOL of BONK"
    );

    expect(normalized.actions[0].payload.outputMint).toBe(validIntent.actions[0].payload.outputMint);
    expect(normalized.metadata.needsClarification).toBe(false);
  });

  it("produces missing-output-mint clarification when no candidate exists", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      noMintContext,
      "buy"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.metadata.clarification?.kind).toBe(
      "missing-output-mint"
    );
  });

  it("produces unknown-output-mint clarification for weak unresolved hints", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      weakMintContext,
      "buy this"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.metadata.clarification?.kind).toBe(
      "unknown-output-mint"
    );
  });

  it("produces ambiguous-output-mint clarification with candidate symbols", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      multiTokenContext,
      "buy this"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.metadata.clarification?.kind).toBe(
      "ambiguous-output-mint"
    );
    expect(normalized.metadata.clarification?.candidateSymbols).toEqual([
      "BONK",
      "WIF"
    ]);
  });

  it("produces underspecified-request clarification for generic commands", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.metadata.clarification?.kind).toBe(
      "underspecified-request"
    );
  });
});
