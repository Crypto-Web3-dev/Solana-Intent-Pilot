import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";

// @ts-ignore
import initWasm, { scan_risk } from "./wasm/sip_risk_engine";
// @ts-ignore
import wasmUrl from "url:./wasm/sip_risk_engine_bg.wasm";

export interface WasmRiskEngine {
  scanRisk(intent: SIPIntent): Promise<SecurityReport | null>;
}

class CoreWasmRiskEngine implements WasmRiskEngine {
  async scanRisk(intent: SIPIntent): Promise<SecurityReport | null> {
    try {
      if (!scan_risk) return null;
      console.log("[Wasm Engine] Scanning intent with Rust core...");
      const resultJson = scan_risk(JSON.stringify(intent));
      return JSON.parse(resultJson) as SecurityReport;
    } catch (err) {
      console.error("[Wasm Engine] Runtime error during scan:", err);
      return null;
    }
  }
}

let engineInstance: WasmRiskEngine | null = null;
let initPromise: Promise<WasmRiskEngine | null> | null = null;

export async function loadDefaultWasmRiskEngine(): Promise<WasmRiskEngine | null> {
  // Skip in tests
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
    return null;
  }

  if (engineInstance) return engineInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log("[Wasm Engine] Initializing with streaming fetch...");

      const finalUrl = wasmUrl.startsWith("http") || wasmUrl.startsWith("chrome-extension")
        ? wasmUrl
        : chrome.runtime.getURL(wasmUrl.replace("/", ""));

      // Crucially, we fetch and pass the Response object directly
      // wasm-bindgen's init function can handle Response for streaming instantiation
      const response = await fetch(finalUrl);
      
      await initWasm(response);

      engineInstance = new CoreWasmRiskEngine();
      console.log("[Wasm Engine] Successfully loaded.");
      return engineInstance;
    } catch (err: any) {
      console.error("[Wasm Engine] Failed to instantiate:", err);
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}
