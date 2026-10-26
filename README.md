# Retail Decision Lab

Sales, margins and stock planning. Built by Nafees Khan.

[Open the demo](https://altz211.github.io/retail-decision/)

The demo uses 84 days of synthetic sales across three UAE stores. You can also open a CSV, compare store margins, switch forecast methods and export an order plan. Files stay in the browser.

## Run locally

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Run `npm test` with Node 22+ for the analytical checks. No dependencies to install.

## Files

- `assets/dashboard.js` — controls, tables and exports
- `assets/sales.js` — validation, margin calculations, forecasts and ordering
- `assets/dashboard.css` — layout and styles
- `tests/sales.test.js` — calculation checks
- `.github/workflows/deploy.yml` — tests and GitHub Pages deployment

## CSV

```text
date,store,sku,category,units,unit_price,unit_cost,discount,returns,inventory,lead_days
```

One row per day/store/SKU, including zero-sales days. `inventory` is closing stock; `discount` is the total discount on gross units. `returns` counts returned units and assumes resalable stock. Maximum: 5 MB and 30,000 rows.

Use one currency per file. The currency control only changes the label.

## Calculations

Net sales = retained units × discounted unit price. Contribution subtracts product cost and excludes operating expenses. Returns reverse both discounted revenue and product cost.

The margin breakdown reconciles volume, price/mix and cost/mix changes. It is an arithmetic explanation, not causal attribution. Periods use equal numbers of observed dates, which may span unequal calendar windows if dates are missing.

Forecasts use a 28-day daily or weekday average. Rolling one-step backtests use earlier observations only; WAPE is absolute error divided by actual units. Zero denominators show N/A. Sales are a proxy for demand, so stockouts and missing dates affect results.

Order targets cover lead time plus buffer days. A greedy rule allocates the budget by margin per purchase currency unit, then stock cover. It is not a globally optimal policy and omits pack sizes, inbound orders and supplier constraints. Different SKUs may have stock snapshots from different dates. No business savings are claimed.

## Deploy

Push to `main` with Pages set to **GitHub Actions**. The workflow runs tests before publishing.

This is a static portfolio prototype. Analysis runs on the visitor's device; GitHub Actions handles tests and deployment. There is no backend or operational MLOps yet.
