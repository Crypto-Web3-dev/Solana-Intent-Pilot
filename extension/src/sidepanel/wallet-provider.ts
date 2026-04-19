import type { ExecutionPreview } from "../shared/execution";
import type { SIPIntent } from "../shared/intent";

export interface WalletSubmissionResult {
  signature: string;
  explorerUrl?: string;
}

export interface WalletProvider {
  submitTransaction(
    requestId: string,
    intent: SIPIntent,
    preview: ExecutionPreview
  ): Promise<WalletSubmissionResult>;
}

type SolanaWallet = {
  isPhantom?: boolean;
  signAndSendTransaction?: (transaction: unknown) => Promise<{ signature: string }>;
  signTransaction?: (transaction: unknown) => Promise<unknown>;
  connect?: () => Promise<{ publicKey?: { toBase58: () => string } }>;
};

type WindowWithSolana = Window & {
  solana?: SolanaWallet;
};

export function createMockWalletProvider(): WalletProvider {
  return {
    async submitTransaction(
      requestId: string
    ): Promise<WalletSubmissionResult> {
      return {
        signature: `mock-signature-${requestId}`,
        explorerUrl: `https://explorer.solana.com/tx/mock-signature-${requestId}`
      };
    }
  };
}

export function createWindowSolanaWalletProvider(): WalletProvider | null {
  const windowWithSolana = globalThis.window as WindowWithSolana | undefined;
  const solana = windowWithSolana?.solana;

  if (!solana) {
    return null;
  }

  return {
    async submitTransaction(
      requestId: string,
      intent: SIPIntent,
      preview: ExecutionPreview
    ): Promise<WalletSubmissionResult> {
      void requestId;
      void intent;
      void preview;

      if (typeof solana.connect === "function") {
        await solana.connect();
      }

      if (typeof solana.signAndSendTransaction === "function") {
        const signed = await solana.signAndSendTransaction({});

        return {
          signature: signed.signature,
          explorerUrl: `https://explorer.solana.com/tx/${signed.signature}`
        };
      }

      if (typeof solana.signTransaction === "function") {
        await solana.signTransaction({});

        return {
          signature: `signed-${requestId}`,
          explorerUrl: `https://explorer.solana.com/tx/signed-${requestId}`
        };
      }

      throw new Error("No compatible wallet signing method found");
    }
  };
}

export function createDefaultWalletProvider(): WalletProvider {
  return createWindowSolanaWalletProvider() ?? createMockWalletProvider();
}
