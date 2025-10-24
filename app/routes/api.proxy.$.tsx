// app/routes/api.proxy.$.tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

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
            take: 1
          }
        }
      });

      console.log('[Proxy API] 📥 Customer found:', customer ? 'YES' : 'NO');
      if (customer) {
        console.log('[Proxy API] 👤 Customer details:', {
          id: customer.id,
          shopifyCustomerId: customer.shopifyCustomerId,
          email: customer.email,
          storeCredit: customer.storeCredit,
          totalEarned: customer.totalEarned,
          membershipHistoryCount: customer.membershipHistory?.length || 0
        });
      }
      
      // Create new customer if doesn't exist
      if (!customer) {
        console.log('[Proxy API] ➕ Customer not found, creating new customer...');

        // Get or create default tier
        let defaultTier = await prisma.tier.findFirst({
          where: {
            shopDomain: shop,
            isActive: true
          },
          orderBy: {
            minSpend: 'asc'
          }
        });

        console.log('[Proxy API] 🎖️ Default tier found:', defaultTier ? 'YES' : 'NO');
        if (defaultTier) {
          console.log('[Proxy API] 🎖️ Tier details:', {
            id: defaultTier.id,
            name: defaultTier.name,
            minSpend: defaultTier.minSpend,
            cashbackPercent: defaultTier.cashbackPercent
          });
        }
        
        if (!defaultTier) {
          console.log('[Proxy API] ➕ No tier found, creating Bronze tier...');
          defaultTier = await prisma.tier.create({
            data: {
              shopDomain: shop,
              name: "Bronze",
              minSpend: 0,
              cashbackPercent: 1,
              isActive: true,
              evaluationPeriod: "ANNUAL"
            }
          });
          console.log('[Proxy API] ✅ Bronze tier created:', defaultTier.id);
        }
        
        // Create customer with membership
        console.log('[Proxy API] ➕ Creating customer with tier:', defaultTier.id);
        customer = await prisma.customer.create({
          data: {
            shopDomain: shop,
            shopifyCustomerId: customerId,
            email: `customer${customerId}@${shop}`,
            storeCredit: 0,
            totalEarned: 0,
            membershipHistory: {
              create: {
                tierId: defaultTier.id,
                isActive: true,
                assignmentType: "AUTOMATIC"
              }
            }
          },
          include: {
            membershipHistory: {
              where: { isActive: true },
              include: { tier: true },
              take: 1
            }
          }
        });
        console.log('[Proxy API] ✅ Customer created successfully:', customer.id);
      }
      
      // Get current tier
      const currentMembership = customer.membershipHistory[0];
      const currentTier = currentMembership?.tier;

      console.log('[Proxy API] 🎖️ Current membership:', {
        hasMembership: !!currentMembership,
        tierName: currentTier?.name,
        tierCashback: currentTier?.cashbackPercent
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
          storeCredit: customer.storeCredit,
          totalEarned: customer.totalEarned,
          lastSynced: customer.lastSyncedAt?.toISOString() || null
        },
        membership: {
          tier: currentTier ? {
            id: currentTier.id,
            name: currentTier.name,
            cashbackPercent: currentTier.cashbackPercent
          } : {
            id: "default",
            name: "Bronze",
            cashbackPercent: 1
          }
        }
      };

      console.log('[Proxy API] ✅ Returning response:', JSON.stringify(responseData, null, 2));

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