const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const math = require("../public/household-math.js");

const demo = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "household.json"), "utf8"));

test("fixed decimal rates and money survive legacy floating-point values", () => {
  assert.equal(math.fixedDecimal(19.989999771118164), "19.99");
  assert.equal(math.fixedDecimal("19.99"), "19.99");
  assert.equal(math.isNonNegativeDecimal("19.99", 2), true);
  assert.equal(math.isNonNegativeDecimal("19.989", 2), false);
  assert.equal(math.toBasisPoints("19.99"), 1999);
  assert.equal(math.toCents("96.42"), 9642);
});

test("paycheck allocations preserve every cent across the five budget shares", () => {
  const shares = [5500, 500, 1000, 1500, 1500];
  const allocated = math.allocateBasisPointCents(100001, shares);
  assert.deepEqual(allocated, [55001, 5000, 10000, 15000, 15000]);
  assert.equal(allocated.reduce((sum, cents) => sum + cents, 0), 100001);
  assert.deepEqual(math.allocateBasisPointCents(1, shares), [1, 0, 0, 0, 0]);
  assert.throws(() => math.allocateBasisPointCents(100, [5500, 500, 1000, 1500, 1499]), /totaling 10000/);
});

test("category plan maps title-cased ledger categories to their intended budget groups", () => {
  assert.equal(math.budgetCategoryFor("Groceries", "Metro Grocery", "Essentials"), "Food — Needs");
  assert.equal(math.budgetCategoryFor("Groceries", "Metro Grocery", "Wants"), "Food — Wants");
  assert.equal(math.budgetCategoryFor("Dining", "Coffee Culture", "Wants"), "Food — Wants");
  assert.equal(math.budgetCategoryFor("Housing & Utilities", "November rent", "Essentials"), "Housing");
  assert.equal(math.budgetCategoryFor("Housing & Utilities", "Home internet", "Essentials"), "Utilities");
  assert.equal(math.budgetCategoryFor("Debt repayment", "Visa payment"), "Debt Repayment");
  assert.equal(math.budgetCategoryFor("Investment contribution", "Monthly TFSA contribution"), "Savings & Investments");
});

test("demo Visa rate and minimum payment are exact", () => {
  const visa = demo.accounts.find((account) => account.id === "visa-j");
  const vehicle = demo.accounts.find((account) => account.id === "car-a");
  assert.equal(visa.apr, "19.99");
  assert.equal(math.fixedDecimal(visa.apr), "19.99");
  assert.equal(math.toCents(visa.minimumPayment) + math.toCents(vehicle.monthlyPayment), 42000);
});

for (const view of ["Combined Household", "Partner A Only", "Partner B Only"]) {
  test(`${view} income, expense categories, and net reconcile to the cent`, () => {
    const result = math.calculateLedger(demo, view, 50);
    const categoryTotal = Object.values(result.expensesByCategoryCents).reduce((sum, value) => sum + value, 0);
    assert.equal(categoryTotal, result.expenseCents);
    assert.equal(result.netCents, result.incomeCents - result.expenseCents);
    assert.deepEqual(result.splitMismatches, []);
  });

  test(`${view} owner and debt breakdowns reconcile to balance-sheet totals`, () => {
    const accounts = demo.accounts.map((account) => ({
      ...account,
      shownBalanceCents: math.shareCents(math.centsFor(account, "balance"), account.owner, view, 50)
    }));
    const assets = accounts.filter((account) => account.kind !== "liability")
      .reduce((sum, account) => sum + account.shownBalanceCents, 0);
    const liabilities = accounts.filter((account) => account.kind === "liability")
      .reduce((sum, account) => sum + account.shownBalanceCents, 0);
    const ownerAssets = ["Partner A", "Partner B", "Joint"].map((owner) =>
      accounts.filter((account) => account.owner === owner && account.kind !== "liability")
        .reduce((sum, account) => sum + account.shownBalanceCents, 0));
    const ownerLiabilities = ["Partner A", "Partner B", "Joint"].map((owner) =>
      accounts.filter((account) => account.owner === owner && account.kind === "liability")
        .reduce((sum, account) => sum + account.shownBalanceCents, 0));
    const debtMinimums = accounts.filter((account) => account.kind === "liability")
      .reduce((sum, account) => {
        const key = account.minimumPayment !== undefined ? "minimumPayment" : "monthlyPayment";
        return sum + math.shareCents(math.centsFor(account, key), account.owner, view, 50);
      }, 0);
    assert.equal(ownerAssets.reduce((sum, value) => sum + value, 0), assets);
    assert.equal(ownerLiabilities.reduce((sum, value) => sum + value, 0), liabilities);
    assert.equal(assets - liabilities, math.toCents((assets - liabilities) / 100));
    assert.equal(debtMinimums, math.shareCents(3500, "Joint", view, 50) +
      math.shareCents(38500, "Partner A", view, 50));
  });
}

