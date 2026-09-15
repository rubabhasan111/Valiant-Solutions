import type Stripe from "stripe";
import { after } from "next/server";
import { deliverPendingEmails } from "@/lib/email";
import { forgetEvent, handleStripeEvent, recordEvent } from "@/lib/stripe-events";
import { getStripe } from "@/lib/stripe";

// Receives Stripe events for connected accounts (payments, mandates, Checkout, account
// status) and routes each one to the workshop it belongs to. Every request must carry a
// valid Stripe signature.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set; rejecting webhook.");
    return Response.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing Stripe signature." }, { status: 400 });

  // The signature covers the exact raw body, so read it as text before parsing.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (!(await recordEvent(event))) return Response.json({ received: true, duplicate: true });

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error(`Handling Stripe event ${event.id} (${event.type}) failed:`, err);
    await forgetEvent(event.id);
    return Response.json({ error: "Event handling failed." }, { status: 500 });
  }

  // Send any emails the event queued, after Stripe has its response.
  after(() => deliverPendingEmails());
  return Response.json({ received: true });
}
