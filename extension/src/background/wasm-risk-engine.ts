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
      if (!scan_risk) {
        console.error("[Wasm Engine] scan_risk function is not defined!");
        return null;
      }
      const inputJson = JSON.stringify(intent);
      console.log("[Wasm Engine] Scanning intent with Rust core. Input payload length:", inputJson.length);
      
      const resultJson = scan_risk(inputJson);
      console.log("[Wasm Engine] Raw result from Rust:", resultJson);
      
      const report = JSON.parse(resultJson);
      if (report.error) {
        console.error("[Wasm Engine] Rust core returned an error:", report.error);
        return null;
      }
      return report as SecurityReport;
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
