import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? '',
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
    )
  } catch (err) {
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 })
  }

  const getPlanFromPriceId = (priceId: string): string => {
    if (priceId === Deno.env.get('STRIPE_PRICE_MANAGER')) return 'manager'
    if (priceId === Deno.env.get('STRIPE_PRICE_CONSEILLERE')) return 'conseillere'
    return 'conseillere'
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      const userId = session.subscription_data?.metadata?.supabase_user_id
        ?? (session as any).metadata?.supabase_user_id
      const plan = session.subscription_data?.metadata?.plan ?? 'conseillere'

      if (userId) {
        await supabase.from('profiles').update({
          plan,
          plan_status: 'trialing',
          stripe_subscription_id: session.subscription as string,
        }).eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      const plan = getPlanFromPriceId((sub.items.data[0]?.price.id) ?? '')
      const status = sub.status === 'trialing' ? 'trialing'
        : sub.status === 'active' ? 'active'
        : sub.status === 'canceled' ? 'cancelled'
        : 'expired'

      if (userId) {
        await supabase.from('profiles').update({
          plan: status === 'cancelled' || status === 'expired' ? 'expired' : plan,
          plan_status: status,
          plan_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id

      if (userId) {
        await supabase.from('profiles').update({
          plan: 'expired',
          plan_status: 'expired',
          stripe_subscription_id: null,
        }).eq('id', userId)
      }
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
