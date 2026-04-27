import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDemoModeHelpUrl,
  isDemoModeEnabled
} from "../../src/shared/demo-mode";

describe("demo mode helpers", () => {
  afterEach(() => {
    delete process.env.PLASMO_PUBLIC_DEMO_MODE;
    vi.unstubAllEnvs();
  });

  it("is disabled by default", () => {
    expect(isDemoModeEnabled()).toBe(false);
  });

  it("is enabled when the demo flag is set", () => {
    vi.stubEnv("PLASMO_PUBLIC_DEMO_MODE", "true");

    expect(isDemoModeEnabled()).toBe(true);
  });

  it("returns the intentional demo help URL", () => {
    expect(getDemoModeHelpUrl()).toBe("https://jup.ag");
  });
});
