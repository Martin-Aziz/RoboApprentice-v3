/**
 * generateVoiceoverScript.js
 *
 * Generates a complete, time-annotated voiceover script for a product demo video.
 * Narration style: Apple / Stripe — confident, specific, no buzzwords.
 *
 * Words-per-minute baseline: 150 wpm (natural narrator pacing with pauses)
 * Duration formula: (word_count / 150) * 60 * 1000  ms, then rounded to nearest 100ms
 */

/**
 * Estimate spoken duration in milliseconds.
 * Accounts for natural pauses after commas and periods.
 *
 * @param {string} text
 * @param {number} wpm  - words per minute (default 150 for demo narration)
 * @returns {number}    - milliseconds
 */
function estimateDuration(text, wpm = 150) {
  const words = text.trim().split(/\s+/).length;
  const baseDuration = (words / wpm) * 60 * 1000;

  // Add 300ms per sentence-ending punctuation (period, exclamion, question)
  const sentencePauses = (text.match(/[.!?]/g) || []).length * 300;

  // Add 100ms per comma
  const commaPauses = (text.match(/,/g) || []).length * 100;

  const total = baseDuration + sentencePauses + commaPauses;
  return Math.round(total / 100) * 100; // round to nearest 100ms
}

/**
 * Generate a complete voiceover script for a product demo video.
 *
 * @param {string}   appName   - Product name, e.g. "FinFlow"
 * @param {Array}    useCases  - Array of use case objects:
 *   {
 *     id:          string,   e.g. "uc1"
 *     title:       string,   e.g. "AP Reconciliation"
 *     painPoint:   string,   short description of the problem
 *     action:      string,   what the product does in this demo
 *     outcome:     string,   what the user gains
 *     boardLabel:  string,   label for the board/dashboard view
 *   }
 * @returns {object}  Complete script object with text + duration estimates
 */
function generateVoiceoverScript(appName, useCases) {
  // ── INTRO ──────────────────────────────────────────────────────────────────
  const introText =
    `${appName} gives finance teams a single place to close the books, ` +
    `stay compliant, and see exactly where cash is going. ` +
    `Here is what that looks like in practice.`;

  // ── USE CASES ──────────────────────────────────────────────────────────────
  const scriptUseCases = useCases.map((uc) => {
    const titleCardText = uc.title;

    const beforePainText =
      `Every finance team knows this moment — ` +
      `${uc.painPoint}. ` +
      `The manual work adds up, and small errors compound into real risk.`;

    const executionText =
      `With ${appName}, ${uc.action}. ` +
      `The system flags every discrepancy in real time, ` +
      `so the team works through exceptions instead of hunting for them.`;

    const resultText =
      `The result: ${uc.outcome}. ` +
      `What used to take days now takes minutes.`;

    const boardText =
      `The ${uc.boardLabel} gives a live view of every item, ` +
      `status, and owner.`;

    return {
      id: uc.id,
      titleCard: {
        text: titleCardText,
        duration_ms: 4200,
      },
      beforePain: {
        text: beforePainText,
        duration_ms: estimateDuration(beforePainText),
      },
      execution: {
        text: executionText,
        duration_ms: estimateDuration(executionText),
      },
      result: {
        text: resultText,
        duration_ms: estimateDuration(resultText),
      },
      board: {
        text: boardText,
        duration_ms: estimateDuration(boardText),
      },
    };
  });

  // ── OUTRO ──────────────────────────────────────────────────────────────────
  const outroText =
    `${appName} does not just organize your financial data — ` +
    `it makes it actionable. ` +
    `Reconciliation that used to take your team two days closes in under thirty minutes. ` +
    `Payroll audits that required three people now run with one. ` +
    `And your cash position updates the moment a transaction lands. ` +
    `This is what modern finance operations looks like. ` +
    `${appName} — built for teams that move fast and cannot afford mistakes.`;

  return {
    intro: {
      text: introText,
      duration_estimate_ms: estimateDuration(introText),
    },
    useCases: scriptUseCases,
    outro: {
      text: outroText,
      duration_ms: estimateDuration(outroText),
    },
  };
}

// ── COMPLETE EXAMPLE: FinFlow ────────────────────────────────────────────────

const finflowScript = generateVoiceoverScript("FinFlow", [
  {
    id: "uc1",
    title: "AP Reconciliation",
    painPoint:
      "invoices sit in a shared inbox, matched against statements by hand, " +
      "line by line across three different spreadsheets",
    action:
      "invoices are ingested automatically, matched against purchase orders " +
      "and bank statements using rule-based matching with ML fallback",
    outcome:
      "your AP team reconciles a full month of vendor invoices in twenty-eight minutes, " +
      "with a full audit trail attached to every line",
    boardLabel: "AP Reconciliation board",
  },
  {
    id: "uc2",
    title: "Payroll Compliance Audit",
    painPoint:
      "payroll data lives in four systems, none of which talk to each other, " +
      "and your compliance team rebuilds the source of truth from scratch every quarter",
    action:
      "FinFlow pulls payroll runs, contractor payments, and tax withholdings " +
      "into a unified ledger, cross-referenced against current regulatory thresholds " +
      "for every jurisdiction you operate in",
    outcome:
      "compliance gaps surface before the audit, not during it — " +
      "giving your team time to act, not react",
    boardLabel: "Compliance Audit board",
  },
  {
    id: "uc3",
    title: "Cash Flow Forecasting",
    painPoint:
      "your cash forecast is a spreadsheet that is already out of date " +
      "the moment someone sends it, built on assumptions that shift week to week",
    action:
      "FinFlow pulls actuals from your bank feeds, ARR from your billing system, " +
      "and committed spend from your ERP, then models forward thirteen weeks " +
      "using your real payment terms",
    outcome:
      "your CFO sees the exact week cash goes below the operating buffer, " +
      "three months before it happens — with the scenarios to act on it",
    boardLabel: "Cash Flow Forecast board",
  },
]);

// Print the complete script
console.log(JSON.stringify(finflowScript, null, 2));

// Also export for use as a module
module.exports = { generateVoiceoverScript, estimateDuration };
