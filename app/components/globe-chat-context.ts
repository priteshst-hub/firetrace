
export type GlobeChatContext = {
  dataset: 'global' | 'legacy' | 'australia';
  countryCode: string;
  countryName: string;
  year: string;
  month: string;
  dayNight: 'ALL' | 'D' | 'N';
  platform: 'ALL' | 'Terra' | 'Aqua';
  showModis: boolean;
  showViirs: boolean;
  dataLoaded: boolean;
};

let currentGlobeContext: GlobeChatContext | null = null;

export function updateGlobeChatContext(
  context: GlobeChatContext
): void {
  currentGlobeContext = { ...context };
}

export function getGlobeChatContext():
  GlobeChatContext | null {
  return currentGlobeContext
    ? { ...currentGlobeContext }
    : null;
}
