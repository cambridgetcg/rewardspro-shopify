import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import { PAID_SUBSCRIPTIONS_RETIRED_MESSAGE } from "~/constants/commercial-retirement";

export const meta: MetaFunction = () => [
  { title: "RewardsPro — existing service" },
  { name: "description", content: "Existing RewardsPro subscription and reward records. New paid subscriptions are retired." },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function LandingPage() {
  const { showForm } = useLoaderData<typeof loader>();
  return <main style={{ maxWidth: 680, margin: "4rem auto", padding: "1.5rem", fontFamily: "system-ui", lineHeight: 1.6 }}>
    <h1>RewardsPro</h1>
    <p>{PAID_SUBSCRIPTIONS_RETIRED_MESSAGE}</p>
    <p>Existing reward balances, order records and billing agreements remain available. Existing terms and usage limits continue to apply.</p>
    {showForm && <Form method="post" action="/auth/login">
      <label htmlFor="shop">Existing shop domain</label>{" "}
      <input id="shop" name="shop" type="text" placeholder="your-shop.myshopify.com" required />{" "}
      <button type="submit">Open existing shop</button>
    </Form>}
  </main>;
}
