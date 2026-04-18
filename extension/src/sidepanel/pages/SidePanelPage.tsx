import { useState } from "react";
import { DetectionBar } from "../components/DetectionBar";
import { IntentSummaryCard } from "../components/IntentSummaryCard";
import { RiskIndicator } from "../components/RiskIndicator";
import { ActionCard } from "../components/ActionCard";
import { useSidePanelState } from "../hooks/useSidePanelState";

export function SidePanelPage() {
  const [input, setInput] = useState("buy 1 SOL of this");
  const {
    requestId,
    phase,
    reason,
    intent,
    risk,
    preview,
    errorMessage,
    submit,
    confirmSignature,
    cancelSignature,
    failSubmission,
    settleTransaction
  } = useSidePanelState();

  return (
    <main>
      <h1>SIP Side Panel</h1>
      <DetectionBar phase={phase} />
      <input value={input} onChange={(event) => setInput(event.target.value)} />
      <button onClick={() => void submit(input)}>Submit Mock Intent</button>
      <div>Request: {requestId ?? "none"}</div>
      <div>Workflow: {phase}</div>
      <div>Reason: {reason ?? "none"}</div>
      <IntentSummaryCard intent={intent} phase={phase} />
      <RiskIndicator risk={risk} phase={phase} />
      {errorMessage ? <div>Error: {errorMessage}</div> : null}
      <ActionCard
        preview={preview}
        phase={phase}
        reason={reason}
        onConfirm={confirmSignature}
        onCancel={cancelSignature}
        onFailSubmit={failSubmission}
        onSettle={settleTransaction}
      />
    </main>
  );
}
