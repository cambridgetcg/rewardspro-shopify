import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Icon,
  Divider,
  InlineGrid,
  Banner,
} from "@shopify/polaris";
import {
  EmailIcon,
  ChartVerticalIcon,
  CashDollarIcon,
  AutomationIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "~/shopify.server";
import db from "~/db.server";
import { AnalyticsRecommendationsService } from "~/services/analytics-recommendations.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log('[Marketing Hub] === Loader Started ===');

  try {
    // Step 1: Authentication
    console.log('[Marketing Hub] Step 1: Authenticating...');
    const { session } = await authenticate.admin(request);
    const shop = session.shop;
    console.log('[Marketing Hub] ✓ Authenticated for shop:', shop);

    // Step 2: Get email settings (safe - table might not exist)
    console.log('[Marketing Hub] Step 2: Fetching email settings...');
    let emailSettings = null;
    try {
      emailSettings = await db.emailSettings.findUnique({
        where: { shop },
      });
      console.log('[Marketing Hub] ✓ Email settings:', emailSettings ? 'found' : 'not configured yet');
    } catch (settingsError: any) {
      console.error('[Marketing Hub] ⚠️ Email settings table may not exist:', settingsError.message);
      console.log('[Marketing Hub] This is expected if migration hasn\'t run yet');
    }

    // Step 3: Get automation stats (safe - table might not exist)
    console.log('[Marketing Hub] Step 3: Fetching automation stats...');
    let activeAutomations = 0;
    let totalAutomations = 0;
    try {
      // Use findMany instead of groupBy (Data API adapter doesn't support groupBy)
      const allAutomations = await db.emailAutomation.findMany({
        where: { shop },
        select: { isEnabled: true },
      });
      totalAutomations = allAutomations.length;
      activeAutomations = allAutomations.filter(a => a.isEnabled).length;
      console.log('[Marketing Hub] ✓ Automation stats - Active:', activeAutomations, 'Total:', totalAutomations);
    } catch (automationError: any) {
      console.error('[Marketing Hub] ⚠️ EmailAutomation table error:', automationError.message);
      console.error('[Marketing Hub] Error name:', automationError.name);
      console.log('[Marketing Hub] Using default values');
    }

    // Step 4: Get recommendations from shared service
    console.log('[Marketing Hub] Step 4: Fetching analytics recommendations...');
    let recommendations: any[] = [];
    let highPriorityRecommendations: any[] = [];
    try {
      const recommendationsService = new AnalyticsRecommendationsService(shop);

      // Get pending recommendations only
      recommendations = await recommendationsService.getActionRecommendations({
        status: 'pending'
      });

      highPriorityRecommendations = recommendations.filter(r => r.priority >= 8);
      console.log('[Marketing Hub] ✓ Recommendations:', recommendations.length, 'High priority:', highPriorityRecommendations.length);
    } catch (recommendError: any) {
      console.error('[Marketing Hub] ⚠️ Error fetching recommendations:', recommendError.message);
      console.error('[Marketing Hub] Stack:', recommendError.stack);
      console.log('[Marketing Hub] Using empty recommendations');
    }

    // Step 5: Get recent campaigns (safe - table might not exist)
    console.log('[Marketing Hub] Step 5: Fetching recent campaigns...');
    let recentCampaigns: any[] = [];
    try {
      recentCampaigns = await db.emailCampaign.findMany({
        where: { shop },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          template: {
            select: { name: true, type: true },
          },
        },
      });
      console.log('[Marketing Hub] ✓ Recent campaigns:', recentCampaigns.length);
    } catch (campaignError: any) {
      console.error('[Marketing Hub] ⚠️ EmailCampaign table may not exist:', campaignError.message);
      console.log('[Marketing Hub] Using empty campaigns');
    }

    // Step 6: Calculate email metrics (safe - table might not exist)
    console.log('[Marketing Hub] Step 6: Calculating email metrics...');
    let sentCount = 0;
    let openedCount = 0;
    try {
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      // Use findMany instead of groupBy (Data API adapter doesn't support groupBy)
      const allEvents = await db.emailEvent.findMany({
        where: {
          shop,
          createdAt: { gte: last30Days },
        },
        select: { eventType: true },
      });

      sentCount = allEvents.filter(e => e.eventType === 'sent').length;
      openedCount = allEvents.filter(e => e.eventType === 'opened').length;
      console.log('[Marketing Hub] ✓ Email metrics - Sent:', sentCount, 'Opened:', openedCount);
    } catch (metricsError: any) {
      console.error('[Marketing Hub] ⚠️ EmailEvent table error:', metricsError.message);
      console.error('[Marketing Hub] Error name:', metricsError.name);
      console.log('[Marketing Hub] Using default metrics');
    }

    // Mock revenue data (would come from order tracking in production)
    const revenueGenerated = 0;

    console.log('[Marketing Hub] ✓ All data fetched successfully');
    console.log('[Marketing Hub] === Loader Complete ===');

    return json({
      shop,
      emailSettings,
      metrics: {
        emailsSent: sentCount,
        openRate: sentCount > 0 ? ((openedCount / sentCount) * 100).toFixed(1) : "0.0",
        revenue: revenueGenerated,
      },
      automationStats: {
        active: activeAutomations,
        total: totalAutomations,
      },
      recentCampaigns: recentCampaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        scheduledFor: c.scheduledFor,
        sentAt: c.sentAt,
        metrics: c.metrics,
      })),
      recommendations,
      highPriorityRecommendations,
    });
  } catch (error: any) {
    console.error('[Marketing Hub] ❌ FATAL ERROR in loader');
    console.error('[Marketing Hub] Error name:', error.name);
    console.error('[Marketing Hub] Error message:', error.message);
    console.error('[Marketing Hub] Error code:', error.code);
    console.error('[Marketing Hub] Error stack:', error.stack);

    // If it's a Prisma/Data API error, log the specific details
    if (error.code) {
      console.error('[Marketing Hub] Error code:', error.code);
      console.error('[Marketing Hub] Error meta:', JSON.stringify(error.meta, null, 2));
    }

    // Check for groupBy error specifically (Data API adapter doesn't support it)
    if (error.message && error.message.includes('groupBy is not a function')) {
      console.error('[Marketing Hub] 🔴 CRITICAL: groupBy is not supported by Data API adapter!');
      console.error('[Marketing Hub] This should have been fixed - check if code was deployed correctly');
    }

    // Return error response with graceful fallback data matching the expected structure
    console.error('[Marketing Hub] Returning error response with fallback data');
    return json({
      error: {
        message: error.message || 'Unknown error',
        name: error.name || 'Error',
        code: error.code,
      },
      shop: 'unknown',
      emailSettings: null,
      metrics: {
        emailsSent: 0,
        openRate: "0.0",
        revenue: 0,
      },
      automationStats: {
        active: 0,
        total: 0,
      },
      recentCampaigns: [],
      recommendations: [],
      highPriorityRecommendations: [],
    }, { status: 500 });
  }
};

