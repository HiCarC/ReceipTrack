# Test Plan: Core and Non-Core Functions

## Scope and ranking

Core functions are defined as user-facing flows that can cause data loss, incorrect balances, or misreported totals.
Non-core functions are UI/UX enhancements and auxiliary features where failure does not corrupt data.

### Core functions (ranked by criticality)
1) Receipts CRUD + currency conversion + base totals
   - Create/edit/delete receipts, sync totals in base currency, correct FX conversion.
2) Group balances + settlements
   - Split logic, reimbursements, settlement netting, balance consistency (sum to zero).
3) Analytics totals and reports
   - Monthly totals, category totals, top merchants, delta vs prior period.
4) Settings persistence
   - Base currency, appearance, preferences saved and applied on reload.
5) Auth profile sync
   - Display name and avatar consistency across app.

### Non-core functions (ranked by criticality)
1) Map/location insights
2) Export flows (CSV/XLSX/PDF)
3) OCR/camera UX
4) Help center and privacy UI
5) UI polish and animations

## Strategy and scale

- Core: unit tests for pure logic and hooks, plus integration tests for critical workflows.
- Non-core: smoke tests with focused unit coverage.
- Stress tests: validate performance and data correctness for large receipt lists and many group expenses.

## Core test coverage goals

- Receipts conversion: 90% for currency conversion and total calculations.
- Group balances: 90% for normalization/rounding and key resolution.
- Analytics: 85% for totals and report generation.
- Settings: 80% for persistence and reload behaviors.

## Non-core test coverage goals

- Map insights: 60% of core data transforms.
- Exports: 60% of data preparation utilities.
- OCR/camera UI: 50% for core state transitions.

## Stress test scenarios

- 2,000 receipts across multiple currencies, verify current month base total matches sum of converted values.
- 50 participants group, 1,000 expenses, ensure balances sum to zero and reimbursements do not double count.
- Rapid base currency toggles, ensure cached conversion invalidation and totals recalc.

## Execution order

1) Core unit tests (currency conversion, receipt totals, group balance normalization).
2) Core integration tests (receipt list totals, analytics report).
3) Non-core tests (map insights, exports).
4) Stress tests.
