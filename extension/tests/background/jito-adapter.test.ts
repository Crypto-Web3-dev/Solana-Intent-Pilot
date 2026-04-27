import { beforeEach, describe, expect, it, vi } from "vitest";
import { JitoAdapter } from "../../src/background/jito-adapter";

describe("JitoAdapter", () => {
  let adapter: JitoAdapter;
  const blockEngineUrl = "https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles";

  beforeEach(() => {
    adapter = new JitoAdapter("ny");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("simulates a bundle successfully", async () => {
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

    expect(fetch).toHaveBeenCalledWith(
      blockEngineUrl,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "simulateBundle",
          params: [
            {
              encodedTransactions: mockTxs
            },
            {
              preExecutionAccountsConfigs: [],
              postExecutionAccountsConfigs: []
            }
          ]
        })
      })
    );
    expect(result).toEqual(mockResult);
  });

  it("throws error if simulation returns a JSON-RPC error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        error: { message: "Simulation failed" },
        id: 1
      })
    } as Response);

    await expect(adapter.simulateBundle(["tx1"])).rejects.toThrow(
      "Jito simulation error: Simulation failed"
    );
  });

  it("throws error when simulation HTTP request fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "upstream unavailable"
    } as Response);

    await expect(adapter.simulateBundle(["tx1"])).rejects.toThrow(
      "Jito simulation HTTP error: 503 - upstream unavailable"
    );
  });

  it("throws error when simulation fetch fails instead of returning optimistic success", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

    await expect(adapter.simulateBundle(["tx1"])).rejects.toThrow("network down");
  });

  it("sends a bundle successfully", async () => {
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

    const result = await adapter.sendBundle(mockTxs);

    expect(fetch).toHaveBeenCalledWith(
      blockEngineUrl,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendBundle",
          params: [mockTxs]
        })
      })
    );
    expect(result).toBe(mockBundleId);
  });

  it("checks bundle status successfully", async () => {
    const mockBundleId = "bundle-123";

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        result: {
          value: [
            {
              bundle_id: mockBundleId,
              confirmation_status: "finalized"
            }
          ]
        },
        id: 1
      })
    } as Response);

    const result = await adapter.getBundleStatus(mockBundleId);

    expect(fetch).toHaveBeenCalledWith(
      blockEngineUrl,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBundleStatuses",
          params: [[mockBundleId]]
        })
      })
    );
    expect(result).toEqual({
      bundleId: mockBundleId,
      status: "landed"
    });
  });

  it("returns failed status if bundle is not found", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        result: { value: [] },
        id: 1
      })
    } as Response);

    const result = await adapter.getBundleStatus("unknown");

    expect(result).toEqual({
      bundleId: "unknown",
      status: "failed"
    });
  });
});
