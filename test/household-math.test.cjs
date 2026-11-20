const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const math = require("../public/household-math.js");

const demo = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "household.json"), "utf8"));

test("fixed decimal rates and money survive legacy floating-point values", () => {
  assert.equal(math.fixedDecimal(19.989999771118164), "19.99");
  assert.equal(math.fixedDecimal("19.99"), "19.99");
  assert.equal(math.toCents("96.42"), 9642);
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

test("amount sorting uses signed income and spending values", () => {
  const ascending = math.sortTransactionsBySignedAmount(demo.transactions, "asc");
  const descending = math.sortTransactionsBySignedAmount(demo.transactions, "desc");
  const values = (items) => items.map((item) => math.signedTransactionCents(item));
  assert.deepEqual(values(ascending), [...values(ascending)].sort((a, b) => a - b));
  assert.deepEqual(values(descending), [...values(ascending)].reverse());
});
