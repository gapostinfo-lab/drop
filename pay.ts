import { Surpay } from "@surgent/pay-convex"

const pay = new Surpay({
  apiKey: process.env.SURGENT_API_KEY!,
  identify: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return {
      customerId: identity.subject,
      customerData: {
        name: identity.name,
        email: identity.email,
      },
    }
  },
})

export const {
  createCheckout,
  guestCheckout,
  check,
  listProducts,
  getCustomer,
  listSubscriptions,
} = pay.api()