test("Metro Grocery $96.42 is included in the Partner B and household expense totals", () => {
  const household = math.calculateLedger(demo, "Combined Household", 50);
  const partnerB = math.calculateLedger(demo, "Partner B Only", 50);
  const withoutMetro = math.calculateLedger({
    ...demo,
    transactions: demo.transactions.filter((transaction) => transaction.id !== "t5")
  }, "Partner B Only", 50);
  assert.equal(household.expensesByCategoryCents.Groceries, 24642);
  assert.equal(partnerB.expensesByCategoryCents.Groceries, 17142);
  assert.equal(partnerB.expenseCents - withoutMetro.expenseCents, 9642);
});

test("joint split rounding keeps personal-view categories equal to the transaction total", () => {
  const state = {
    transactions: [{
      id: "joint-penny-split",
      status: "Actual",
      type: "expense",
      owner: "Joint",
      amount: 0.02,
      splits: [{ category: "Groceries", amount: 0.01 }, { category: "Household", amount: 0.01 }]
    }]
  };
  const partnerA = math.calculateLedger(state, "Partner A Only", 50);
  assert.equal(partnerA.expenseCents, 1);
  assert.equal(Object.values(partnerA.expensesByCategoryCents).reduce((sum, value) => sum + value, 0), 1);
});

test("Partner A and Partner B category spending shares add exactly to Combined Household", () => {
  const combined = math.calculateLedger(demo, "Combined Household", 50);
  const partnerA = math.calculateLedger(demo, "Partner A Only", 50);
  const partnerB = math.calculateLedger(demo, "Partner B Only", 50);
  const categories = new Set([
    ...Object.keys(combined.expensesByCategoryCents),
    ...Object.keys(partnerA.expensesByCategoryCents),
    ...Object.keys(partnerB.expensesByCategoryCents)
  ]);
  for (const category of categories) {
    assert.equal(
      (partnerA.expensesByCategoryCents[category] || 0) + (partnerB.expensesByCategoryCents[category] || 0),
      combined.expensesByCategoryCents[category] || 0,
      `${category} personal shares must reconcile`
    );
  }
  const essentials = (result) => ["Groceries", "Housing & Utilities", "Transit & Fuel", "Childcare", "Medical"]
    .reduce((total, category) => total + (result.expensesByCategoryCents[category] || 0), 0);
  assert.deepEqual([essentials(combined), essentials(partnerA), essentials(partnerB)], [309593, 153584, 156009]);
  assert.deepEqual([
    combined.expenseCents - essentials(combined),
    partnerA.expenseCents - essentials(partnerA),
    partnerB.expenseCents - essentials(partnerB)
  ], [3379, 950, 2429]);
  assert.deepEqual([partnerA.expenseCents, partnerB.expenseCents, combined.expenseCents], [154534, 158438, 312972]);
  assert.equal(partnerA.expenseCents + partnerB.expenseCents, combined.expenseCents);
});

test("amount sorting uses signed income and spending values", () => {
  const ascending = math.sortTransactionsBySignedAmount(demo.transactions, "asc");
  const descending = math.sortTransactionsBySignedAmount(demo.transactions, "desc");
  const values = (items) => items.map((item) => math.signedTransactionCents(item));
  assert.equal(ascending.length, 16);
  assert.deepEqual(values(ascending), [
    -225000, -32000, -15000, -11835, -9642, -8900, -7216, -1899, -1480,
    25000, 38500, 42000, 50000, 60000, 310000, 384000
  ]);
  assert.ok(values(ascending).every((value, index, list) => index === 0 || list[index - 1] < value));
  assert.deepEqual(values(descending), [...values(ascending)].reverse());
});

test("monthly plan targets and month-end projections reconcile to their rows", () => {
  const plan = math.calculateBudgetPlan(demo.budget, 1452000, {
    Essentials: 309593,
    "Fun / Wants": 3379,
    "Debt Payoff": 80500,
    "General Savings": 25000,
    "Investments / Wealth": 50000
  }, 30, 20);
  assert.equal(plan.targetTotalCents, 1452000);
  assert.equal(plan.projectedTotalCents, plan.rows.reduce((total, row) => total + row.projectedCents, 0));
  assert.deepEqual(plan.rows.map((row) => row.targetCents), [798600, 72600, 145200, 217800, 217800]);
  assert.deepEqual(plan.rows.map((row) => row.projectedCents), [464390, 5069, 120750, 37500, 75000]);
  assert.equal(plan.projectedTotalCents, 702709);
  assert.throws(() => math.calculateBudgetPlan(
    demo.budget.map((item) => ({ ...item, target: "54.99" })),
    10000,
    {},
    30,
    20
  ), /add up to 100%/);
});
