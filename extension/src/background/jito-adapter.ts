export interface JitoBundleResult {
  bundleId: string;
  status: "landed" | "failed";
}

export const JITO_TIP_ACCOUNTS = [
  "96gWuSmeNJysN72BSvLHhZmSgn89mbCQCXf8v67uBvCz",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADa4HocqXCfbCczHbcjaS7pYfV6zN5o1z3pY45v8jB36",
  "ADuSpgCbv7H94j0pS8f1yD7S6v3i4w6w6r47vC9p8xYF",
  "DttWaJV966P97S7rS99N5v6W1P6S9R1R2T2V2X2Z2",
  "3AVi9Tg9Uo69nJjsS6S9v9S9S9S9S9S9S9S9S9S9S",
  "Df68U6S6S9S9S9S9S9S9S9S9S9S9S9S9S9S9S9S9",
];

export function getRandomTipAccount(): string {
  return JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
}

export class JitoAdapter {
  private engineUrl: string;

  constructor(engineUrl: string = "https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles") {
    this.engineUrl = engineUrl;
  }

  /**
   * Simulates a bundle of transactions.
   * @param transactions Array of base58 encoded signed transactions.
   * @returns Simulation results.
   */
  async simulateBundle(transactions: string[]): Promise<any> {
    const response = await fetch(this.engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "simulateBundle",
        params: [
          {
            encodedTransactions: transactions
          }
        ]
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Jito simulation error: ${data.error.message}`);
    }
    return data.result;
  }

  /**
   * Sends a bundle of transactions to Jito Block Engine.
   * @param transactions Array of base58 encoded signed transactions.
   * @param _tipLamports Tip amount in lamports (Note: In this implementation, the tip transaction must already be included in the transactions array).
   * @returns Bundle ID.
   */
  async sendBundle(transactions: string[], _tipLamports?: number): Promise<string> {
    // In a real scenario, if tipLamports was provided and no tip tx existed, 
    // we would need a way to create and sign a tip transaction here.
    // For MVP, we assume the bundle passed in already contains all necessary transactions.

    const response = await fetch(this.engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [transactions]
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Jito send error: ${data.error.message}`);
    }
    return data.result; // Bundle ID
  }

  /**
   * Checks the status of a bundle.
   * @param bundleId Bundle ID to check.
   * @returns Bundle status.
   */
  async getBundleStatus(bundleId: string): Promise<JitoBundleResult> {
    const response = await fetch(this.engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBundleStatuses",
        params: [[bundleId]]
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Jito status error: ${data.error.message}`);
    }

    const result = data.result.value[0];
    if (!result) {
      return { bundleId, status: "failed" };
    }

    return {
      bundleId: result.bundle_id,
      status: result.confirmation_status === "finalized" || result.confirmation_status === "confirmed" ? "landed" : "failed"
    };
  }
}