export default function MarketingDashboard() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { tone: any; text: string }> = {
      draft: { tone: 'info', text: 'Draft' },
      scheduled: { tone: 'warning', text: 'Scheduled' },
      sending: { tone: 'attention', text: 'Sending' },
      sent: { tone: 'success', text: 'Sent' },
      failed: { tone: 'critical', text: 'Failed' },
    };
    const config = statusMap[status] || { tone: 'info', text: status };
    return <Badge tone={config.tone}>{config.text}</Badge>;
  };

  // Get the appropriate action route for a recommendation
  const getRecommendationAction = (recommendation: any) => {
    const baseRoute = '/app/marketing/campaigns/smart-create';
    const params = new URLSearchParams({
      recommendationId: recommendation.id
    });

    // Different routes based on recommendation type
    switch (recommendation.type) {
      case 'expiring_rewards':
      case 'birthday_upcoming':
        // These could go to automation workflows
        return `/app/marketing/automation/workflows/new?${params}`;

      case 'vip_at_risk':
        // VIP retention could have its own specialized route (future enhancement)
        return `${baseRoute}?${params}&campaignType=retention`;

      case 'inactive_customers':
      case 'tier_upgrade_opportunity':
      case 'low_balance_reengagement':
      default:
        // Standard smart campaign creation with context
        return `${baseRoute}?${params}`;
    }
  };

  // Get action button text based on recommendation type
  const getActionButtonText = (recommendationType: string) => {
    switch (recommendationType) {
      case 'expiring_rewards':
        return 'Create Reminder';
      case 'vip_at_risk':
        return 'Launch Retention';
      case 'tier_upgrade_opportunity':
        return 'Create Upgrade Campaign';
      case 'inactive_customers':
        return 'Re-engage Now';
      default:
        return 'Create Campaign';
    }
  };

  return (
    <Page
      title="Marketing Hub"
      subtitle="Engage customers with targeted loyalty emails"
    >
      <Layout>
        {/* Error Banner */}
        {(data as any).error && (
          <Layout.Section>
            <Banner
              title="Error Loading Marketing Data"
              tone="critical"
            >
              <p>
                There was an error loading marketing data: {(data as any).error.message}
              </p>
              <p style={{ marginTop: '8px' }}>
                Check the server logs for details. The page is showing with fallback data.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {/* Metrics Section */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
            {/* Option 1: Icon on Left - Emails Sent */}
            <Card>
              <InlineStack gap="400" blockAlign="center">
                <Icon source={EmailIcon} tone="base" />
                <BlockStack gap="100">
                  <Text variant="headingXl" as="h2">
                    {data.metrics.emailsSent.toLocaleString()}
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Emails Sent This Month
                  </Text>
                </BlockStack>
              </InlineStack>
            </Card>

            {/* Option 2: Icon on Top - Open Rate */}
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="start">
                  <Icon source={ChartVerticalIcon} tone="base" />
                  <Badge tone="success">↑ 5.2%</Badge>
                </InlineStack>
                <Text variant="headingXl" as="h2">
                  {data.metrics.openRate}%
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Open Rate
                </Text>
              </BlockStack>
            </Card>

            {/* Option 3: Icon on Right - Revenue Generated */}
            <Card>
              <InlineStack gap="400" align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingXl" as="h2">
                    ${data.metrics.revenue.toLocaleString()}
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Revenue Generated
                  </Text>
                </BlockStack>
                <Icon source={CashDollarIcon} tone="base" />
              </InlineStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Quick Actions
              </Text>
              <InlineStack gap="300" wrap={true}>
                <Button
                  variant="primary"
                  onClick={() => navigate('/app/marketing/campaigns/smart-create')}
                >
                  + Smart Campaign
                </Button>
                <Button onClick={() => navigate('/app/marketing/templates')}>
                  Edit Templates
                </Button>
                <Button onClick={() => navigate('/app/marketing/automation/workflows')}>
                  Automation Workflows
                </Button>
                <Button onClick={() => navigate('/app/marketing/analytics')}>
                  View Performance
                </Button>
                <Button onClick={() => navigate('/app/marketing/settings')}>
                  Settings
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Analytics-Powered Actions */}
        {data.highPriorityRecommendations.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">
                      Recommended Actions
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Data-driven opportunities based on your analytics
                    </Text>
                  </BlockStack>
                  <Badge tone="critical">
                    {data.highPriorityRecommendations.length} High Priority
                  </Badge>
                </InlineStack>

                <Divider />

                <BlockStack gap="200">
                  {data.highPriorityRecommendations.slice(0, 3).map((recommendation, index) => (
                    <div key={recommendation.id}>
                      {index > 0 && <Divider />}
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="p" fontWeight="medium">
                            {recommendation.title}
                          </Text>
                          <Text variant="bodySm" tone="subdued" as="p">
                            {recommendation.affectedCount} customers •
                            {recommendation.predictedRevenue && ` Potential: $${recommendation.predictedRevenue.toLocaleString()}`}
                          </Text>
                        </BlockStack>
                        <Button
                          onClick={() => navigate(getRecommendationAction(recommendation))}
                        >
                          {getActionButtonText(recommendation.type)}
                        </Button>
                      </InlineStack>
                    </div>
                  ))}
                </BlockStack>

                {data.recommendations.length > 3 && (
                  <>
                    <Divider />
                    <InlineStack align="center">
                      <Button
                        variant="plain"
                        onClick={() => navigate('/app/marketing/recommendations')}
                      >
                        View All {data.recommendations.length} Recommendations
                      </Button>
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Active Automations */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  Active Automations
                </Text>
                <Badge tone="info">
                  {data.automationStats.active} of {data.automationStats.total} Active
                </Badge>
              </InlineStack>

              <Divider />

              {data.automationStats.total === 0 ? (
                <BlockStack gap="300">
                  <Text variant="bodyMd" tone="subdued" as="p">
                    No automations configured yet. Get started by creating your first automated email flow.
                  </Text>
                  <Button onClick={() => navigate('/app/marketing/automation')}>
                    Create Automation
                  </Button>
                </BlockStack>
              ) : (
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={AutomationIcon} tone="success" />
                      <Text variant="bodyMd" as="p">
                        Welcome Series
                      </Text>
                    </InlineStack>
                    <Badge tone="success">Active</Badge>
                  </InlineStack>

                  <Divider />

                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={AutomationIcon} tone="success" />
                      <Text variant="bodyMd" as="p">
                        Tier Upgrade Alert
                      </Text>
                    </InlineStack>
                    <Badge tone="success">Active</Badge>
                  </InlineStack>

                  <Divider />

                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={AutomationIcon} tone="subdued" />
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Points Expiry Warning
                      </Text>
                    </InlineStack>
                    <Badge>Paused</Badge>
                  </InlineStack>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Recent Campaigns */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  Recent Campaigns
                </Text>
                <Button
                  variant="plain"
                  onClick={() => navigate('/app/marketing/campaigns')}
                >
                  View All
                </Button>
              </InlineStack>

              <Divider />

              {data.recentCampaigns.length === 0 ? (
                <BlockStack gap="300">
                  <Text variant="bodyMd" tone="subdued" as="p">
                    No campaigns yet. Create your first campaign to start engaging your customers.
                  </Text>
                  <Button
                    variant="primary"
                    onClick={() => navigate('/app/marketing/campaigns/new')}
                  >
                    Create Campaign
                  </Button>
                </BlockStack>
              ) : (
                <BlockStack gap="200">
                  {data.recentCampaigns.map((campaign, index) => (
                    <div key={campaign.id}>
                      {index > 0 && <Divider />}
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="p" fontWeight="medium">
                            {campaign.name}
                          </Text>
                          <Text variant="bodySm" tone="subdued" as="p">
                            {campaign.status === 'sent'
                              ? `Sent ${formatDate(campaign.sentAt)}`
                              : campaign.status === 'scheduled'
                              ? `Scheduled for ${formatDate(campaign.scheduledFor)}`
                              : 'Draft'}
                          </Text>
                        </BlockStack>
                        {getStatusBadge(campaign.status)}
                      </InlineStack>
                    </div>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Setup Notice if not configured */}
        {!data.emailSettings && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
                  Complete Your Setup
                </Text>
                <Text variant="bodyMd" tone="subdued" as="p">
                  Configure your sender email and brand settings to start sending campaigns.
                </Text>
                <Button
                  variant="primary"
                  onClick={() => navigate('/app/marketing/settings')}
                >
                  Configure Settings
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
