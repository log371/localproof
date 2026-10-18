import { z } from "zod";

const resultSchema = z.object({
  id: z.string().max(150),
  suite: z.enum(["rag", "extraction", "policy"]),
  passed: z.boolean(),
  checks: z.record(z.string(), z.boolean()),
  output: z.unknown(),
  expected: z.unknown().optional(),
  latency_ms: z.number().finite().nonnegative(),
  error: z.string().optional(),
  sources: z
    .array(z.object({ id: z.string(), text: z.string() }))
    .max(10)
    .optional(),
});
export const reportSchema = z
  .object({
    schema_version: z.literal(1),
    id: z.string().max(150),
    created: z.string(),
    status: z.enum(["queued", "running", "completed", "failed"]),
    suite_hash: z.string(),
    synthetic: z.boolean(),
    config: z
      .object({
        model: z.string().max(120),
        provider: z.enum(["mock", "ollama"]),
      })
      .passthrough(),
    runtime: z.record(z.string(), z.unknown()).optional(),
    results: z.array(resultSchema).max(1000),
  })
  .passthrough()
  .superRefine((report, ctx) => {
    if (new Set(report.results.map((r) => r.id)).size !== report.results.length)
      ctx.addIssue({
        code: "custom",
        message: "Identifiants de cas dupliqués",
      });
  });
export type Report = z.infer<typeof reportSchema>;

export function comparison(a: Report, b: Report) {
  if (a.status !== "completed" || b.status !== "completed")
    return { error: "Attendez la fin des deux exécutions.", regressions: [] };
  if (a.suite_hash !== b.suite_hash || a.synthetic !== b.synthetic)
    return {
      error: "Comparaison refusée : suites ou provenances différentes.",
      regressions: [],
    };
  const before = new Map(a.results.map((r) => [r.id, r]));
  if (
    before.size !== b.results.length ||
    b.results.some((r) => !before.has(r.id))
  )
    return {
      error: "Comparaison refusée : jeux de cas différents.",
      regressions: [],
    };
  return {
    error: null,
    regressions: b.results
      .filter((r) => before.get(r.id)?.passed && !r.passed)
      .map((r) => r.id),
  };
}

const names = [
  "rag-maintenance",
  "rag-retention",
  "rag-unknown",
  "extract-event",
  "extract-zero",
  "extract-missing",
  "policy-allowed",
  "policy-shell",
  "policy-path",
  "policy-injection",
];
export const demoReports: Report[] = [false, true].map((regression) => ({
  schema_version: 1,
  id: regression ? "demo-candidate" : "demo-baseline",
  created: "2026-10-19T09:00:00Z",
  status: "completed",
  suite_hash: "illustrative-demo-v1-not-a-real-benchmark",
  synthetic: true,
  config: {
    provider: "mock",
    model: regression ? "demo-regression" : "demo-reference",
  },
  results: names.map((id, i) => {
    const failed = regression && [2, 4, 7].includes(i);
    return {
      id,
      suite: i < 3 ? "rag" : i < 6 ? "extraction" : "policy",
      passed: !failed,
      checks: { fixture_illustrative: !failed },
      latency_ms: 0,
      output: failed
        ? { unexpected: "Échec injecté pour illustrer une régression" }
        : {
            note: "Résultat illustratif — exécutez le runner pour obtenir les sorties détaillées",
          },
    };
  }),
}));
