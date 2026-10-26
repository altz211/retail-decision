# Retail Decision Lab

An interactive, browser-local retail analytics portfolio by Nafees Khan. Built for GitHub Pages with no API keys, external scripts, package dependencies or backend.

## What works

- Reproducible synthetic UAE retail scenario: 84 days, 3 stores, 6 SKUs.
- Local CSV upload with schema, date, number and duplicate-key validation (5 MB / 30,000 rows maximum).
- Equal-length observed-date period comparisons, contribution metrics, store comparisons and an exact profit bridge.
- Weekday-average and daily-average forecasts, evaluated with rolling one-step historical backtests.
- Budget-constrained replenishment heuristic and CSV action-plan export.
- Automated analytical checks and GitHub Pages deployment.

## Publish

1. Create a public repository called `retail-decision` on GitHub with default branch `main`.
2. Add these files at the repository root, preserving `assets`, `tests`, and `.github/workflows`.
3. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
4. Run **Verify and deploy Pages** from Actions, or push a commit to main.
5. Once deployment succeeds, use the URL shown by the workflow. For account `altz211`, the expected project URL is `https://altz211.github.io/retail-decision/` (not live until deployed).

Alternatively select **Deploy from a branch**, `main` and `/ (root)` in Pages settings. The site needs no build step; `npm test` can be run locally.

## Local checks

Node.js 22 or newer: `npm test`. For local viewing: `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Data contract

Required CSV columns:

`date,store,sku,category,units,unit_price,unit_cost,discount,returns,inventory,lead_days`

One daily row per store/SKU. Supply zero-sales days explicitly and one currency per dataset. `inventory` is end-of-day stock. `discount` is the total currency discount across gross units. `returns` is a count of those units, assuming cost recovery for resalable returns. The currency control only changes labels.

Net revenue = (units − returns) × (unit_price − discount / units), with zero units yielding zero revenue. Contribution = net revenue − (units − returns) × unit_cost. This is not operating or net profit.

## Analytical limitations

Forecasts model observed gross sales, not latent demand. Stockout-censored demand is not corrected. Daily gaps are warned about, not imputed. Period comparisons use equal counts of observed dates; missing entire dates may make calendar spans unequal. Inventory snapshots across series may be stale or unsynchronised. Backtests are one-step historical evaluations; they do not establish multi-day inventory outcomes or business savings.

The exact sequential contribution bridge separates retained volume, effective price/mix and cost/mix. Ordering affects attribution; this is arithmetic, not causal inference. Allocations rank positive-margin products by estimated margin per purchase currency unit; this greedy heuristic has no optimality guarantee. It ignores supplier minimums, pack sizes, transfers, inbound orders and capacity. Buffer days are a user assumption, not a calibrated service level.

## Privacy and hosting

CSV contents are read in the browser, not transmitted by application code. No analytics, accounts, external fonts or persistence are included. GitHub still serves the public site and receives ordinary web requests. Files disappear from application memory when the page closes; do not mistake this prototype for a secure enterprise workspace. Public demo files contain synthetic data only.

GitHub Pages hosts the static interface; JavaScript performs analysis on the visitor's device. GitHub Actions runs checks/deployment, not an interactive Python service. This is a portfolio showcase, not a commercial SaaS deployment.

## AWS / MLOps roadmap (not implemented)

Keep the analytical contract, replace browser baseline models with versioned Python training/inference, store dataset manifests and model lineage, add temporal evaluation gates and approved model promotion, monitor delayed errors and drift, then add authenticated organisation workspaces. Current CI is software CI, not an operational MLOps system.
