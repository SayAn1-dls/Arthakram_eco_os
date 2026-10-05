import { test } from "node:test";
import assert from "node:assert/strict";
import { matchClubs, matchOpportunity, scoreDimensions } from "../src/lib/recommend";

test("product-minded answers rank the product club first, with reasons", () => {
  const dims = scoreDimensions({
    q_product: 5, q_strategy: 4, q_coding: 2, q_design: 3, q_policy: 1, q_finance: 1,
    q_weekend: "pitch", q_known_for: "ship", q_style: "builder",
  });
  assert.ok(dims.product > dims.policy);
  const res = matchClubs(dims, [
    { id: "product", name: "Product", traits: { product: 1, strategy: 0.6, design: 0.4 } },
    { id: "mun", name: "MUN", traits: { policy: 1, communication: 0.8 } },
  ]);
  assert.equal(res[0]!.clubId, "product");
  assert.ok(res[0]!.score > res[1]!.score);
  assert.ok(res[0]!.reasons.length > 0);
});

test("opportunity match explains itself and penalises closed deadlines", () => {
  const s = { interests: ["product"], skills: [], careerGoals: [], dimensions: { product: 0.9 }, pastCategories: [], clubCategories: [] };
  const open = matchOpportunity(s, { id: "1", title: "x", category: "product_competition", tags: ["product"], deadline: new Date(Date.now() + 3 * 864e5) });
  const closed = matchOpportunity(s, { id: "2", title: "y", category: "product_competition", tags: ["product"], deadline: new Date(Date.now() - 864e5) });
  assert.ok(open.score > closed.score);
  assert.ok(open.reasons.some((r) => r.includes("product")));
});
