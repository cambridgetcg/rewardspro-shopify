import { parse, visit } from "graphql";

// Inspect field names in the parsed document, including aliases and fragments.
// Cancellation, reads and settlement of existing usage remain available.
const retiredFields = new Set([
  "appSubscriptionCreate",
  "appPurchaseOneTimeCreate",
  "appSubscriptionLineItemUpdate",
]);

export function hasRetiredBillingMutation(query: string): boolean {
  let retired = false;
  visit(parse(query), {
    Field(node) {
      if (retiredFields.has(node.name.value)) retired = true;
    },
  });
  return retired;
}
