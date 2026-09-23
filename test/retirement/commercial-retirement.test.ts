import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(), graphql: vi.fn(), request: vi.fn(), require: vi.fn(), check: vi.fn(),
  updatePlanLimit: vi.fn(), unlockShop: vi.fn(), testMode: vi.fn(),
  findSubscription: vi.fn(), updateSubscription: vi.fn(), audit: vi.fn(),
}));
vi.mock("~/shopify.server", () => ({ authenticate: { admin: mocks.authenticate } }));
vi.mock("~/db.server", () => ({ default: {
  billingSubscription: { findUnique: mocks.findSubscription, update: mocks.updateSubscription },
  billingAuditLog: { create: mocks.audit },
} }));
vi.mock("~/utils/plan-access-control.server", () => ({ updatePlanLimit: mocks.updatePlanLimit, unlockShop: mocks.unlockShop }));
vi.mock("~/utils/billing-test-mode.server", () => ({ isTestMode: mocks.testMode, getTestMode: mocks.testMode }));
vi.mock("~/utils/billing-success-detection.server", () => ({ detectNewSubscription: vi.fn() }));
vi.mock("~/services/order-sync.service", () => ({ createOrderSyncService: vi.fn() }));
vi.mock("~/utils/order-count-strategies", () => ({ countOrdersWithFallback: vi.fn(), countOrdersDateExtraction: vi.fn(), getOrCreateMonthlyCount: vi.fn() }));

import { action as billingAction } from "~/routes/app.billing";
import { action as settingsAction } from "~/routes/app.settings";
import { action as graphqlAction, loader as graphqlLoader } from "~/routes/app.graphql-test";
import { createSubscription } from "~/services/billing/plan-subscription.server";
import { GraphQLBillingService } from "~/services/billing/graphql-billing.service";

const shop = "existing.myshopify.com";
function args(data: Record<string, string>) {
  return { request: new Request("https://example.test/app/billing", { method: "POST", body: new URLSearchParams(data) }) } as any;
}
beforeEach(() => {
  mocks.authenticate.mockResolvedValue({ session: { shop }, admin: { graphql: mocks.graphql }, billing: { request: mocks.request, require: mocks.require, check: mocks.check } });
  mocks.check.mockResolvedValue({ appSubscriptions: [] });
  mocks.graphql.mockResolvedValue({ json: async () => ({ data: { appSubscriptionCancel: { userErrors: [] } } }) });
  mocks.findSubscription.mockResolvedValue({ subscriptionId: "gid://shopify/AppSubscription/existing" });
});

describe("retired paid acquisition", () => {
  it.each(["pro", "pro-annual", "max", "max-annual", "ultra", "ultra-annual", "invented"])("rejects direct %s requests before provider calls or entitlement writes", async (plan) => {
    const response = await billingAction(args({ action: `subscribe-${plan}` }));
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ success: false, code: "NEW_PAID_SUBSCRIPTIONS_RETIRED" });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.graphql).not.toHaveBeenCalled();
    expect(mocks.updatePlanLimit).not.toHaveBeenCalled();
  });
  it("retains authentication before retirement", async () => {
    mocks.authenticate.mockResolvedValue({ session: null });
    await expect(billingAction(args({ action: "subscribe-pro" }))).rejects.toMatchObject({ status: 401 });
  });
  it("rejects crafted settings upgrade", async () => {
    const response = await settingsAction(args({ intent: "upgrade", plan: "RewardsPro Annual" }));
    expect(response.status).toBe(410);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.graphql).not.toHaveBeenCalled();
    expect(mocks.check).not.toHaveBeenCalled();
  });
  it("blocks both direct service entry points before test-mode resolution and writes", async () => {
    const direct = await createSubscription(shop, "pro", { request: mocks.request, require: mocks.require } as any, { graphql: mocks.graphql } as any);
    const graphql = await new GraphQLBillingService({ graphql: mocks.graphql } as any).createSubscription({ shop, planType: "max", isUpgrade: true });
    expect(direct).toMatchObject({ success: false, code: "NEW_PAID_SUBSCRIPTIONS_RETIRED" });
    expect(graphql).toMatchObject({ success: false, code: "NEW_PAID_SUBSCRIPTIONS_RETIRED" });
    for (const mock of [mocks.request, mocks.require, mocks.graphql, mocks.testMode, mocks.updateSubscription, mocks.updatePlanLimit, mocks.unlockShop]) expect(mock).not.toHaveBeenCalled();
  });
  it("keeps settings cancellation provider-backed", async () => {
    const response = await settingsAction(args({ intent: "cancel-subscription" }));
    expect(response.status).toBe(200);
    expect(mocks.graphql).toHaveBeenCalledWith(expect.stringContaining("appSubscriptionCancel"), expect.objectContaining({ variables: { id: "gid://shopify/AppSubscription/existing", prorate: false } }));
    expect(mocks.updateSubscription).toHaveBeenCalledWith({ where: { shop }, data: { subscriptionStatus: "CANCELLED" } });
    expect(mocks.audit).toHaveBeenCalledTimes(1);
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("does not record cancellation when the provider rejects it", async () => {
    mocks.graphql.mockResolvedValueOnce({ json: async () => ({ data: { appSubscriptionCancel: { userErrors: [{ message: "Provider refusal" }] } } }) });
    const response = await settingsAction(args({ intent: "cancel-subscription" }));
    expect(response.status).toBe(500);
    expect(mocks.updateSubscription).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

describe("GraphQL diagnostic route cannot bypass retirement", () => {
  it.each([
    "mutation { appSubscriptionCreate { confirmationUrl } }",
    "mutation { harmless: appPurchaseOneTimeCreate { confirmationUrl } }",
    "mutation { ...Purchase } fragment Purchase on Mutation { aliased: appSubscriptionLineItemUpdate { confirmationUrl } }",
    "# appSubscriptionCancel\nmutation { appSubscriptionCreate @skip(if: false) { confirmationUrl } }",
  ])("blocks parsed paid mutation: %s", async (query) => {
    const response = await graphqlAction(args({ query }));
    expect(response.status).toBe(410);
    expect(mocks.graphql).not.toHaveBeenCalled();
  });
  it.each([
    "query { currentAppInstallation { activeSubscriptions { id } } }",
    "mutation { appSubscriptionCancel(id: \"existing\") { userErrors { message } } }",
    "mutation { appUsageRecordCreate(subscriptionLineItemId: \"existing\") { userErrors { message } } }",
    "# appSubscriptionCreate\nquery { shop { name } }",
  ])("preserves existing management or settlement: %s", async (query) => {
    const response = await graphqlAction(args({ query }));
    expect(response.status).toBe(200);
    expect(mocks.graphql).toHaveBeenCalledWith(query);
  });
  it("rejects malformed GraphQL without contacting provider", async () => {
    const response = await graphqlAction(args({ query: "mutation {" }));
    expect(response.status).toBe(400);
    expect(mocks.graphql).not.toHaveBeenCalled();
  });
  it("removes paid creation examples while retaining cancellation and reads", async () => {
    const response = await graphqlLoader(args({}));
    const data = await response.json();
    const values = Object.values(data.exampleQueries).join("\n");
    expect(values).not.toContain("appSubscriptionCreate(");
    expect(values).toContain("appSubscriptionCancel(");
    expect(values).toContain("activeSubscriptions");
  });
});
