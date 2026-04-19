import type { ExecutionPreview } from "../../shared/execution";
import type { ClarificationPayload } from "../../shared/intent";
import type { WorkflowPhase, WorkflowReason } from "../../shared/workflow";
import type { WalletStatus } from "../wallet-state";

function phaseMessage(phase: WorkflowPhase, reason: WorkflowReason | string | null) {
  if (phase === "blocked" && reason === "unsupported-page") {
    return "Signing is only available on normal web pages. Please switch to an http(s) tab.";
  }

  if (phase === "blocked") {
    return "Execution is blocked by policy.";
  }

  if (phase === "failed") {
    return `Execution failed${reason ? `: ${reason}` : ""}`;
  }

  if (phase === "idle" && reason === "clarification-required") {
    return "More information is needed before we can continue.";
  }

  if (phase === "awaiting-signature") {
    return "Preview is ready. Waiting for wallet confirmation.";
  }

  if (phase === "submitting") {
    return "Transaction is being submitted.";
  }

  if (phase === "confirmed") {
    return "Transaction confirmed.";
  }

  if (phase === "simulating") {
    return "Simulation in progress.";
  }

  if (phase === "quoting") {
    return "Quote in progress.";
  }

  return `Phase: ${phase}`;
}

function actionHint(phase: WorkflowPhase, reason: WorkflowReason | string | null) {
  if (phase === "blocked" && reason === "unsupported-page") {
    return "Open a normal website tab and try again.";
  }

  if (phase === "blocked") {
    return "Return to the request and adjust the intent.";
  }

  return null;
}

function walletMessage(walletStatus: WalletStatus, isSigning: boolean) {
  if (isSigning || walletStatus === "connecting") {
    return "Waiting for your wallet to respond.";
  }

  if (walletStatus === "submitted") {
    return "Transaction submitted. Waiting for chain confirmation.";
  }

  if (walletStatus === "provider-missing") {
    return "No Solana wallet was detected on the current page.";
  }

  if (walletStatus === "unsupported-page") {
    return "Switch to a normal website tab before trying to sign.";
  }

  if (walletStatus === "ready") {
    return "Wallet provider detected on the current page.";
  }

  if (walletStatus === "failed") {
    return "We could not verify wallet availability yet.";
  }

  return null;
}

function clarificationTitle(kind: ClarificationPayload["kind"]) {
  switch (kind) {
    case "missing-output-mint":
      return "Missing token candidate";
    case "unknown-output-mint":
      return "Unknown token candidate";
    case "ambiguous-output-mint":
      return "Ambiguous token candidate";
    case "underspecified-request":
      return "Request too vague";
  }
}

export function ActionCard({
  preview,
  phase,
  reason,
  clarification,
  walletStatus,
  isSigning,
  onConfirm,
  onCancel,
  onFailSubmit,
  onSettle,
  onOpenNormalPage
}: {
  preview: ExecutionPreview | null;
  phase: WorkflowPhase;
  reason: WorkflowReason | string | null;
  clarification?: ClarificationPayload | null;
  walletStatus: WalletStatus;
  isSigning: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onFailSubmit: () => void;
  onSettle: () => void;
  onOpenNormalPage: () => void;
}) {
  const isUnsupportedPage = phase === "blocked" && reason === "unsupported-page";
  const isWalletReady = walletStatus === "ready";
  const walletHint = walletMessage(walletStatus, isSigning);

  return (
    <div>
      <div>{phaseMessage(phase, reason)}</div>
      {actionHint(phase, reason) ? <div>{actionHint(phase, reason)}</div> : null}
      {phase === "idle" && reason === "clarification-required" ? (
        <div>
          <div>Clarification needed</div>
          <div>{clarification?.message ?? "More information is needed before we can continue."}</div>
          <div>{clarificationTitle(clarification?.kind ?? "underspecified-request")}</div>
          {clarification?.candidateSymbols?.length ? (
            <div>Possible tokens: {clarification.candidateSymbols.join(", ")}</div>
          ) : null}
        </div>
      ) : null}
      {walletHint ? <div>{walletHint}</div> : null}
      {preview ? (
        <div>
          <div>Route: {preview.routeLabel}</div>
          <div>Output: {preview.outputAmount}</div>
        </div>
      ) : null}
      {phase === "awaiting-signature" ? (
        <div>
          <button onClick={onConfirm} disabled={!isWalletReady || isSigning}>
            {isSigning ? "Confirming..." : "Confirm Signature"}
          </button>
          <button onClick={onCancel}>Mock Cancel Signature</button>
        </div>
      ) : null}
      {isUnsupportedPage ? (
        <div>
          <button onClick={onOpenNormalPage}>Open normal webpage</button>
        </div>
      ) : null}
      {phase === "submitting" ? (
        <div>
          <button onClick={onSettle}>Mock Settle</button>
          <button onClick={onFailSubmit}>Mock Submit Failure</button>
        </div>
      ) : null}
    </div>
  );
}
