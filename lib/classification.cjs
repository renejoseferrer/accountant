const HouseholdMath = require("../public/household-math.js");

const MARKS = new Set(["Essentials", "Wants"]);
const CATEGORY_DEFAULTS = {
  Groceries: "Essentials",
  "Housing & Utilities": "Essentials",
  "Transit & Fuel": "Essentials",
  Childcare: "Essentials",
  Medical: "Essentials",
  Dining: "Wants",
  Shopping: "Wants",
  Subscriptions: "Wants",
  Other: "Wants"
};
const WANT_PATTERN = /\b(candy|chocolate|soda|pop|chips|cookies|cake|ice cream|beer|wine|alcohol|treat|snack|dessert|toy|game|movie|entertainment|makeup|luxury)\b/i;
const STAPLE_PATTERN = /\b(milk|bread|egg|eggs|rice|vegetable|vegetables|fruit|apple|banana|potato|beans|oat|cereal|chicken|fish|meat|flour|pasta|formula)\b/i;
const PERISHABLE_PATTERN = /\b(milk|bread|egg|eggs|yogurt|cheese|lettuce|spinach|berry|berries|fruit|vegetable|produce|chicken|fish|meat|dairy)\b/i;
const WANT_CATEGORY_PATTERN = /\b(dining|eating out|entertainment|shopping|subscription|other)\b/i;
const ESSENTIAL_CATEGORY_PATTERN = /\b(groceries|housing|utilities|transit|fuel|childcare|medical)\b/i;

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function cents(value, key = "amount") {
  const stored = value?.[`${key}Cents`];
  return Number.isSafeInteger(stored) ? stored : HouseholdMath.toCents(value?.[key]);
}

function categoryDefault(category) {
  return CATEGORY_DEFAULTS[category] || null;
}

function suggestClassification({ merchant, itemName = "", category = "", merchantRules = [], transactions = [], receipts = [] }) {
  const merchantText = normalizeText(merchant);
  const itemText = normalizeText(itemName);
  const fastFood = /\b(kfc|mcdonald|burger king|wendy|a&w|taco bell|popeyes|subway|tim hortons|pizza hut|domino|fast food)\b/i.test(`${merchant || ""} ${category || ""}`);
  const rule = merchantRules.find((candidate) =>
    candidate.merchant && merchantText.includes(normalizeText(candidate.merchant)));
  if (rule) {
    const ruleCategory = fastFood ? "Dining" : String(rule.category || category || "Other");
    return {
      category: ruleCategory,
      classification: fastFood ? "Wants" : (MARKS.has(rule.classification) ? rule.classification : categoryDefault(ruleCategory)),
      confidence: "high",
      source: "merchant rule"
    };
  }

  const priorItems = [
    ...transactions.flatMap((transaction) => (transaction.splits || []).map((split) => ({
      merchant: transaction.merchant, name: split.name, category: split.category, classification: split.classification
    }))),
    ...receipts.flatMap((receipt) => (receipt.items || []).map((item) => ({
      merchant: receipt.merchant, name: item.name, category: item.category, classification: item.classification
    })))
  ];
  const prior = priorItems.find((item) =>
    normalizeText(item.merchant) === merchantText && itemText && normalizeText(item.name) === itemText &&
    item.category && MARKS.has(item.classification));
  if (prior) return { category: prior.category, classification: prior.classification, confidence: "high", source: "same merchant history" };

  if (fastFood || /\b(restaurant|cafe|coffee|takeout|take out|dining|kfc)\b/i.test(`${merchant || ""} ${category || ""}`)) {
    return { category: "Dining", classification: "Wants", confidence: "high", source: "merchant type" };
  }
  if (WANT_PATTERN.test(itemText)) return { category: "Groceries", classification: "Wants", confidence: "high", source: "item name" };
  if (STAPLE_PATTERN.test(itemText)) return { category: "Groceries", classification: "Essentials", confidence: "high", source: "item name" };
  if (/cleaner|detergent|soap|paper towel|toilet paper/i.test(itemText)) {
    return { category: "Housing & Utilities", classification: "Essentials", confidence: "medium", source: "item name" };
  }
  if (category && categoryDefault(category)) {
    return { category, classification: categoryDefault(category), confidence: "medium", source: "category default" };
  }
  if (WANT_CATEGORY_PATTERN.test(category)) return { category: category || "Other", classification: "Wants", confidence: "medium", source: "category default" };
  if (ESSENTIAL_CATEGORY_PATTERN.test(category)) return { category, classification: "Essentials", confidence: "medium", source: "category default" };
  return { category: category || "Other", classification: null, confidence: "low", source: "needs owner review" };
}

