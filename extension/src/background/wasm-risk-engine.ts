import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";

// 仅在非测试环境下导入，避免 Vitest (Node) 崩溃
let initWasm: any;
let scan_risk: any;
let wasmUrl: string;

if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
  // @ts-ignore
  import("./wasm/sip_risk_engine").then(m => {
    initWasm = m.default;
    scan_risk = m.scan_risk;
  });
  // @ts-ignore
  import("url:./wasm/sip_risk_engine_bg.wasm").then(m => {
    wasmUrl = m.default;
  });
}

export interface WasmRiskEngine {
  scanRisk(intent: SIPIntent): Promise<SecurityReport | null>;
}

class CoreWasmRiskEngine implements WasmRiskEngine {
  async scanRisk(intent: SIPIntent): Promise<SecurityReport | null> {
    try {
      console.log("[Wasm Engine] Scanning intent with Rust core...");
      // 调用 Rust 导出的函数
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
      console.log("[Wasm Engine] Received raw asset URL from Plasmo:", wasmUrl);
      
      // 修复双重前缀问题：Plasmo 生成的 URL 已经是正确的了
      // 如果它不是以 http 或 chrome 开头，我们才考虑手动转换
      const finalUrl = wasmUrl.startsWith("http") || wasmUrl.startsWith("chrome-extension") 
        ? wasmUrl 
        : chrome.runtime.getURL(wasmUrl);

      console.log("[Wasm Engine] Initializing with final URL:", finalUrl);
      
      // 修复警告：最新的 wasm-bindgen 建议传递一个对象
      // 如果报错，自动回退到原始传参方式
      try {
        await initWasm({ module_or_path: finalUrl });
      } catch (e) {
        await initWasm(finalUrl);
      }
      
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
