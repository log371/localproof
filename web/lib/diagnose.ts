export type Difference = {
  path: string;
  kind: "missing" | "extra" | "type" | "value";
  expected: unknown;
  actual: unknown;
};

function kind(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

export function diagnose(expected: unknown, actual: unknown): Difference[] {
  const differences: Difference[] = [];
  let visited = 0;
  function visit(a: unknown, b: unknown, path: string, depth: number) {
    if (++visited > 10000 || depth > 20)
      throw new Error(
        "JSON trop complexe : 10 000 nœuds et 20 niveaux maximum.",
      );
    if (kind(a) !== kind(b)) {
      differences.push({ path, kind: "type", expected: a, actual: b });
      return;
    }
    if (
      a !== null &&
      typeof a === "object" &&
      b !== null &&
      typeof b === "object"
    ) {
      const left = a as Record<string, unknown>,
        right = b as Record<string, unknown>;
      for (const key of Object.keys(left)) {
        const pointer = `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
        if (!Object.hasOwn(right, key))
          differences.push({
            path: pointer,
            kind: "missing",
            expected: left[key],
            actual: undefined,
          });
        else visit(left[key], right[key], pointer, depth + 1);
      }
      for (const key of Object.keys(right))
        if (!Object.hasOwn(left, key))
          differences.push({
            path: `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
            kind: "extra",
            expected: undefined,
            actual: right[key],
          });
    } else if (a !== b)
      differences.push({
        path: path || "/",
        kind: "value",
        expected: a,
        actual: b,
      });
  }
  visit(expected, actual, "", 0);
  return differences;
}

export function printable(value: unknown) {
  return value === undefined ? "(absent)" : JSON.stringify(value);
}