function isUnnecessary(category, name) {
  return WANT_CATEGORY_PATTERN.test(category) || WANT_PATTERN.test(name);
}

function itemFlags({ item, merchant, date, currentReceiptId, receipts, stock, transactions, asOf = new Date() }) {
  const flags = [];
  const name = item?.name || merchant || "";
  const mark = item?.classification;
  const category = item?.category || "";
  if (mark === "Essentials" && isUnnecessary(category, name)) {
    flags.push({ code: "unnecessary-essential", reason: "This looks optional, but it is marked Essentials. Confirm the need or move it to Wants." });
  }

  const key = normalizeText(name);
  const today = new Date(`${date}T12:00:00Z`);
  const earlierItems = [
    ...(transactions || []).filter((transaction) => transaction.type === "expense").flatMap((transaction) =>
      (transaction.splits || []).map((split) => ({ name: split.name, date: transaction.date, amountCents: cents(split) }))),
    ...(receipts || []).filter((receipt) => receipt.id !== currentReceiptId).flatMap((receipt) =>
      (receipt.items || []).map((receiptItem) => ({ name: receiptItem.name, date: receipt.date, amountCents: Number(receiptItem.lineTotalCents || 0) })))
  ];
  const repeat = earlierItems.find((entry) => {
    const previousDate = new Date(`${entry.date}T12:00:00Z`);
    const days = (today - previousDate) / 86_400_000;
    return entry.name && key && normalizeText(entry.name) === key && days >= 0 && days <= 7;
  });
  if (repeat) flags.push({ code: "repeat", reason: `A similar item was bought within the last 7 days (on ${repeat.date}).` });

  const stockItem = (stock || []).find((entry) => normalizeText(entry.name) === key);
  if (stockItem && Number(stockItem.quantity) >= 3) {
    flags.push({ code: "in-stock", reason: `Home stock already lists ${stockItem.quantity} ${stockItem.name}.` });
  }
  if (stockItem?.expiryDate && PERISHABLE_PATTERN.test(name)) {
    const expiry = new Date(`${stockItem.expiryDate}T12:00:00Z`);
    const daysUntilExpiry = Math.floor((expiry - new Date(`${asOf.toISOString().slice(0, 10)}T12:00:00Z`)) / 86_400_000);
    if (daysUntilExpiry >= 0 && daysUntilExpiry <= 3) {
      flags.push({ code: "waste-risk", reason: `${stockItem.name} already at home expires within 3 days (${stockItem.expiryDate}).` });
    }
  }

  const historyPrices = earlierItems.filter((entry) => normalizeText(entry.name) === key && entry.amountCents > 0)
    .map((entry) => entry.amountCents);
  const currentPrice = Number(item?.lineTotalCents ?? cents(item));
  const usual = historyPrices.length ? Math.round(historyPrices.reduce((sum, value) => sum + value, 0) / historyPrices.length) : 0;
  if (usual > 0 && currentPrice >= Math.ceil(usual * 1.5) && currentPrice - usual >= 100) {
    flags.push({ code: "unusually-expensive", reason: `This costs ${HouseholdMath.fixedDecimal(currentPrice / 100, 2)}; usual recorded price is ${HouseholdMath.fixedDecimal(usual / 100, 2)}.` });
  }
  return flags;
}

