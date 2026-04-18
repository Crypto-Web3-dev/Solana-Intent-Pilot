import type { DetectedContextSnapshot } from "./context";
import type { ExecutionPreview } from "./execution";
import type { SIPIntent } from "./intent";
import type { SecurityReport } from "./risk";
import type { WorkflowPhase, WorkflowReason } from "./workflow";

export interface ContextDetectedMessage {
  type: "context.detected";
  payload: DetectedContextSnapshot;
}

export interface ContextClearedMessage {
  type: "context.cleared";
  payload: {
    tabId: number;
    clearedAt: string;
  };
}

export interface IntentParseRequestedMessage {
  type: "intent.parse.requested";
  payload: {
    requestId: string;
    tabId: number;
    userInput: string;
    contextSnapshot: DetectedContextSnapshot;
  };
}

export interface IntentParseSucceededMessage {
  type: "intent.parse.succeeded";
  payload: {
    requestId: string;
    intent: SIPIntent;
  };
}

export interface IntentParseFailedMessage {
  type: "intent.parse.failed";
  payload: {
    requestId: string;
    reason: string;
    recoverable: boolean;
  };
}

export interface RiskScanRequestedMessage {
  type: "risk.scan.requested";
  payload: {
    requestId: string;
    mintAddress: string;
    sourceIntent: SIPIntent["payload"];
  };
}

export interface RiskScanCompletedMessage {
  type: "risk.scan.completed";
  payload: {
    requestId: string;
    report: SecurityReport;
  };
}

export interface ExecutionPreviewReadyMessage {
  type: "execution.preview.ready";
  payload: ExecutionPreview;
}

export interface ExecutionPreviewFailedMessage {
  type: "execution.preview.failed";
  payload: {
    requestId: string;
    stage: "quote" | "simulate";
    reason: string;
  };
}

export interface ExecutionConfirmedMessage {
  type: "execution.confirmed";
  payload: {
    requestId: string;
  };
}

export interface ExecutionCancelledMessage {
  type: "execution.cancelled";
  payload: {
    requestId: string;
  };
}

export interface TransactionSubmittedMessage {
  type: "transaction.submitted";
  payload: {
    requestId: string;
    signature: string;
  };
}

export interface TransactionFailedMessage {
  type: "transaction.failed";
  payload: {
    requestId: string;
    reason: string;
  };
}

export interface TransactionSettledMessage {
  type: "transaction.settled";
  payload: {
    requestId: string;
    signature: string;
    explorerUrl?: string;
    settledAt: string;
  };
}

export interface WorkflowStateChangedMessage {
  type: "workflow.state.changed";
  payload: {
    requestId: string;
    phase: WorkflowPhase;
    reason?: WorkflowReason | string;
  };
}

export type SIPRuntimeMessage =
  | ContextDetectedMessage
  | ContextClearedMessage
  | IntentParseRequestedMessage
  | IntentParseSucceededMessage
  | IntentParseFailedMessage
  | RiskScanRequestedMessage
  | RiskScanCompletedMessage
  | ExecutionPreviewReadyMessage
  | ExecutionPreviewFailedMessage
  | ExecutionConfirmedMessage
  | ExecutionCancelledMessage
  | TransactionSubmittedMessage
  | TransactionFailedMessage
  | TransactionSettledMessage
  | WorkflowStateChangedMessage;
