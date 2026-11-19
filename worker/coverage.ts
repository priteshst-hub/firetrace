/** Stable product facts must not depend on generative inference. */
export function isCoverageQuestion(question: string): boolean {
  return /\b(?:how many years|which years|what years|only (?:(?:have|has|offers?|supports?) )?(?:two|2) years|date range|historical coverage|archive coverage|years? (?:of data|available|covered)|2001|2025)\b/i.test(question);
}
export const COVERAGE_ANSWER = 'FireTrace has three separate historical views: the Australia Historical Atlas covers 2001–2025 (25 years); the global globe archive covers 2019–2020; and COMMAND replays the Black Summer 2019–2020 study. Sensor availability varies: early Atlas years do not have all sensors. Recent Detections is a separate NASA FIRMS NRT feed whose status must be checked independently. Historical records are not live alerts, unique fires, or burned area; the harmonization bridge remains experimental.';
