const test = require("node:test");
const assert = require("node:assert/strict");
const Classification = require("../lib/classification.cjs");
const HouseholdMath = require("../public/household-math.js");

test("fast food stays Wants and staples differ from grocery treats", () => {
  const merchantRules = [{ merchant: "KFC", category: "Groceries", classification: "Essentials" }];
  const chicken = Classification.suggestClassification({
    merchant: "KFC", itemName: "Chicken meal", merchantRules
  });
  assert.equal(chicken.category, "Dining");
  assert.equal(chicken.classification, "Wants");

  const milk = Classification.suggestClassification({ merchant: "Market", itemName: "Milk" });
  const candy = Classification.suggestClassification({ merchant: "Market", itemName: "Candy" });
  assert.deepEqual([milk.category, milk.classification], ["Groceries", "Essentials"]);
  assert.deepEqual([candy.category, candy.classification], ["Groceries", "Wants"]);
});

test("flags essentials that look optional, stocked goods, repeats, and high prices", () => {
  const flags = Classification.itemFlags({
    item: { name: "Candy", category: "Groceries", classification: "Essentials", lineTotalCents: 300 },
    merchant: "Market",
    date: "2026-03-03",
    receipts: [{ id: "prior", date: "2026-03-01", items: [{ name: "Candy", lineTotalCents: 100 }] }],
    transactions: [],
    stock: [{ name: "Candy", quantity: 3 }],
    asOf: new Date("2026-03-03T12:00:00Z")
  });
  assert.deepEqual(flags.map((flag) => flag.code), ["unnecessary-essential", "repeat", "in-stock", "unusually-expensive"]);
});

test("classification updates keep item cents intact and record both edits", () => {
  const state = {
    transactions: [{
      id: "tx-1", merchant: "Market", category: "Groceries", type: "expense", amount: 10,
      splits: [{ name: "Milk", category: "Groceries", classification: "Essentials", amount: 6, amountCents: 600 }]
    }],
    groceryReceipts: [{
      id: "receipt-1", expenseTransactionId: "tx-1",
      items: [{ name: "Milk", category: "Groceries", classification: "Essentials", lineTotalCents: 600 }]
    }]
  };
  Classification.applyClassificationUpdates(state, state.transactions[0], [{
    index: 0, category: "Dining", classification: "Wants", confirmed: true
  }], { reason: "Owner confirmed this is a treat", changedBy: "Partner A" });

  assert.equal(state.transactions[0].splits[0].amountCents, 600);
  assert.equal(state.groceryReceipts[0].items[0].lineTotalCents, 600);
  assert.equal(state.classificationChanges.length, 2);
  assert.ok(state.classificationChanges.every((entry) => entry.reason === "Owner confirmed this is a treat"));
});

test("returning a line item creates a linked refund and reduces spending by exact cents", () => {
  const state = {
    accounts: [{ id: "cash-1", kind: "cash", balance: 100, balanceCents: 10000 }],
    transactions: [{
      id: "tx-2", date: "2026-03-03", merchant: "Market", amount: 50, amountCents: 5000,
      type: "expense", owner: "Partner A", accountId: "cash-1", account: "Chequing", status: "Actual",
      splits: [
        { name: "Milk", category: "Groceries", classification: "Essentials", amount: 30, amountCents: 3000 },
        { name: "Candy", category: "Groceries", classification: "Wants", amount: 20, amountCents: 2000 }
      ]
    }],
    groceryReceipts: [{
      id: "receipt-2", expenseTransactionId: "tx-2",
      items: [
        { name: "Milk", category: "Groceries", classification: "Essentials", lineTotalCents: 3000 },
        { name: "Candy", category: "Groceries", classification: "Wants", lineTotalCents: 2000 }
      ]
    }]
  };
  const task = Classification.createReturnTask(state, {
    transaction: state.transactions[0], index: 1, returnBy: "2026-03-10", changedBy: "Partner A"
  });
  Classification.finishReturnTask(state, task, { status: "Returned", changedBy: "Partner A" });

  const ledger = HouseholdMath.calculateLedger(state);
  assert.equal(task.status, "Returned");
  assert.ok(task.refundTransactionId);
  assert.equal(state.transactions.find((item) => item.id === task.refundTransactionId).refundFor, "tx-2");
  assert.equal(ledger.expenseCents, 3000);
  assert.equal(ledger.essentialsCents, 3000);
  assert.equal(ledger.wantsCents, 0);
  assert.equal(state.accounts[0].balanceCents, 12000);
});

test("joint Essentials and Wants marks add to the cent in every household view", () => {
  const state = { transactions: [{
    id: "joint-1", type: "expense", status: "Actual", owner: "Joint",
    amount: 10.01, amountCents: 1001,
    splits: [
      { category: "Groceries", classification: "Essentials", amountCents: 500 },
      { category: "Groceries", classification: "Wants", amountCents: 501 }
    ]
  }] };
  const combined = HouseholdMath.calculateLedger(state, "Combined Household", 50);
  for (const view of ["Partner A Only", "Partner B Only"]) {
    const partner = HouseholdMath.calculateLedger(state, view, 50);
    assert.equal(partner.expenseCents, partner.essentialsCents + partner.wantsCents);
  }
  const partnerA = HouseholdMath.calculateLedger(state, "Partner A Only", 50);
  const partnerB = HouseholdMath.calculateLedger(state, "Partner B Only", 50);
  assert.equal(partnerA.expenseCents + partnerB.expenseCents, combined.expenseCents);
  assert.equal(partnerA.essentialsCents + partnerB.essentialsCents, combined.essentialsCents);
  assert.equal(partnerA.wantsCents + partnerB.wantsCents, combined.wantsCents);
});
