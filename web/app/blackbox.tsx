"use client";
import { useState } from "react";
import { diagnose, printable, type Difference } from "../lib/diagnose";

const examples = {
  zero: {
    name: "Le zéro disparu",
    expected: { event: "E-105", minutes: 0, approved: false },
    actual: { event: "E-105", minutes: null, approved: "false" },
  },
  invention: {
    name: "Le champ inventé",
    expected: { source: "maintenance", owner: null },
    actual: { source: "maintenance", owner: "Julien", confidence: 0.99 },
  },
  schema: {
    name: "La structure cassée",
    expected: { items: [{ id: 1, amount: 42 }], currency: "EUR" },
    actual: { items: { id: "1", amount: "42€" } },
  },
};
const descriptions = {
  missing: "Champ manquant",
  extra: "Champ inattendu",
  type: "Type modifié",
  value: "Valeur différente",
};

export function Blackbox() {
  const [expected, setExpected] = useState(
    JSON.stringify(examples.zero.expected, null, 2),
  );
  const [actual, setActual] = useState(
    JSON.stringify(examples.zero.actual, null, 2),
  );
  const [report, setReport] = useState<Difference[] | null>(null);
  const [error, setError] = useState("");

  function inspect() {
    setError("");
    setReport(null);
    try {
      if (expected.length + actual.length > 80000)
        throw new Error("Entrée limitée à 80 000 caractères.");
      setReport(diagnose(JSON.parse(expected), JSON.parse(actual)));
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "JSON invalide. Collez des objets JSON bruts, sans balises Markdown."
          : (e as Error).message,
      );
    }
  }

  function exportDiagnosis() {
    if (!report) return;
    const text = [
      "# LocalProof — Diagnostic de contrat JSON",
      "",
      "Comparaison déterministe, locale au navigateur. Ce n’est pas un jugement sémantique par IA.",
      "",
      ...report.map(
        (d) =>
          `- ${d.path} : ${descriptions[d.kind]} | attendu ${printable(d.expected)} | reçu ${printable(d.actual)}`,
      ),
      "",
      "## Attendu",
      "```json",
      expected,
      "```",
      "",
      "## Observé",
      "```json",
      actual,
      "```",
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "localproof-diagnostic.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="blackbox" id="blackbox">
      <div className="section-title">
        <div>
          <p className="eyebrow">OUTIL DIRECT · SANS COMPTE · SANS MODÈLE</p>
          <h2>
            Le JSON a l’air bon.
            <br />
            <span className="coral">Votre pipeline n’est pas d’accord.</span>
          </h2>
        </div>
        <span className="terminal-icon" aria-hidden="true">
          {"{ ≠ }"}
        </span>
      </div>
      <p className="muted">
        Collez une sortie attendue et celle de votre IA. Trouvez les champs
        inventés, les types cassés et les zéros devenus null. Tout est comparé
        dans votre navigateur.
      </p>
      <div className="filters">
        {Object.entries(examples).map(([key, example]) => (
          <button
            key={key}
            onClick={() => {
              setExpected(JSON.stringify(example.expected, null, 2));
              setActual(JSON.stringify(example.actual, null, 2));
              setReport(null);
              setError("");
            }}
          >
            {example.name}
          </button>
        ))}
      </div>
      <div className="json-grid">
        <label>
          CONTRAT ATTENDU
          <textarea
            aria-label="JSON attendu"
            spellCheck={false}
            maxLength={40000}
            value={expected}
            onChange={(e) => {
              setExpected(e.target.value);
              setReport(null);
            }}
          />
        </label>
        <label>
          SORTIE OBSERVÉE
          <textarea
            aria-label="JSON observé"
            spellCheck={false}
            maxLength={40000}
            value={actual}
            onChange={(e) => {
              setActual(e.target.value);
              setReport(null);
            }}
          />
        </label>
      </div>
      <div className="diagnostic-actions">
        <button onClick={inspect}>Trouver ce qui casse ↗</button>
        <span>Comparaison exacte · pas d’appel LLM</span>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {report && (
        <div className="diagnosis" aria-live="polite">
          <div className="section-title">
            <h3>
              {report.length
                ? `${report.length} rupture${report.length > 1 ? "s" : ""} de contrat`
                : "Contrat respecté"}
            </h3>
            <button className="secondary" onClick={exportDiagnosis}>
              Exporter le diagnostic
            </button>
          </div>
          {report.length === 0 && (
            <p>
              Les valeurs et les types correspondent exactement. Cela ne prouve
              pas leur véracité métier.
            </p>
          )}
          {report.map((d, i) => (
            <article key={i} className="difference">
              <span>{descriptions[d.kind]}</span>
              <code>{d.path}</code>
              <div>
                <small>ATTENDU</small>
                <pre>{printable(d.expected)}</pre>
              </div>
              <div>
                <small>OBSERVÉ</small>
                <pre>{printable(d.actual)}</pre>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
