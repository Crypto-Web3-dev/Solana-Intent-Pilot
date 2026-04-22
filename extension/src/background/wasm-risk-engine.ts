import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";

// 仅在非测试环境下导入，避免 Vitest (Node) 崩溃
let initWasm: ((opts?: { module_or_path?: string | ArrayBuffer }) => Promise<any>) | undefined;
let scan_risk: ((intent_json: string) => string) | undefined;
let wasmUrl: string | undefined;

let wasmModulePromise: Promise<any> | null = null;
let wasmUrlPromise: Promise<string> | null = null;

if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
  wasmModulePromise = import("./wasm/sip_risk_engine").then(m => {
    initWasm = m.default;
    scan_risk = m.scan_risk;
    return m;
  });
  wasmUrlPromise = import("url:./wasm/sip_risk_engine_bg.wasm").then(m => {
    wasmUrl = m.default;
    return m.default;
  });
}

export interface WasmRiskEngine {
  scanRisk(intent: SIPIntent): Promise<SecurityReport | null>;
}

class CoreWasmRiskEngine implements WasmRiskEngine {
  async scanRisk(intent: SIPIntent): Promise<SecurityReport | null> {
    try {
      if (!scan_risk) {
        console.error("[Wasm Engine] scan_risk is not available");
        return null;
      }
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
  // 生产环境安全检查
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
    return null;
  }

  if (engineInstance) return engineInstance;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 等待 dynamic import 完成
      if (wasmModulePromise && wasmUrlPromise) {
        await Promise.all([wasmModulePromise, wasmUrlPromise]);
      }

      if (!initWasm || !wasmUrl) {
        console.error("[Wasm Engine] Wasm module or URL not loaded");
        initPromise = null;
        return null;
      }

      console.log("[Wasm Engine] Received raw asset URL from Plasmo:", wasmUrl);

      // 修复双重前缀问题：Plasmo 生成的 URL 已经是正确的了
      // 如果它不是以 http 或 chrome 开头，我们才考虑手动转换
      const finalUrl = wasmUrl.startsWith("http") || wasmUrl.startsWith("chrome-extension")
        ? wasmUrl
        : chrome.runtime.getURL(wasmUrl);

      console.log("[Wasm Engine] Initializing with final URL:", finalUrl);

      // 先 fetch wasm 文件，然后传入 ArrayBuffer
      // 这绕过了 wasm-bindgen 的 fetch 逻辑，避免可能的 __proto__: null 问题
      const response = await fetch(finalUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch wasm: ${response.status} ${response.statusText}`);
      }
      const wasmBytes = await response.arrayBuffer();
      console.log("[Wasm Engine] Fetched wasm bytes:", wasmBytes.byteLength);

      // 使用 wasm-bindgen 的初始化函数，传入 ArrayBuffer
      await initWasm({ module_or_path: wasmBytes });

      engineInstance = new CoreWasmRiskEngine();
      console.log("[Wasm Engine] Successfully loaded.");
      return engineInstance;
    } catch (err: any) {
      console.error("[Wasm Engine] Failed to instantiate:", err);
      initPromise = null; // 允许下次重试
      return null;
    }
  })();

  return initPromise;
}