function classifyState(state) {
  state.homeStock ||= [];
  state.returnTasks ||= [];
  state.classificationChanges ||= [];
  state.transactions ||= [];
  state.groceryReceipts ||= [];
  state.merchantRules ||= [];
  for (const transaction of state.transactions) {
    if (transaction.type !== "expense") continue;
    if (Array.isArray(transaction.splits) && transaction.splits.length) {
      for (const split of transaction.splits) {
        if (!MARKS.has(split.classification)) {
          const suggestion = suggestClassification({
            merchant: transaction.merchant, itemName: split.name, category: split.category || transaction.category,
            merchantRules: state.merchantRules, transactions: [], receipts: []
          });
          split.classification = suggestion.classification;
          split.classificationConfidence = suggestion.confidence;
          split.classificationSource = suggestion.source;
          split.classificationConfirmed = false;
        }
      }
    } else if (!MARKS.has(transaction.classification)) {
      const suggestion = suggestClassification({
        merchant: transaction.merchant, category: transaction.category, merchantRules: state.merchantRules
      });
      transaction.classification = suggestion.classification;
      transaction.classificationConfidence = suggestion.confidence;
      transaction.classificationSource = suggestion.source;
      transaction.classificationConfirmed = false;
    }
  }
  for (const receipt of state.groceryReceipts) {
    for (const item of receipt.items || []) {
      if (!MARKS.has(item.classification)) {
        const suggestion = suggestClassification({
          merchant: receipt.merchant, itemName: item.name, category: item.category,
          merchantRules: state.merchantRules, transactions: state.transactions, receipts: []
        });
        item.classification = suggestion.classification;
        item.classificationConfidence = suggestion.confidence;
        item.classificationSource = suggestion.source;
        item.classificationConfirmed = false;
      }
    }
    const transaction = state.transactions.find((entry) => entry.id === receipt.expenseTransactionId);
    if (transaction?.splits?.length === receipt.items?.length) {
      receipt.items.forEach((item, index) => {
        transaction.splits[index].classification = item.classification;
        transaction.splits[index].classificationConfidence = item.classificationConfidence;
        transaction.splits[index].classificationSource = item.classificationSource;
        transaction.splits[index].classificationConfirmed = item.classificationConfirmed;
      });
    }
  }
  for (const rule of state.merchantRules) {
    if (!MARKS.has(rule.classification)) rule.classification = categoryDefault(rule.category) || "Wants";
  }
  return state;
}

function recordClassificationChange(state, { target, targetName, field, before, after, reason, changedBy }) {
  if (before === after) return;
  state.classificationChanges ||= [];
  state.classificationChanges.unshift({
    id: require("node:crypto").randomUUID(),
    target,
    targetName,
    field,
    from: before ?? "Unclassified",
    to: after ?? "Unclassified",
    reason: String(reason || "").trim().slice(0, 240),
    changedAt: new Date().toISOString(),
    changedBy: changedBy || "Household"
  });
}

function recordTransactionClassificationChanges(state, before, after, reason, changedBy) {
  for (const field of ["category", "classification"]) {
    if (before[field] !== after[field]) {
      recordClassificationChange(state, {
        target: before.id,
        targetName: after.merchant || before.merchant,
        field,
        before: before[field],
        after: after[field],
        reason,
        changedBy
      });
    }
  }
  const priorSplits = Array.isArray(before.splits) ? before.splits : [];
  const nextSplits = Array.isArray(after.splits) ? after.splits : [];
  for (let index = 0; index < Math.min(priorSplits.length, nextSplits.length); index++) {
    for (const field of ["category", "classification"]) {
      if (priorSplits[index][field] !== nextSplits[index][field]) {
        recordClassificationChange(state, {
          target: `${before.id}:${index}`,
          targetName: nextSplits[index].name || after.merchant || before.merchant,
          field,
          before: priorSplits[index][field],
          after: nextSplits[index][field],
          reason,
          changedBy
        });
      }
    }
  }
}

