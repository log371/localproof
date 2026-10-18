"use client";

import { useEffect, useState } from "react";
import {
  comparison,
  demoReports,
  reportSchema,
  type Report,
} from "../lib/report";
import { Blackbox } from "./blackbox";

const labels = {
  rag: "RAG & citations",
  extraction: "Extraction structurée",
  policy: "Permissions & injections",
};

export default function Page() {
  const [reports, setReports] = useState<Report[]>(demoReports);
  const [baseline, setBaseline] = useState(demoReports[0].id);
  const [candidate, setCandidate] = useState(demoReports[1].id);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState("rag-unknown");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const a = reports.find((r) => r.id === baseline) ?? reports[0];
  const b = reports.find((r) => r.id === candidate) ?? reports[1];
  const diff = comparison(a, b);
  const rows = b.results.filter(
    (r) =>
      filter === "all" ||
      (filter === "failed" ? !r.passed : r.suite === filter),
  );
  const detail = b.results.find((r) => r.id === selected);
  const passed = b.results.filter((r) => r.passed).length;

  function addReports(incoming: Report[]) {
    setReports((previous) => [
      ...previous.filter((r) => !incoming.some((n) => n.id === r.id)),
      ...incoming,
    ]);
    if (incoming.length) {
      setCandidate(incoming[0].id);
      setSelected(incoming[0].results[0]?.id ?? "");
    }
  }

  async function importReport(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 2_000_000) throw new Error("Rapport limité à 2 Mo.");
      const report = reportSchema.parse(JSON.parse(await file.text()));
      addReports([report]);
    } catch {
      setError(
        "Import refusé : JSON invalide, format incompatible ou fichier supérieur à 2 Mo.",
      );
    }
  }

  async function localRequest(create: boolean) {
    setBusy(true);
    setError("");
    try {
      // Same-origin only. There is no lab address in the public deployment.
      if (!["localhost", "127.0.0.1"].includes(window.location.hostname))
        throw new Error(
          "Cette commande est réservée à l’installation locale Docker.",
        );
      const response = await fetch("/api/runs", {
        method: create ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(create
          ? { body: JSON.stringify({ provider: "ollama", model }) }
          : {}),
      });
      if (!response.ok)
        throw new Error(
          `API locale : ${response.status}. Vérifiez le jeton et la stack Docker.`,
        );
      const data = await response.json();
      addReports(
        (create ? [data] : data).map((r: unknown) => reportSchema.parse(r)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "localproof-report.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="LocalProof accueil">
          <span className="mark">
            L<span>↗</span>
          </span>{" "}
          LocalProof<span className="version">0.1</span>
        </a>
        <p className="nav-caption">WORKSPACE / LOCAL-FIRST</p>
        <a className="nav active" href="#bench">
          ◉ &nbsp; Banc d’essai
        </a>
        <a className="nav" href="#blackbox">
          ⌘ &nbsp; Crash-test JSON
        </a>
        <a className="nav" href="#method">
          ▤ &nbsp; Méthodologie
        </a>
        <a className="nav" href="https://github.com/log371/localproof">
          ↗ &nbsp; Code source
        </a>
        <div className="side-bottom">
          <span className="dot" /> Aucune télémétrie applicative
          <p>
            Vos rapports restent dans ce navigateur. Aucun envoi par
            l’application.
          </p>
          <small>L’hébergeur peut journaliser les accès au site.</small>
        </div>
      </aside>
      <main id="bench">
        <header>
          <span>LAB / ÉVALUATIONS</span>
          <span className="badge">OPEN SOURCE · MIT</span>
        </header>
        <section className="hero">
          <div>
            <p className="eyebrow">MESURER. COMPARER. COMPRENDRE.</p>
            <h1>
              Des preuves,
              <br />
              <span>pas des promesses.</span>
            </h1>
            <p className="intro">
              Votre IA change. Sachez ce qui s’améliore,
              <br className="desktop" /> ce qui régresse et ce qui reste à
              vérifier.
            </p>
          </div>
          <div className="hero-note">
            <span>01 — LE PRINCIPE</span>
            <p>
              Un modèle.
              <br />
              Un protocole.
              <br />
              <strong>Des résultats inspectables.</strong>
            </p>
          </div>
        </section>
        <div className="notice">
          <span>ⓘ</span>
          <p>
            <strong>
              {b.synthetic ? "Données simulées" : "Rapport importé / local"}
            </strong>{" "}
            —{" "}
            {b.synthetic
              ? "Cette démonstration illustre trois régressions volontaires. Elle ne mesure aucun modèle réel."
              : "Provenance déclarée dans le rapport, non certifiée. Inspectez les paramètres et les limites."}
          </p>
        </div>
        <Blackbox />
        <section className="toolbar" aria-label="Sélection des exécutions">
          <label>
            RÉFÉRENCE
            <select value={a.id} onChange={(e) => setBaseline(e.target.value)}>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.config.model} · {r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <span className="arrow">→</span>
          <label>
            CANDIDAT
            <select value={b.id} onChange={(e) => setCandidate(e.target.value)}>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.config.model} · {r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="button secondary">
            Importer JSON
            <input
              disabled={!ready}
              aria-label="Importer un rapport JSON"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                void importReport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button onClick={download}>Exporter ↗</button>
        </section>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {diff.error && (
          <p role="alert" className="error">
            {diff.error}
          </p>
        )}
        <section className="stats" aria-label="Résumé">
          <article>
            <p>CAS RÉUSSIS</p>
            <strong>
              {passed}
              <small> / {b.results.length}</small>
            </strong>
            <span>Sur ce jeu d’essai uniquement</span>
          </article>
          <article>
            <p>RÉGRESSIONS</p>
            <strong className="coral">
              {diff.error
                ? "—"
                : diff.regressions.length.toString().padStart(2, "0")}
            </strong>
            <span>Par rapport à la référence</span>
          </article>
          <article>
            <p>PROVENANCE</p>
            <strong className="text-stat">
              {b.synthetic ? "Simulée" : "Déclarée"}
            </strong>
            <span>
              {b.config.provider} · {b.status}
            </span>
          </article>
        </section>
        <section className="results">
          <div className="section-title">
            <h2>Le détail fait la différence.</h2>
            <span>{b.results.length} CAS / 3 SUITES</span>
          </div>
          <div className="filters" aria-label="Filtrer les cas">
            {[
              ["all", "Tous les cas"],
              ["failed", "Échecs"],
              ["rag", "RAG"],
              ["extraction", "Extraction"],
              ["policy", "Permissions"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "chosen" : ""}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="result-grid">
            <div className="case-list">
              {rows.length === 0 ? (
                <p className="empty">Aucun cas dans ce filtre.</p>
              ) : (
                rows.map((r) => (
                  <button
                    key={r.id}
                    className={`case ${selected === r.id ? "selected" : ""}`}
                    onClick={() => setSelected(r.id)}
                  >
                    <span className={r.passed ? "ok" : "fail"}>
                      {r.passed ? "✓" : "!"}
                    </span>
                    <span>
                      <strong>{r.id}</strong>
                      <small>{labels[r.suite]}</small>
                    </span>
                    <span className="case-state">
                      {r.passed ? "Réussi" : "Échec"}
                    </span>
                  </button>
                ))
              )}
            </div>
            <article className="inspector">
              {detail ? (
                <>
                  <p className="eyebrow">INSPECTEUR DE PREUVES</p>
                  <h3>{detail.id}</h3>
                  <p className="muted">
                    {b.synthetic
                      ? "Sortie simulée · aucune inférence"
                      : `${detail.latency_ms} ms · temps client, chargement éventuel inclus`}
                  </p>
                  <h4>Sortie observée</h4>
                  <pre>{JSON.stringify(detail.output, null, 2)}</pre>
                  <h4>Contrôles</h4>
                  {Object.entries(detail.checks).map(([key, value]) => (
                    <div className="check" key={key}>
                      <span>{key}</span>
                      <span className={value ? "ok" : "coral"}>
                        {value ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  ))}
                  {detail.error && <p className="error">{detail.error}</p>}
                  {detail.expected !== undefined && (
                    <>
                      <h4>Valeur attendue</h4>
                      <pre>{JSON.stringify(detail.expected, null, 2)}</pre>
                    </>
                  )}
                  {detail.sources?.map((s) => (
                    <blockquote key={s.id}>
                      <strong>{s.id}</strong>
                      <p>{s.text}</p>
                    </blockquote>
                  ))}
                </>
              ) : (
                <p>Sélectionnez un cas terminé pour inspecter ses résultats.</p>
              )}
            </article>
          </div>
        </section>
        <details className="local">
          <summary>Connecter mon installation locale</summary>
          <p>
            Disponible avec Docker Compose sur localhost. Le jeton reste en
            mémoire et n’est pas conservé après rechargement. Aucun appel depuis
            la démo publique.
          </p>
          <div className="local-fields">
            <label>
              Jeton API
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              Modèle Ollama installé
              <input
                placeholder="nom exact:tag"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </label>
            <button
              disabled={busy || !token}
              onClick={() => void localRequest(false)}
            >
              Actualiser
            </button>
            <button
              disabled={busy || !token || !model}
              onClick={() => void localRequest(true)}
            >
              Lancer l’évaluation
            </button>
          </div>
          <p>
            Le worker traite la file. Cliquez sur Actualiser pour suivre
            l’exécution.
          </p>
        </details>
        <section id="method" className="method">
          <p className="eyebrow">LES LIMITES FONT PARTIE DU RÉSULTAT</p>
          <h2>Un test réussi n’est pas une garantie.</h2>
          <p>
            Le protocole v0.1 utilise dix cas fictifs, une recherche lexicale et
            une comparaison exacte des champs. Il ne certifie ni la sécurité, ni
            la véracité générale d’un modèle. Les actions sont simulées : aucun
            outil n’est exécuté. Pas de mesure RAM/GPU dans cette version.
          </p>
          <a href="https://github.com/log371/localproof/blob/main/docs/methodology.md">
            Lire le protocole complet ↗
          </a>
        </section>
        <footer>
          <strong>LocalProof</strong>
          <span>Construit pour être vérifié. Pas simplement présenté.</span>
          <a href="https://github.com/log371/localproof">GitHub ↗</a>
        </footer>
      </main>
    </div>
  );
}
