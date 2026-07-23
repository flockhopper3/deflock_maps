/**
 * Verdict line for the route scoreboard. Null when the privacy route
 * saves nothing; the scoreboard hides the row then.
 */
export function verdictLine(camerasAvoided: number): string | null {
  if (camerasAvoided <= 0) return null;
  const noun = camerasAvoided === 1 ? 'camera' : 'cameras';
  return `${camerasAvoided} fewer ${noun} will scan your plates`;
}