function applyClassificationUpdates(state, transaction, updates, { reason, changedBy }) {
  if (!Array.isArray(updates) || updates.length < 1 || updates.length > 300) {
    const error = new Error("Choose one or more valid items to classify.");
    error.status = 400;
    throw error;
  }
  const receipt = (state.groceryReceipts || []).find((item) =>
    item.expenseTransactionId === transaction.id || item.id === transaction.receiptId);
  for (const update of updates) {
    const isItem = Number.isSafeInteger(update.index);
    const record = isItem
      ? (receipt?.items?.[update.index] || transaction.splits?.[update.index])
      : transaction;
    const split = isItem ? transaction.splits?.[update.index] : null;
    if (!record || (isItem && !split)) {
      const error = new Error("One or more selected items no longer exist.");
      error.status = 400;
      throw error;
    }
    if (update.classification !== undefined && update.classification !== null && !MARKS.has(update.classification)) {
      const error = new Error("Choose Essentials or Wants.");
      error.status = 400;
      throw error;
    }
    const category = update.category === undefined ? record.category : String(update.category);
    if (update.category !== undefined && !require("./receipt-validation.cjs").EXPENSE_CATEGORIES.has(category)) {
      const error = new Error("Choose an existing expense category.");
      error.status = 400;
      throw error;
    }
    const targets = [record, split].filter(Boolean);
    if (update.category !== undefined && record.category !== category) {
      recordClassificationChange(state, {
        target: `${transaction.id}${isItem ? `:${update.index}` : ""}`,
        targetName: isItem ? (record.name || split?.name || transaction.merchant) : transaction.merchant,
        field: "category", before: record.category, after: category, reason, changedBy
      });
    }
    if (update.classification !== undefined && record.classification !== update.classification) {
      recordClassificationChange(state, {
        target: `${transaction.id}${isItem ? `:${update.index}` : ""}`,
        targetName: isItem ? (record.name || split?.name || transaction.merchant) : transaction.merchant,
        field: "classification", before: record.classification, after: update.classification, reason, changedBy
      });
    }
    for (const target of targets) {
      if (update.category !== undefined) target.category = category;
      if (update.classification !== undefined) target.classification = update.classification;
      if (update.category !== undefined || update.classification !== undefined) {
        target.classificationConfirmed = update.confirmed !== false;
        if (target.classificationConfirmed) target.classificationConfidence = "high";
      }
    }
    if (isItem && receipt) {
      const matchingSplit = transaction.splits[update.index];
      matchingSplit.category = record.category;
      matchingSplit.classification = record.classification;
      matchingSplit.classificationConfirmed = record.classificationConfirmed;
    }
  }
  if (transaction.splits?.length) {
    const categories = [...new Set(transaction.splits.map((split) => split.category))];
    transaction.category = categories.length === 1 ? categories[0] : "Split purchase";
    transaction.classification = null;
  }
}

function createReturnTask(state, { transaction, index, returnBy, changedBy }) {
  const receipt = (state.groceryReceipts || []).find((item) =>
    item.expenseTransactionId === transaction.id || item.id === transaction.receiptId);
  const item = Number.isSafeInteger(index) ? receipt?.items?.[index] || transaction.splits?.[index] : transaction;
  if (!item) {
    const error = new Error("Choose an item or expense that can be considered for return.");
    error.status = 400;
    throw error;
  }
  const amountCents = Number.isSafeInteger(item.lineTotalCents) ? item.lineTotalCents : cents(item);
  if (amountCents <= 0 || Number(item.refundedCents) >= amountCents) {
    const error = new Error("This item has no remaining amount to return.");
    error.status = 400;
    throw error;
  }
  state.returnTasks ||= [];
  if (state.returnTasks.some((task) => task.status === "open" && task.transactionId === transaction.id && task.itemIndex === index)) {
    const error = new Error("An open return task already exists for this item.");
    error.status = 409;
    throw error;
  }
  const task = {
    id: require("node:crypto").randomUUID(),
    transactionId: transaction.id,
    receiptId: receipt?.id || null,
    itemIndex: Number.isSafeInteger(index) ? index : null,
    merchant: receipt?.merchant || transaction.merchant,
    itemName: item.name || transaction.merchant,
    amountCents,
    returnBy: returnBy || null,
    status: "open",
    createdAt: new Date().toISOString(),
    createdBy: changedBy || "Household"
  };
  state.returnTasks.unshift(task);
  return task;
}

