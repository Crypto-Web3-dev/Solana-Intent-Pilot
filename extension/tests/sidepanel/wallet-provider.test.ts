import { describe, expect, it, vi } from "vitest";
import {
  createDefaultWalletProvider,
  createMockWalletProvider
} from "../../src/sidepanel/wallet-provider";

describe("wallet provider", () => {
  it("throws when no real wallet provider is available in the default production path", () => {
    vi.stubGlobal("window", {});

    expect(() => createDefaultWalletProvider()).toThrow(
      "Wallet provider not available"
    );
  });

  it("keeps the explicit mock wallet provider available for test-only usage", async () => {
    const provider = createMockWalletProvider();
    const result = await provider.submitTransaction("req-1", {} as never, {} as never);

    expect(result.signature).toBe("dev-wallet-req-1");
  });
});
