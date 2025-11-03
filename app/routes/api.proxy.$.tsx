// app/routes/api.proxy.$.tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const proxyPath = params["*"] || "";
  const url = new URL(request.url);
  
  // CORS headers for all responses
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };
  
  // Test endpoint
  if (proxyPath === "test") {
    return json({
      success: true,
      message: "API endpoint is working",
      timestamp: new Date().toISOString()
    }, { headers });
  }
  
  // Membership endpoint
  if (proxyPath === "membership") {
    console.log('[Proxy API] 🔵 Membership endpoint called');
    console.log('[Proxy API] 📍 Full URL:', request.url);
    console.log('[Proxy API] 🔍 All Query Params:', Object.fromEntries(url.searchParams));

    // Extract customer ID from various possible parameters
    const customerId = url.searchParams.get("logged_in_customer_id") ||
                      url.searchParams.get("customer_id") ||
                      url.searchParams.get("customerId") ||
                      url.searchParams.get("cid");

    const shop = url.searchParams.get("shop");

    console.log('[Proxy API] 🏪 Shop:', shop);
    console.log('[Proxy API] 👤 Customer ID:', customerId);
    
    // Handle non-logged-in users
    if (!customerId || customerId === "" || customerId === "null" || customerId === "undefined") {
      console.log('[Proxy API] 🔐 No customer ID - guest user');
      return json({
        success: false,
        requiresLogin: true,
        message: "Please log in to view your rewards",
        customer: null,
        balance: {
          storeCredit: 0,
          totalEarned: 0,
          lastSynced: null
        },
        membership: {
          tier: {
            id: "guest",
            name: "Guest",
            cashbackPercent: 1
          }
        }
      }, { 
        status: 200,
        headers 
      });
    }
    
    // Validate shop parameter
    if (!shop) {
      console.error('[Proxy API] ❌ Missing shop parameter');
      return json({
        success: false,
        error: "Missing shop parameter",
        message: "Invalid request - shop parameter required",
        requiresLogin: false
      }, { status: 400, headers });
    }
    
    try {
      console.log('[Proxy API] 🔍 Querying database for customer...');
      console.log('[Proxy API] 📊 Query params:', {
        shopDomain: shop,
        shopifyCustomerId: customerId
      });

      // Find or create customer
      let customer = await prisma.customer.findUnique({
        where: {
          shopDomain_shopifyCustomerId: {
            shopDomain: shop,
            shopifyCustomerId: customerId
          }
        },
        include: {
          membershipHistory: {
            where: { isActive: true },
            include: { tier: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      console.log('[Proxy API] 📥 Customer found in database:', customer ? 'YES' : 'NO');

      if (customer) {
        console.log('[Proxy API] 👤 Customer details:', {
          id: customer.id,
          shopifyCustomerId: customer.shopifyCustomerId,
          email: customer.email,
          storeCredit: customer.storeCredit,
          totalEarned: customer.totalEarned,
          totalCashbackEarned: customer.totalCashbackEarned,
          membershipHistoryCount: customer.membershipHistory?.length || 0
        });

        // DEBUG: Log raw customer object
        console.log('[Proxy API] 🔬 RAW Customer Object:', JSON.stringify(customer, null, 2));

        // DEBUG: Log membership history details
        if (customer.membershipHistory && customer.membershipHistory.length > 0) {
          console.log('[Proxy API] 📋 Membership History Details:', {
            count: customer.membershipHistory.length,
            firstEntry: {
              id: customer.membershipHistory[0].id,
              tierId: customer.membershipHistory[0].tierId,
              isActive: customer.membershipHistory[0].isActive,
              hasTier: !!customer.membershipHistory[0].tier,
              tierData: customer.membershipHistory[0].tier ? {
                id: customer.membershipHistory[0].tier.id,
                name: customer.membershipHistory[0].tier.name,
                cashbackPercent: customer.membershipHistory[0].tier.cashbackPercent
              } : null
            }
          });
        } else {
          console.log('[Proxy API] ⚠️ NO MEMBERSHIP HISTORY FOUND FOR EXISTING CUSTOMER');
        }
      }
      
      // Return default data if customer doesn't exist (don't auto-create)
      if (!customer) {
        console.log('[Proxy API] ⚠️ Customer not found in database');
        console.log('[Proxy API] ℹ️ Returning default Bronze tier data without creating database record');
        console.log('[Proxy API] 💡 Customer will be created when:');
        console.log('[Proxy API]    1. Shopify fires customer/create webhook, or');
        console.log('[Proxy API]    2. Merchant runs customer sync from admin');

        // Get default tier (lowest tier) to return in response
        const defaultTier = await prisma.tier.findFirst({
          where: {
            shopDomain: shop,
            isActive: true
          },
          orderBy: {
            minSpend: 'asc'
          }
        });

        // If no tiers exist at all, return a hardcoded Bronze response
        if (!defaultTier) {
          console.log('[Proxy API] ⚠️ No tiers configured for shop, returning hardcoded Bronze data');
          return json({
            success: true,
            customer: {
              id: customerId,
              shopifyCustomerId: customerId,
              email: `customer${customerId}@${shop}`, // Temporary display only
              firstName: null,
              lastName: null,
            },
            balance: {
              storeCredit: 0,
              totalEarned: 0,
              totalCashbackEarned: 0
            },
            membership: {
              tier: {
                id: 'default-bronze',
                name: 'Bronze',
                cashbackPercent: 1,
                minSpend: 0
              }
            },
            needsSync: true, // Flag indicating customer needs to be synced
            message: 'Customer not found in database. Please run customer sync from admin.'
          });
        }

        // Return default tier data without creating customer
        console.log('[Proxy API] ✅ Returning default tier:', defaultTier.name);
        return json({
          success: true,
          customer: {
            id: customerId,
            shopifyCustomerId: customerId,
            email: `customer${customerId}@${shop}`, // Temporary display only
            firstName: null,
            lastName: null,
          },
          balance: {
            storeCredit: 0,
            totalEarned: 0,
            totalCashbackEarned: 0
          },
          membership: {
            tier: {
              id: defaultTier.id,
              name: defaultTier.name,
              cashbackPercent: Number(defaultTier.cashbackPercent),
              minSpend: Number(defaultTier.minSpend)
            }
          },
          needsSync: true, // Flag indicating customer needs to be synced
          message: 'Customer not found in database. Please run customer sync from admin.'
        });
      }

      // Get current tier from membership history
      let currentMembership = customer.membershipHistory[0];
      let currentTier = currentMembership?.tier;

      console.log('[Proxy API] 🎖️ Current membership from history:', {
        hasMembership: !!currentMembership,
        tierName: currentTier?.name,
        tierCashback: currentTier?.cashbackPercent
      });

      // FALLBACK: If no tier found in membership history, try to find/assign one
      if (!currentTier) {
        console.log('[Proxy API] ⚠️ No tier in membership history, starting fallback logic...');
        console.log('[Proxy API] 🔍 Customer data for tier lookup:', {
          customerId: customer.id,
          totalSpent: customer.totalSpent,
          storeCredit: customer.storeCredit,
          totalCashbackEarned: customer.totalCashbackEarned
        });

        // Try to find the appropriate tier based on customer spending from database
        const customerSpending = Number(customer.totalSpent || 0);

        console.log('[Proxy API] 💰 Customer spending for tier evaluation:', {
          fromDatabase: customer.totalSpent,
          usingValue: customerSpending
        });

        console.log('[Proxy API] 🔎 Searching for tier with criteria:', {
          shopDomain: shop,
          isActive: true,
          minSpend_lte: customerSpending
        });

        let assignedTier = await prisma.tier.findFirst({
          where: {
            shopDomain: shop,
            isActive: true,
            minSpend: { lte: customerSpending }
          },
          orderBy: {
            minSpend: 'desc'
          }
        });

        console.log('[Proxy API] 🔍 Tier lookup result:', {
          customerSpending,
          foundTier: assignedTier?.name || 'NONE',
          tierDetails: assignedTier ? {
            id: assignedTier.id,
            name: assignedTier.name,
            minSpend: assignedTier.minSpend,
            cashbackPercent: assignedTier.cashbackPercent
          } : null
        });

        // If still no tier, get the default (lowest minSpend) tier
        if (!assignedTier) {
          console.log('[Proxy API] 🔍 No tier found by spending, getting default tier...');

          // First, let's check ALL tiers for this shop for debugging
          const allTiers = await prisma.tier.findMany({
            where: { shopDomain: shop }
          });

          console.log('[Proxy API] 📦 ALL TIERS IN DATABASE for shop:', {
            shop,
            count: allTiers.length,
            tiers: allTiers.map(t => ({
              id: t.id,
              name: t.name,
              minSpend: t.minSpend,
              cashbackPercent: t.cashbackPercent,
              isActive: t.isActive
            }))
          });

          assignedTier = await prisma.tier.findFirst({
            where: {
              shopDomain: shop,
              isActive: true
            },
            orderBy: {
              minSpend: 'asc'
            }
          });

          if (assignedTier) {
            console.log('[Proxy API] ✅ Default tier found:', {
              id: assignedTier.id,
              name: assignedTier.name,
              minSpend: assignedTier.minSpend,
              cashbackPercent: assignedTier.cashbackPercent
            });
          }
        }

        // If still no tier, create Bronze tier
        if (!assignedTier) {
          console.log('[Proxy API] ➕ No tier exists, creating Bronze tier...');
          assignedTier = await prisma.tier.create({
            data: {
              shopDomain: shop,
              name: "Bronze",
              minSpend: 0,
              cashbackPercent: 1,
              isActive: true,
              evaluationPeriod: "ANNUAL"
            }
          });
          console.log('[Proxy API] ✅ Bronze tier created:', assignedTier.id);
        }

        // Create membership history for this customer
        if (assignedTier) {
          console.log('[Proxy API] ➕ Creating membership history for customer:', {
            customerId: customer.id,
            tierId: assignedTier.id,
            tierName: assignedTier.name
          });

          try {
            currentMembership = await prisma.membershipHistory.create({
              data: {
                customerId: customer.id,
                tierId: assignedTier.id,
                isActive: true,
                assignmentType: "AUTOMATIC"
              },
              include: {
                tier: true
              }
            });

            console.log('[Proxy API] ✅ Membership history created successfully:', {
              membershipId: currentMembership.id,
              tierId: currentMembership.tierId,
              isActive: currentMembership.isActive,
              tierName: currentMembership.tier?.name,
              tierCashback: currentMembership.tier?.cashbackPercent
            });

            currentTier = currentMembership.tier;
          } catch (error) {
            console.error('[Proxy API] ❌ Failed to create membership history:', error);
            console.error('[Proxy API] ❌ Error details:', {
              message: error.message,
              code: error.code,
              meta: error.meta
            });
          }
        } else {
          console.log('[Proxy API] ⚠️ No tier available to assign - this should not happen!');
        }
      }

      // Final data validation before response
      console.log('[Proxy API] 📊 Final data check before response:', {
        hasCustomer: !!customer,
        customerId: customer?.id,
        storeCredit: customer?.storeCredit,
        storeCreditType: typeof customer?.storeCredit,
        totalEarned: customer?.totalEarned,
        totalEarnedType: typeof customer?.totalEarned,
        totalCashbackEarned: customer?.totalCashbackEarned,
        totalCashbackEarnedType: typeof customer?.totalCashbackEarned,
        totalSpent: customer?.totalSpent,
        membershipHistoryLength: customer?.membershipHistory?.length,
        hasMembership: !!currentMembership,
        currentTierName: currentTier?.name || 'NO_TIER',
        currentTierCashback: currentTier?.cashbackPercent || 'NO_CASHBACK',
        currentTierCashbackType: typeof currentTier?.cashbackPercent,
        currentTierId: currentTier?.id || 'NO_ID',
        tierObjectExists: !!currentTier,
        membershipObjectExists: !!currentMembership
      });

      const responseData = {
        success: true,
        customer: {
          id: customer.id,
          shopifyId: customer.shopifyCustomerId,
          email: customer.email,
          memberSince: customer.createdAt.toISOString()
        },
        balance: {
          storeCredit: Number(customer.storeCredit || 0),
          totalEarned: Number(customer.totalCashbackEarned || customer.totalEarned || 0),
          lastSynced: customer.lastSyncedAt?.toISOString() || null
        },
        membership: {
          tier: currentTier ? {
            id: currentTier.id,
            name: currentTier.name,
            cashbackPercent: Number(currentTier.cashbackPercent)
          } : {
            id: "default",
            name: "Bronze",
            cashbackPercent: 1
          }
        }
      };

      console.log('[Proxy API] ✅ Returning response:', JSON.stringify(responseData, null, 2));

      // DEBUG: Extra validation before returning
      console.log('[Proxy API] 🎯 FINAL RESPONSE VALUES:', {
        'tier.name': responseData.membership.tier.name,
        'tier.cashbackPercent': responseData.membership.tier.cashbackPercent,
        'balance.storeCredit': responseData.balance.storeCredit,
        'balance.totalEarned': responseData.balance.totalEarned,
        'customerEmail': responseData.customer.email
      });

      return json(responseData, { headers });
      
    } catch (error) {
      console.error('[Proxy API] ❌ Database error:', error);
      console.error('[Proxy API] ❌ Error stack:', error.stack);
      
      // Return error with fallback data
      return json({
        success: false,
        error: "Database error",
        message: "Unable to load rewards data. Please try again later.",
        requiresLogin: false,
        customer: {
          id: "error",
          shopifyId: customerId,
          email: ""
        },
        balance: { 
          storeCredit: 0, 
          totalEarned: 0,
          lastSynced: null
        },
        membership: { 
          tier: { 
            id: "error",
            name: "Bronze", 
            cashbackPercent: 1 
          }
        }
      }, { status: 500, headers });
    }
  }
  
  // 404 for unknown paths
  return json({
    success: false,
    error: "Not found",
    message: `Endpoint '${proxyPath}' not found`,
    availablePaths: ["test", "membership"]
  }, { status: 404, headers });
}

// Handle OPTIONS requests for CORS
export async function action({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  
  return json({ error: "Method not allowed" }, { status: 405 });
}