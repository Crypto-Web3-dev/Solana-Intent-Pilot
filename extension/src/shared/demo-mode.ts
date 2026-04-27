function readFlag(value: string | undefined) {
  if (!value) {
    return false;
  }

  return value === "1" || value.toLowerCase() === "true";
}

export function isDemoModeEnabled() {
  return readFlag(process.env.PLASMO_PUBLIC_DEMO_MODE);
}

export function getDemoModeHelpUrl() {
  return "https://jup.ag";
}
