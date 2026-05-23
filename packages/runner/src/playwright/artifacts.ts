export type Artifacts = {
  screenshotPath: string | null;
  domSnapshot: string | null;
  consoleMessages: ReadonlyArray<string>;
  errorMessage: string | null;
  errorStack: string | null;
};

export const emptyArtifacts = (): Artifacts => ({
  screenshotPath: null,
  domSnapshot: null,
  consoleMessages: [],
  errorMessage: null,
  errorStack: null,
});
