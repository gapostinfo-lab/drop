"use node";

import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";

// Action: Create or get Whop connected account and return portal URL
export const createPayoutPortalLink = action({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Please sign in");

    // First try the regular query (which uses getAuthUserId internally)
    let application = await ctx.runQuery(api.couriers.getMyApplication, {});

    if (!application) {
      // Fallback to internal query with subject
      application = await ctx.runQuery(internal.payouts.getCourierApplicationInternal, {
        userId: identity.subject,
      });
    }

    if (!application) {
      throw new Error("No courier application found. Please complete your courier profile first.");
    }

    if (application.status !== "approved") {
      throw new Error("Your courier application must be approved first");
    }

    const apiKey = process.env.WHOP_API_KEY;
    const parentCompanyId = process.env.WHOP_PARENT_COMPANY_ID;
    
    if (!apiKey || !parentCompanyId) {
      throw new Error("Payout system not configured. Please contact support.");
    }

    let companyId: string | undefined = application.whopConnectedAccountId;

    // Create connected account if doesn't exist
    if (!companyId) {
      const createResponse: Response = await fetch("https://api.whop.com/api/v1/companies", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: application.email,
          parent_company_id: parentCompanyId,
          title: `Droppit Courier - ${application.fullName}`,
          metadata: {
            courier_user_id: identity.subject,
            courier_name: application.fullName,
          },
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        
        // Parse error if it's JSON
        let errorMessage = "Failed to create payout account.";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          // Not JSON, use the raw text if it's short enough
          if (errorText.length < 200) {
            errorMessage = errorText;
          }
        }
        
        throw new Error(`Payout setup failed: ${errorMessage}`);
      }

      const company = await createResponse.json() as { id: string };
      companyId = company.id;

      // Save the company ID
      await ctx.runMutation(internal.payouts.saveWhopCompanyId, {
        applicationId: application._id,
        whopConnectedAccountId: companyId,
      });
    }

    // Create account link for payout portal
    const siteUrl = process.env.SITE_URL || "https://droppit.app";
    const linkResponse: Response = await fetch("https://api.whop.com/api/v1/account_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: companyId,
        use_case: "payouts_portal",
        return_url: `${siteUrl}/profile?payout_setup=complete`,
        refresh_url: `${siteUrl}/profile?payout_setup=refresh`,
      }),
    });

    if (!linkResponse.ok) {
      const errorText = await linkResponse.text();
      
      // Parse error if it's JSON
      let errorMessage = "Failed to open payout portal.";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        // Not JSON, use the raw text if it's short enough
        if (errorText.length < 200) {
          errorMessage = errorText;
        }
      }
      
      throw new Error(`Payout portal failed: ${errorMessage}`);
    }

    const link = await linkResponse.json() as { url: string };

    // Update status to pending
    await ctx.runMutation(internal.payouts.updatePayoutStatus, {
      applicationId: application._id,
      status: "pending",
    });

    return { url: link.url };
  },
});