function finishReturnTask(state, task, { status, reason, changedBy }) {
  if (task.status !== "open") {
    const error = new Error("This return task is already closed.");
    error.status = 409;
    throw error;
  }
  if (!["Returned", "Kept", "Dismissed"].includes(status)) {
    const error = new Error("Choose Returned, Kept, or Dismissed.");
    error.status = 400;
    throw error;
  }
  if (status === "Kept" && String(reason || "").trim().length < 3) {
    const error = new Error("Add a short reason before marking this item Kept.");
    error.status = 400;
    throw error;
  }
  task.status = status;
  task.closedAt = new Date().toISOString();
  task.closedBy = changedBy || "Household";
  if (status === "Kept") task.keptReason = String(reason).trim().slice(0, 240);
  if (status === "Returned") {
    const transaction = state.transactions.find((item) => item.id === task.transactionId);
    if (!transaction) {
      const error = new Error("The original expense no longer exists.");
      error.status = 404;
      throw error;
    }
    const receipt = (state.groceryReceipts || []).find((item) => item.id === task.receiptId);
    const item = Number.isSafeInteger(task.itemIndex)
      ? receipt?.items?.[task.itemIndex] || transaction.splits?.[task.itemIndex]
      : transaction;
    if (!item) {
      const error = new Error("The original expense item no longer exists.");
      error.status = 404;
      throw error;
    }
    item.refundedCents = (Number(item.refundedCents) || 0) + task.amountCents;
    if (item !== transaction && transaction.splits?.[task.itemIndex]) {
      transaction.splits[task.itemIndex].refundedCents = (Number(transaction.splits[task.itemIndex].refundedCents) || 0) + task.amountCents;
    }
    transaction.refundedCents = (Number(transaction.refundedCents) || 0) + task.amountCents;
    const account = state.accounts.find((entry) => entry.id === transaction.accountId);
    if (account) {
      const delta = account.kind === "liability" ? -task.amountCents : task.amountCents;
      account.balanceCents = HouseholdMath.centsFor(account, "balance") + delta;
      account.balance = account.balanceCents / 100;
    }
    const refund = {
      id: require("node:crypto").randomUUID(),
      date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton" }),
      merchant: `Refund: ${task.itemName}`,
      amount: task.amountCents / 100,
      amountCents: task.amountCents,
      category: "Expense refund",
      owner: transaction.owner,
      account: transaction.account,
      accountId: transaction.accountId,
      type: "transfer",
      status: "Actual",
      note: `Refund linked to ${transaction.merchant}`,
      refundFor: transaction.id,
      source: "return-task"
    };
    state.transactions.unshift(refund);
    task.refundTransactionId = refund.id;
  }
  return task;
}

module.exports = {
  CATEGORY_DEFAULTS,
  ESSENTIAL_CATEGORY_PATTERN,
  MARKS,
  PERISHABLE_PATTERN,
  WANT_CATEGORY_PATTERN,
  WANT_PATTERN,
  categoryDefault,
  classifyState,
  applyClassificationUpdates,
  createReturnTask,
  finishReturnTask,
  isUnnecessary,
  itemFlags,
  normalizeText,
  recordClassificationChange,
  recordTransactionClassificationChanges,
  suggestClassification
};
