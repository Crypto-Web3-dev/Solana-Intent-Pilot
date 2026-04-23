import { describe, expect, it, vi, beforeEach } from "vitest";
import { JitoAdapter, getRandomTipAccount, JITO_TIP_ACCOUNTS } from "../../src/background/jito-adapter";

describe("JitoAdapter", () => {
  let adapter: JitoAdapter;
  const mockEngineUrl = "https://test.jito.wtf/api/v1/bundles";

  beforeEach(() => {
    adapter = new JitoAdapter(mockEngineUrl);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should simulate a bundle successfully", async () => {
    const mockTxs = ["tx1", "tx2"];
    const mockResult = { summary: "success" };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        result: mockResult,
        id: 1
      })
    } as Response);

    const result = await adapter.simulateBundle(mockTxs);

    expect(fetch).toHaveBeenCalledWith(mockEngineUrl, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "simulateBundle",
        params: [
          {
            encodedTransactions: mockTxs
          }
        ]
      })
    }));
    expect(result).toEqual(mockResult);
  });

  it("should throw error if simulation fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        error: { message: "Simulation failed" },
        id: 1
      })
    } as Response);

    await expect(adapter.simulateBundle(["tx1"])).rejects.toThrow("Jito simulation error: Simulation failed");
  });

  it("should send a bundle successfully", async () => {
    const mockTxs = ["tx1", "tx2"];
    const mockBundleId = "bundle-123";

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        result: mockBundleId,
        id: 1
      })
    } as Response);

    const result = await adapter.sendBundle(mockTxs, 1000);

    expect(fetch).toHaveBeenCalledWith(mockEngineUrl, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [mockTxs]
      })
    }));
    expect(result).toBe(mockBundleId);
  });

  it("should check bundle status successfully", async () => {
    const mockBundleId = "bundle-123";
    const mockStatusResult = {
      value: [
        {
          bundle_id: mockBundleId,
          confirmation_status: "finalized"
        }
      ]
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        result: mockStatusResult,
        id: 1
      })
    } as Response);

    const result = await adapter.getBundleStatus(mockBundleId);

    expect(result).toEqual({
      bundleId: mockBundleId,
      status: "landed"
    });
  });

  it("should return failed status if bundle is not found", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        result: { value: [] },
        id: 1
      })
    } as Response);

    const result = await adapter.getBundleStatus("unknown");

    expect(result.status).toBe("failed");
  });

  it("should return a valid random tip account", () => {
    const account = getRandomTipAccount();
    expect(JITO_TIP_ACCOUNTS).toContain(account);
  });
});
