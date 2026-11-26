(function (root, factory) {
  const math = factory();
  if (typeof module === "object" && module.exports) module.exports = math;
  else root.HouseholdMath = math;
})(globalThis, function () {
  function toCents(value) {
    const text = String(value ?? "0").trim();
    const match = text.match(/^(-?)(\d+)(?:\.(\d*))?$/);
    if (!match) return Math.round((Number(value) || 0) * 100);
    const fraction = (match[3] || "").padEnd(3, "0");
    return (match[1] === "-" ? -1 : 1) *
      (Number(match[2]) * 100 + Number(fraction.slice(0, 2)) + (Number(fraction[2]) >= 5 ? 1 : 0));
  }

  function fixedDecimal(value, places = 2) {
    const text = String(value ?? "0").trim();
    const match = text.match(/^(-?)(\d+)(?:\.(\d*))?$/);
    if (!match) {
      const number = Number(value);
      return (Number.isFinite(number) ? number : 0).toFixed(places);
    }
    const scale = 10 ** places;
    const fraction = match[3] || "";
    const kept = fraction.slice(0, places).padEnd(places, "0");
    const next = Number(fraction[places] || 0);
    const scaled = Number(match[2]) * scale + Number(kept || 0) + (next >= 5 ? 1 : 0);
    return `${match[1] === "-" ? "-" : ""}${(scaled / scale).toFixed(places)}`;
  }

  function isNonNegativeDecimal(value, places = 2) {
    return new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(String(value ?? "").trim());
  }

  function toBasisPoints(value) {
    if (!isNonNegativeDecimal(value, 2)) return 0;
    const text = String(value).trim();
    const match = text.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    return Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  }

  function centsFor(record, key) {
    const cents = record?.[`${key}Cents`];
    return Number.isSafeInteger(cents) ? cents : toCents(record?.[key]);
  }

  function roundDivision(numerator, denominator) {
    const sign = numerator < 0 ? -1 : 1;
    return sign * Math.floor((Math.abs(numerator) + Math.floor(denominator / 2)) / denominator);
  }

  function allocateBasisPointCents(totalCents, basisPoints) {
    if (!Number.isSafeInteger(totalCents) || totalCents < 0 ||
        !Array.isArray(basisPoints) || basisPoints.some((value) => !Number.isSafeInteger(value) || value < 0) ||
        basisPoints.reduce((sum, value) => sum + value, 0) !== 10000) {
      throw new Error("Allocation shares must be non-negative basis points totaling 10000.");
    }
    const allocations = basisPoints.map((share, index) => {
      const partial = (totalCents % 10000) * share;
      return {
        index,
        cents: Math.floor(totalCents / 10000) * share + Math.floor(partial / 10000),
        remainder: partial % 10000
      };
    });
    const remaining = totalCents - allocations.reduce((sum, item) => sum + item.cents, 0);
    allocations.slice().sort((left, right) => right.remainder - left.remainder || left.index - right.index)
      .slice(0, remaining)
      .forEach((item) => { allocations[item.index].cents += 1; });
    return allocations.map((item) => item.cents);
  }

  function budgetCategoryFor(category, merchant, classification) {
    const categoryText = String(category || "").toLowerCase();
    const text = `${categoryText} ${merchant || ""}`.toLowerCase();
    if (/debt repayment/.test(categoryText)) return "Debt Repayment";
    if (/investment contribution|general savings/.test(categoryText)) return "Savings & Investments";
    if (/groceries|dining|eating out/.test(categoryText)) {
      return classification === "Essentials" ? "Food — Needs" : "Food — Wants";
    }
    if (/housing|utilities/.test(categoryText)) {
      return /hydro|electric|water|internet|utility|gas bill/.test(text) ? "Utilities" : "Housing";
    }
    if (/transit|fuel|transport/.test(categoryText)) return "Transportation";
    if (/insurance/.test(text)) return "Insurance";
    if (/medical|health/.test(categoryText)) return "Health & Personal Care";
    if (/childcare/.test(categoryText)) return "Family & Childcare";
    if (/subscription|shopping/.test(categoryText)) return "Entertainment & Leisure";
    return "Miscellaneous / Irregular";
  }

  function shareCents(cents, owner, view = "Combined Household", jointShare = 50) {
    if (view === "Combined Household" || owner !== "Joint") {
      if (view === "Combined Household" || owner === view.replace(" Only", "")) return cents;
      return 0;
    }
    const basisPoints = Math.max(0, Math.min(10000, toBasisPoints(jointShare)));
    const partnerAShare = roundDivision(cents * basisPoints, 10000);
    return view === "Partner B Only" ? cents - partnerAShare : partnerAShare;
  }

  function splitShares(splits, owner, view, jointShare, targetCents) {
    if (view === "Combined Household" || owner !== "Joint") {
      return splits.map((split) => view === "Combined Household" || owner === view.replace(" Only", "")
        ? centsFor(split, "amount")
        : 0);
    }
    const basisPoints = Math.max(0, Math.min(10000, toBasisPoints(jointShare)));
    const allocations = splits.map((split, index) => {
      const numerator = centsFor(split, "amount") * basisPoints;
      return { index, cents: Math.floor(numerator / 10000), remainder: numerator % 10000 };
    });
    const partnerATarget = roundDivision(
      splits.reduce((sum, split) => sum + centsFor(split, "amount"), 0) * basisPoints,
      10000
    );
    let remaining = partnerATarget - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
    allocations.slice().sort((left, right) => right.remainder - left.remainder || left.index - right.index)
      .slice(0, remaining)
      .forEach((allocation) => { allocations[allocation.index].cents += 1; });
    if (view === "Partner B Only") {
      return allocations.map((allocation, index) => centsFor(splits[index], "amount") - allocation.cents);
    }
    return allocations.map((allocation) => allocation.cents);
  }

  function transactionCategoryCents(transaction, categories, view = "Combined Household", jointShare = 50) {
    const amountCents = centsFor(transaction, "amount");
    const shownAmountCents = shareCents(amountCents, transaction.owner, view, jointShare);
    const splits = Array.isArray(transaction.splits) && transaction.splits.length ? transaction.splits : null;
    if (!splits || splits.reduce((sum, split) => sum + centsFor(split, "amount"), 0) !== amountCents) {
      return categories.includes(transaction.category) ? shownAmountCents : 0;
    }
    const shownSplits = splitShares(splits, transaction.owner, view, jointShare, shownAmountCents);
    return splits.reduce((sum, split, index) =>
      sum + (categories.includes(split.category) ? shownSplits[index] : 0), 0);
  }

  function transactionClassificationCents(transaction, classification, view = "Combined Household", jointShare = 50) {
    const splits = Array.isArray(transaction.splits) && transaction.splits.length ? transaction.splits : null;
    const originalCents = centsFor(transaction, "amount");
    const refundedCents = Math.max(0, Math.min(originalCents, Number(transaction.refundedCents) || 0));
    if (!splits || splits.reduce((sum, split) => sum + centsFor(split, "amount"), 0) !== originalCents) {
      const netCents = originalCents - refundedCents;
      return transaction.classification === classification
        ? shareCents(netCents, transaction.owner, view, jointShare)
        : 0;
    }

    const netSplits = splits.map((split) => {
      const refunded = Math.max(0, Math.min(centsFor(split, "amount"), Number(split.refundedCents) || 0));
      return { ...split, amountCents: centsFor(split, "amount") - refunded, amount: (centsFor(split, "amount") - refunded) / 100 };
    });
    const netTotalCents = netSplits.reduce((sum, split) => sum + centsFor(split, "amount"), 0);
    const shownSplits = splitShares(netSplits, transaction.owner, view, jointShare, shareCents(netTotalCents, transaction.owner, view, jointShare));
    return netSplits.reduce((sum, split, index) =>
      sum + (split.classification === classification ? shownSplits[index] : 0), 0);
  }

  function transactionNetExpenseCents(transaction, view = "Combined Household", jointShare = 50) {
    const grossCents = centsFor(transaction, "amount");
    const refunds = Math.max(0, Math.min(grossCents, Number(transaction.refundedCents) || 0));
    return shareCents(grossCents - refunds, transaction.owner, view, jointShare);
  }

  function calculateLedger(state, view = "Combined Household", jointShare = 50) {
    const incomeByCategory = {};
    const expensesByCategory = {};
    const splitMismatches = [];
    let incomeCents = 0;
    let expenseCents = 0;
    let essentialsCents = 0;
    let wantsCents = 0;

    for (const transaction of state.transactions || []) {
      if (!countsTowardSpending(transaction)) continue;
      if (transaction.status !== "Actual" || !["income", "expense"].includes(transaction.type)) continue;
      const grossAmountCents = shareCents(centsFor(transaction, "amount"), transaction.owner, view, jointShare);
      if (!grossAmountCents) continue;
      if (transaction.type === "income") {
        incomeCents += grossAmountCents;
        const category = transaction.category || "Uncategorized";
        incomeByCategory[category] = (incomeByCategory[category] || 0) + grossAmountCents;
        continue;
      }

      const totalCents = centsFor(transaction, "amount");
      const refundCents = Math.max(0, Math.min(totalCents, Number(transaction.refundedCents) || 0));
      const amountCents = transactionNetExpenseCents(transaction, view, jointShare);
      expenseCents += amountCents;
      const splits = Array.isArray(transaction.splits) && transaction.splits.length ? transaction.splits : null;
      const splitTotal = splits ? splits.reduce((sum, split) => sum + centsFor(split, "amount"), 0) : totalCents;
      if (splits && splitTotal !== totalCents) {
        splitMismatches.push(transaction.id);
      }
      if (!splits || splitTotal !== totalCents) {
        const category = transaction.category || "Uncategorized";
        expensesByCategory[category] = (expensesByCategory[category] || 0) + amountCents;
        if (transaction.classification === "Essentials") essentialsCents += amountCents;
        if (transaction.classification === "Wants") wantsCents += amountCents;
        continue;
      }
      const netSplits = splits.map((split) => {
        const splitCents = centsFor(split, "amount");
        const splitRefunded = Math.max(0, Math.min(splitCents, Number(split.refundedCents) || 0));
        return { ...split, amountCents: splitCents - splitRefunded, amount: (splitCents - splitRefunded) / 100 };
      });
      const netSplitTotal = netSplits.reduce((sum, split) => sum + centsFor(split, "amount"), 0);
      const shownSplits = splitShares(netSplits, transaction.owner, view, jointShare, amountCents);
      for (const [index, split] of netSplits.entries()) {
        const category = split.category || "Uncategorized";
        expensesByCategory[category] = (expensesByCategory[category] || 0) + shownSplits[index];
        if (split.classification === "Essentials") essentialsCents += shownSplits[index];
        if (split.classification === "Wants") wantsCents += shownSplits[index];
      }
      if (netSplitTotal !== totalCents - refundCents) splitMismatches.push(transaction.id);
    }

    return {
      incomeCents,
      expenseCents,
      essentialsCents,
      wantsCents,
      netCents: incomeCents - expenseCents,
      incomeByCategoryCents: incomeByCategory,
      expensesByCategoryCents: expensesByCategory,
      splitMismatches
    };
  }

  function countsTowardSpending(transaction) {
    return transaction?.receiptMatchRole !== "bank-record";
  }

  function signedTransactionCents(transaction, view = "Combined Household", jointShare = 50) {
    const amount = shareCents(centsFor(transaction, "amount"), transaction.owner, view, jointShare);
    return transaction.type === "expense" ? -amount : amount;
  }

  function sortTransactionsBySignedAmount(records, direction = "asc", view = "Combined Household", jointShare = 50) {
    const multiplier = direction === "asc" ? 1 : -1;
    return records.slice().sort((left, right) => {
      const difference = signedTransactionCents(left, view, jointShare) -
        signedTransactionCents(right, view, jointShare);
      return (difference || String(left.id).localeCompare(String(right.id))) * multiplier;
    });
  }

  function calculateBudgetPlan(budget, incomeCents, actualCentsByCategory, daysInMonth, elapsedDays) {
    const basisPoints = budget.map((item) => toBasisPoints(item.target));
    if (basisPoints.reduce((sum, value) => sum + value, 0) !== 10000) {
      throw new Error("Budget target percentages must add up to 100%.");
    }
    const allocations = budget.map((item, index) => {
      const numerator = incomeCents * basisPoints[index];
      return {
        category: item.category,
        basisPoints: basisPoints[index],
        targetCents: Math.floor(numerator / 10000),
        remainder: numerator % 10000,
        actualCents: actualCentsByCategory[item.category] || 0
      };
    });
    const targetRemainder = incomeCents - allocations.reduce((sum, item) => sum + item.targetCents, 0);
    allocations.slice().sort((left, right) => right.remainder - left.remainder)
      .slice(0, targetRemainder)
      .forEach((item) => { item.targetCents += 1; });
    for (const item of allocations) {
      item.projectedCents = roundDivision(item.actualCents * daysInMonth, elapsedDays);
    }
    return {
      rows: allocations,
      targetTotalCents: allocations.reduce((sum, item) => sum + item.targetCents, 0),
      projectedTotalCents: allocations.reduce((sum, item) => sum + item.projectedCents, 0)
    };
  }

  return {
    calculateLedger,
    countsTowardSpending,
    calculateBudgetPlan,
    allocateBasisPointCents,
    budgetCategoryFor,
    centsFor,
    fixedDecimal,
    isNonNegativeDecimal,
    shareCents,
    splitShares,
    transactionCategoryCents,
    transactionClassificationCents,
    transactionNetExpenseCents,
    signedTransactionCents,
    sortTransactionsBySignedAmount,
    toBasisPoints,
    toCents
  };
});
