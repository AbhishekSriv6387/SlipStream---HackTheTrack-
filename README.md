# Slipstream: vehicle data marketplace (clickable prototype)

Hack the Track entry. Challenge: **The Telemetry Play**, with **Zero DNF**, **The Two-Second Stop**, **The Second Stint** and **The Blind Corner** shown as apps and data products on the same marketplace.

## Run it

Open the `slipstream` folder and double-click `index.html`. That's it. No install, no build, no server.

- Windows: you can also run `start index.html` in a terminal opened in the folder.
- Works in any current Chrome, Edge, Firefox or Safari.
- Fonts load from Google Fonts. If you are offline, the page falls back to system fonts and everything still works.
- A server is optional. If you want one: `py -m http.server 8000` (Windows) or `python3 -m http.server 8000` (Mac and Linux), then open http://localhost:8000. If Python is not installed, use the "Live Server" extension in VS Code instead.

## The four parties

| Party | Role | Where in the prototype |
|---|---|---|
| Individual customer | Owns the car, chooses what data to share, gets paid, subscribes to apps | Customer app |
| Business | Outside company (insurer, fleet operator, supplier, dealership) that licenses apps | Business portal |
| Developer | Builds apps on anonymised data, sells them to customers and businesses | Developer portal |
| OEM | Runs the marketplace and keeps a cut of every payment | OEM console |

## How the money moves

Every payment goes through one function (`book` in `js/app.js`), so the numbers always agree across screens.

| Payment | Paid by | Split (defaults) |
|---|---|---|
| App subscription | Individual customer | Developer 80%, OEM 20% |
| Business licence | Business | Developer 60%, customers who shared the data 20%, OEM 20% |
| Data fee | Developer | Customers who shared the data 80%, OEM 20% |

The OEM cut is adjustable on the OEM dashboard (10% to 35%). The customer data pool on business licences is set in `js/data.js` (`bizPoolPct`).

Prices: customer apps are ₹149 to ₹599 a month. Business licences are ₹19,999 to ₹39,999 a month, or pay for 10 months and get 12 on annual billing.

## What you are looking at

| Tab | Who it is for | What it shows |
|---|---|---|
| Overview | Everyone | The idea, the live money split, and which challenges are covered |
| Customer app | Vehicle owner | Live car, consent switches, app store, apps in use, wallet and access log |
| Business portal | Outside businesses | Business app catalog, buy a licence, licence dashboards, invoices |
| Developer portal | App builders | Data catalog, API sandbox, publish an app (for customers or businesses), revenue |
| OEM console | The OEM | Revenue dashboard, adjustable cut, app approvals, privacy and audit, ledger |

## Suggested 20-minute pitch flow

Press **Guided demo** (top right). Each step has a button that performs the action for you, so nothing can go wrong live.

1. **The idea** (1 min). Cars stream data nobody pays customers for.
2. **Customer consents** (2 min). Turn on signals, watch the earnings estimate.
3. **Customer gets paid** (2 min). Fast-forward a month, show the access log.
4. **Developer finds data and tests the API** (3 min). Show the privacy table.
5. **Developer publishes, OEM approves** (2 min). Show the policy checks.
6. **Customer subscribes** (2 min). Show where the money goes.
7. **App uses the data** (2 min). PitCrew Predict warns, books a repair, creates the shared job card.
8. **A business licenses an app** (2 min). Part Pulse for suppliers, three-way split.
9. **OEM earns on every payment** (2 min). Drag the cut slider.
10. Q&A (10 min).

## How it maps to the judging criteria

- **Client impact and problem fit:** a recurring-revenue service built only from data the OEM already collects, with a privacy model that lets OEM, dealer and developers share value without exposing raw data (the exact brief of The Telemetry Play). Business licences add a second, larger revenue stream.
- **Technical feasibility and scalability:** consent is checked on every API call, data is anonymised before developers see it, and one settlement function calculates every split.
- **Innovation and differentiation:** an app-store model for vehicle data where the customer is paid, businesses can buy too, and apps cover four other challenges.
- **Prototype and evidence:** every flow is clickable and consistent across all four parties.
- **Pitch clarity:** guided demo with one-click actions.

## What is real and what is simulated

Real logic in the browser: consent switches, access checks on the API, approval rules, price ranges, the revenue split and the OEM cut.
Simulated: vehicle telemetry, the other 12,480 vehicles, other developers and businesses, payments, invoices and UPI payouts.

## Customise it

All content lives in `js/data.js`: vehicle name, signals, earning rates, apps, prices, business licences, monthly history and dealers. Change them and reload.

## Files

```
index.html       page shell
css/styles.css   styles
js/data.js       seed data and catalog
js/app.js        state, simulation, all screens, guided demo
```
