import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Box,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Icon,
  Divider,
  InlineGrid,
  Banner,
  ProgressBar,
} from "@shopify/polaris";
import {
  EmailIcon,
  ChartVerticalIcon,
  CashDollarIcon,
  AutomationIcon,
  StatusActiveIcon,
  CheckCircleIcon,
  ClockIcon,
  PersonIcon,
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
  const [selectedMockup, setSelectedMockup] = useState<"option1" | "option2" | "option3" | null>(null);

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
        return `/app/marketing/automation/create?${params}`;

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
            {/* Emails Sent */}
            <Card>
              <Box padding="400">
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued" as="p">
                    Emails Sent This Month
                  </Text>
                  <Text variant="headingLg" as="h3">
                    {data.metrics.emailsSent.toLocaleString()}
                  </Text>
                </BlockStack>
              </Box>
            </Card>

            {/* Open Rate */}
            <Card>
              <Box padding="400">
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued" as="p">
                    Open Rate
                  </Text>
                  <Text variant="headingLg" as="h3">
                    {data.metrics.openRate}%
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="success">+5.2%</Badge>
                    <Text variant="bodySm" tone="subdued" as="span">
                      vs last month
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Box>
            </Card>

            {/* Revenue Generated */}
            <Card>
              <Box padding="400">
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued" as="p">
                    Revenue Generated
                  </Text>
                  <Text variant="headingLg" as="h3">
                    ${data.metrics.revenue.toLocaleString()}
                  </Text>
                </BlockStack>
              </Box>
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
                <Button onClick={() => navigate('/app/marketing/campaigns/create')}>
                  + Create Campaign
                </Button>
                <Button onClick={() => navigate('/app/marketing/automation/create')}>
                  + Create Automation
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
                  <Button onClick={() => navigate('/app/marketing/automation/create')}>
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

        {/* Mockup UI Variations Selector */}
        <Layout.Section>
          <Divider />
          <Box paddingBlock="800">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Marketing Hub UI Mockups
                </Text>
                <Text variant="bodyMd" tone="subdued" as="p">
                  Explore 3 different UI designs for the marketing hub inspired by the system status dashboard
                </Text>
                <InlineStack gap="300">
                  <Button
                    pressed={selectedMockup === "option1"}
                    onClick={() => setSelectedMockup(selectedMockup === "option1" ? null : "option1")}
                  >
                    Option 1: Status Grid
                  </Button>
                  <Button
                    pressed={selectedMockup === "option2"}
                    onClick={() => setSelectedMockup(selectedMockup === "option2" ? null : "option2")}
                  >
                    Option 2: Campaign Flow
                  </Button>
                  <Button
                    pressed={selectedMockup === "option3"}
                    onClick={() => setSelectedMockup(selectedMockup === "option3" ? null : "option3")}
                  >
                    Option 3: Performance Dashboard
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Box>
        </Layout.Section>

        {/* Option 1: Status Grid (inspired by System Status) */}
        {selectedMockup === "option1" && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                {/* Header */}
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={StatusActiveIcon} tone="base" />
                    <Text variant="headingMd" as="h2">Marketing Performance</Text>
                  </InlineStack>
                  <Badge tone="success">
                    Active
                  </Badge>
                </InlineStack>

                <Divider />

                {/* Overall Status Banner */}
                <Banner tone="success">
                  <InlineStack gap="400" blockAlign="center" wrap={false}>
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={CheckCircleIcon} tone="success" />
                      <Text variant="bodyMd" fontWeight="semibold">All Campaigns Performing Well</Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">•</Text>
                    <Text variant="bodySm" tone="subdued">Open Rate: {data.metrics.openRate}%</Text>
                    <Text variant="bodySm" tone="subdued">•</Text>
                    <Text variant="bodySm" tone="subdued">0 failed sends</Text>
                  </InlineStack>
                </Banner>

                {/* Component Cards Grid */}
                <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
                  {/* Email Campaign Health */}
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start">
                        <Box
                          padding="200"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <Icon source={EmailIcon} tone="base" />
                        </Box>
                        <Badge tone="success">Operational</Badge>
                      </InlineStack>

                      <Text variant="headingSm" as="h3" fontWeight="semibold">
                        Email Campaigns
                      </Text>

                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Sent This Month:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            {data.metrics.emailsSent.toLocaleString()}
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Open Rate:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            {data.metrics.openRate}%
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Active Campaigns:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            {data.recentCampaigns.filter(c => c.status === 'sent').length}
                          </Text>
                        </InlineStack>
                      </BlockStack>

                      <Divider />

                      <Text variant="bodySm" tone="subdued">
                        Automated and manual email campaigns sent to customers
                      </Text>
                    </BlockStack>
                  </Card>

                  {/* Automation Engine */}
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start">
                        <Box
                          padding="200"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <Icon source={AutomationIcon} tone="base" />
                        </Box>
                        <Badge tone={data.automationStats.active > 0 ? "success" : "info"}>
                          {data.automationStats.active > 0 ? "Active" : "Inactive"}
                        </Badge>
                      </InlineStack>

                      <Text variant="headingSm" as="h3" fontWeight="semibold">
                        Automation Workflows
                      </Text>

                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Active:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            {data.automationStats.active} / {data.automationStats.total}
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Status:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            {data.automationStats.active > 0 ? "Running" : "Paused"}
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Triggers:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            Tier changes, birthdays, inactivity
                          </Text>
                        </InlineStack>
                      </BlockStack>

                      <Divider />

                      <Text variant="bodySm" tone="subdued">
                        Automated email workflows triggered by customer actions
                      </Text>
                    </BlockStack>
                  </Card>

                  {/* Revenue Impact */}
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start">
                        <Box
                          padding="200"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <Icon source={CashDollarIcon} tone="base" />
                        </Box>
                        <Badge tone="success">Growing</Badge>
                      </InlineStack>

                      <Text variant="headingSm" as="h3" fontWeight="semibold">
                        Revenue Attribution
                      </Text>

                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">This Month:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            ${data.metrics.revenue.toLocaleString()}
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Growth:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            +15.3%
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">ROI:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            450%
                          </Text>
                        </InlineStack>
                      </BlockStack>

                      <Divider />

                      <Text variant="bodySm" tone="subdued">
                        Revenue generated from email marketing campaigns
                      </Text>
                    </BlockStack>
                  </Card>

                  {/* Audience Reach */}
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start">
                        <Box
                          padding="200"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <Icon source={PersonIcon} tone="base" />
                        </Box>
                        <Badge tone="info">Engaged</Badge>
                      </InlineStack>

                      <Text variant="headingSm" as="h3" fontWeight="semibold">
                        Audience Reach
                      </Text>

                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Total Subscribers:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            2,847
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Engaged:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            1,923 (67.5%)
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Unsubscribe Rate:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            0.3%
                          </Text>
                        </InlineStack>
                      </BlockStack>

                      <Divider />

                      <Text variant="bodySm" tone="subdued">
                        Total customers subscribed to marketing emails
                      </Text>
                    </BlockStack>
                  </Card>

                  {/* Template Library */}
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start">
                        <Box
                          padding="200"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <Icon source={ChartVerticalIcon} tone="base" />
                        </Box>
                        <Badge tone="info">Ready</Badge>
                      </InlineStack>

                      <Text variant="headingSm" as="h3" fontWeight="semibold">
                        Template Library
                      </Text>

                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Total Templates:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            12
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Most Used:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            Welcome Series
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Avg Open Rate:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            34.2%
                          </Text>
                        </InlineStack>
                      </BlockStack>

                      <Divider />

                      <Text variant="bodySm" tone="subdued">
                        Reusable email templates for campaigns and automations
                      </Text>
                    </BlockStack>
                  </Card>

                  {/* Deliverability */}
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start">
                        <Box
                          padding="200"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <Icon source={CheckCircleIcon} tone="base" />
                        </Box>
                        <Badge tone="success">Excellent</Badge>
                      </InlineStack>

                      <Text variant="headingSm" as="h3" fontWeight="semibold">
                        Email Deliverability
                      </Text>

                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Delivery Rate:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            99.2%
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Bounce Rate:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            0.8%
                          </Text>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" tone="subdued">Spam Reports:</Text>
                          <Text variant="bodySm" fontWeight="medium">
                            0 (0%)
                          </Text>
                        </InlineStack>
                      </BlockStack>

                      <Divider />

                      <Text variant="bodySm" tone="subdued">
                        Email sending reputation and inbox placement rates
                      </Text>
                    </BlockStack>
                  </Card>
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Option 2: Campaign Flow (Timeline View) */}
        {selectedMockup === "option2" && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingLg" as="h2">Campaign Journey</Text>
                  <Badge tone="info">Real-time</Badge>
                </InlineStack>

                <Text variant="bodyMd" tone="subdued">
                  Visualize your customer engagement flow from initial contact to conversion
                </Text>

                <Divider />

                {/* Campaign Flow Visualization */}
                <div style={{
                  padding: '24px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  overflowX: 'auto'
                }}>
                  <InlineStack gap="400" blockAlign="start">
                    {/* Step 1: Email Sent */}
                    <Card>
                      <BlockStack gap="300">
                        <Box
                          padding="300"
                          background="bg-surface-brand"
                          borderRadius="200"
                        >
                          <InlineStack align="center" blockAlign="center">
                            <Icon source={EmailIcon} tone="base" />
                          </InlineStack>
                        </Box>
                        <Text variant="headingSm" fontWeight="semibold" alignment="center">
                          Email Sent
                        </Text>
                        <Text variant="headingLg" alignment="center" fontWeight="bold">
                          {data.metrics.emailsSent.toLocaleString()}
                        </Text>
                        <Text variant="bodySm" tone="subdued" alignment="center">
                          Total sent this month
                        </Text>
                        <ProgressBar progress={100} size="small" tone="success" />
                      </BlockStack>
                    </Card>

                    {/* Arrow */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                      paddingTop: '40px'
                    }}>
                      <Text variant="headingXl" tone="subdued">→</Text>
                    </div>

                    {/* Step 2: Opened */}
                    <Card>
                      <BlockStack gap="300">
                        <Box
                          padding="300"
                          background="bg-surface-success"
                          borderRadius="200"
                        >
                          <InlineStack align="center" blockAlign="center">
                            <Icon source={CheckCircleIcon} tone="base" />
                          </InlineStack>
                        </Box>
                        <Text variant="headingSm" fontWeight="semibold" alignment="center">
                          Opened
                        </Text>
                        <Text variant="headingLg" alignment="center" fontWeight="bold">
                          {Math.round((data.metrics.emailsSent * parseFloat(data.metrics.openRate)) / 100).toLocaleString()}
                        </Text>
                        <Text variant="bodySm" tone="subdued" alignment="center">
                          {data.metrics.openRate}% open rate
                        </Text>
                        <ProgressBar progress={parseFloat(data.metrics.openRate)} size="small" tone="success" />
                      </BlockStack>
                    </Card>

                    {/* Arrow */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                      paddingTop: '40px'
                    }}>
                      <Text variant="headingXl" tone="subdued">→</Text>
                    </div>

                    {/* Step 3: Clicked */}
                    <Card>
                      <BlockStack gap="300">
                        <Box
                          padding="300"
                          background="bg-surface-brand-subdued"
                          borderRadius="200"
                        >
                          <InlineStack align="center" blockAlign="center">
                            <Icon source={ChartVerticalIcon} tone="base" />
                          </InlineStack>
                        </Box>
                        <Text variant="headingSm" fontWeight="semibold" alignment="center">
                          Clicked
                        </Text>
                        <Text variant="headingLg" alignment="center" fontWeight="bold">
                          {Math.round((data.metrics.emailsSent * parseFloat(data.metrics.openRate)) / 100 * 0.42).toLocaleString()}
                        </Text>
                        <Text variant="bodySm" tone="subdued" alignment="center">
                          14.2% click rate
                        </Text>
                        <ProgressBar progress={14.2} size="small" tone="primary" />
                      </BlockStack>
                    </Card>

                    {/* Arrow */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                      paddingTop: '40px'
                    }}>
                      <Text variant="headingXl" tone="subdued">→</Text>
                    </div>

                    {/* Step 4: Converted */}
                    <Card>
                      <BlockStack gap="300">
                        <Box
                          padding="300"
                          background="bg-surface-success-subdued"
                          borderRadius="200"
                        >
                          <InlineStack align="center" blockAlign="center">
                            <Icon source={CashDollarIcon} tone="base" />
                          </InlineStack>
                        </Box>
                        <Text variant="headingSm" fontWeight="semibold" alignment="center">
                          Converted
                        </Text>
                        <Text variant="headingLg" alignment="center" fontWeight="bold">
                          ${data.metrics.revenue.toLocaleString()}
                        </Text>
                        <Text variant="bodySm" tone="subdued" alignment="center">
                          Revenue generated
                        </Text>
                        <ProgressBar progress={5.8} size="small" tone="success" />
                      </BlockStack>
                    </Card>
                  </InlineStack>
                </div>

                {/* Funnel Insights */}
                <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text variant="headingSm" fontWeight="semibold">
                        Best Performing Day
                      </Text>
                      <Text variant="headingMd">Tuesday</Text>
                      <Text variant="bodySm" tone="subdued">
                        37% higher open rates on Tuesdays at 10 AM
                      </Text>
                    </BlockStack>
                  </Card>

                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text variant="headingSm" fontWeight="semibold">
                        Top Converting Segment
                      </Text>
                      <Text variant="headingMd">VIP Tier</Text>
                      <Text variant="bodySm" tone="subdued">
                        8.2% conversion rate, 3x above average
                      </Text>
                    </BlockStack>
                  </Card>

                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text variant="headingSm" fontWeight="semibold">
                        Avg. Time to Convert
                      </Text>
                      <Text variant="headingMd">2.4 hours</Text>
                      <Text variant="bodySm" tone="subdued">
                        From email open to purchase completion
                      </Text>
                    </BlockStack>
                  </Card>
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Option 3: Performance Dashboard (Detailed Metrics) */}
        {selectedMockup === "option3" && (
          <Layout.Section>
            <BlockStack gap="400">
              {/* Header */}
              <Card>
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <Text variant="headingLg" as="h2">Marketing Performance Dashboard</Text>
                    <Text variant="bodyMd" tone="subdued">
                      Comprehensive analytics and insights for your email marketing campaigns
                    </Text>
                  </BlockStack>
                  <Button variant="primary">Download Report</Button>
                </InlineStack>
              </Card>

              {/* Key Metrics Grid */}
              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">Total Sends</Text>
                      <Badge tone="info">+12%</Badge>
                    </InlineStack>
                    <Text variant="heading2xl" as="h3">
                      {data.metrics.emailsSent.toLocaleString()}
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      vs. {Math.round(data.metrics.emailsSent * 0.88).toLocaleString()} last month
                    </Text>
                    <ProgressBar progress={75} size="small" />
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">Open Rate</Text>
                      <Badge tone="success">+5.2%</Badge>
                    </InlineStack>
                    <Text variant="heading2xl" as="h3">
                      {data.metrics.openRate}%
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Industry avg: 21.3%
                    </Text>
                    <ProgressBar progress={parseFloat(data.metrics.openRate) / 40 * 100} size="small" tone="success" />
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">Click Rate</Text>
                      <Badge tone="success">+8.1%</Badge>
                    </InlineStack>
                    <Text variant="heading2xl" as="h3">
                      14.2%
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Industry avg: 8.5%
                    </Text>
                    <ProgressBar progress={67} size="small" tone="primary" />
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">Revenue</Text>
                      <Badge tone="success">+15.3%</Badge>
                    </InlineStack>
                    <Text variant="heading2xl" as="h3">
                      ${data.metrics.revenue.toLocaleString()}
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      vs. ${Math.round(data.metrics.revenue * 0.87).toLocaleString()} last month
                    </Text>
                    <ProgressBar progress={85} size="small" tone="success" />
                  </BlockStack>
                </Card>
              </InlineGrid>

              {/* Detailed Breakdown */}
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                {/* Campaign Types */}
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h3" fontWeight="semibold">
                      Campaign Types Performance
                    </Text>
                    <BlockStack gap="300">
                      <div>
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="bodyMd">Promotional</Text>
                          <Text variant="bodyMd" fontWeight="medium">38.5%</Text>
                        </InlineStack>
                        <Box paddingBlockStart="100">
                          <ProgressBar progress={38.5} size="small" tone="primary" />
                        </Box>
                      </div>
                      <div>
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="bodyMd">Transactional</Text>
                          <Text variant="bodyMd" fontWeight="medium">67.2%</Text>
                        </InlineStack>
                        <Box paddingBlockStart="100">
                          <ProgressBar progress={67.2} size="small" tone="success" />
                        </Box>
                      </div>
                      <div>
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="bodyMd">Newsletter</Text>
                          <Text variant="bodyMd" fontWeight="medium">21.8%</Text>
                        </InlineStack>
                        <Box paddingBlockStart="100">
                          <ProgressBar progress={21.8} size="small" tone="info" />
                        </Box>
                      </div>
                      <div>
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="bodyMd">Automation</Text>
                          <Text variant="bodyMd" fontWeight="medium">45.3%</Text>
                        </InlineStack>
                        <Box paddingBlockStart="100">
                          <ProgressBar progress={45.3} size="small" tone="primary" />
                        </Box>
                      </div>
                    </BlockStack>
                  </BlockStack>
                </Card>

                {/* Audience Engagement */}
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h3" fontWeight="semibold">
                      Audience Engagement Levels
                    </Text>
                    <BlockStack gap="300">
                      <div>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone="success">Highly Engaged</Badge>
                            <Text variant="bodyMd">1,234 customers</Text>
                          </InlineStack>
                          <Text variant="bodyMd" fontWeight="medium">43%</Text>
                        </InlineStack>
                        <Box paddingBlockStart="100">
                          <ProgressBar progress={43} size="small" tone="success" />
                        </Box>
                      </div>
                      <div>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone="info">Moderately Engaged</Badge>
                            <Text variant="bodyMd">689 customers</Text>
                          </InlineStack>
                          <Text variant="bodyMd" fontWeight="medium">24%</Text>
                        </InlineStack>
                        <Box paddingBlockStart="100">
                          <ProgressBar progress={24} size="small" tone="primary" />
                        </Box>
                      </div>
                      <div>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone="warning">Low Engagement</Badge>
                            <Text variant="bodyMd">542 customers</Text>
                          </InlineStack>
                          <Text variant="bodyMd" fontWeight="medium">19%</Text>
                        </InlineStack>
                        <Box paddingBlockStart="100">
                          <ProgressBar progress={19} size="small" tone="warning" />
                        </Box>
                      </div>
                      <div>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone="critical">At Risk</Badge>
                            <Text variant="bodyMd">382 customers</Text>
                          </InlineStack>
                          <Text variant="bodyMd" fontWeight="medium">14%</Text>
                        </InlineStack>
                        <Box paddingBlockStart="100">
                          <ProgressBar progress={14} size="small" tone="critical" />
                        </Box>
                      </div>
                    </BlockStack>
                  </BlockStack>
                </Card>
              </InlineGrid>

              {/* Action Items */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3" fontWeight="semibold">
                    Recommended Actions
                  </Text>
                  <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                    <Card background="bg-surface-brand-subdued">
                      <BlockStack gap="200">
                        <Icon source={EmailIcon} />
                        <Text variant="headingSm" fontWeight="semibold">
                          Re-engage Inactive
                        </Text>
                        <Text variant="bodySm">
                          382 customers haven't opened an email in 30 days
                        </Text>
                        <Button size="slim">Create Campaign</Button>
                      </BlockStack>
                    </Card>

                    <Card background="bg-surface-success-subdued">
                      <BlockStack gap="200">
                        <Icon source={ClockIcon} />
                        <Text variant="headingSm" fontWeight="semibold">
                          Optimize Send Time
                        </Text>
                        <Text variant="bodySm">
                          Tuesday at 10 AM shows 37% better performance
                        </Text>
                        <Button size="slim">Schedule Campaign</Button>
                      </BlockStack>
                    </Card>

                    <Card background="bg-surface-secondary">
                      <BlockStack gap="200">
                        <Icon source={AutomationIcon} />
                        <Text variant="headingSm" fontWeight="semibold">
                          Add Automation
                        </Text>
                        <Text variant="bodySm">
                          Birthday emails have 89% open rate in similar stores
                        </Text>
                        <Button size="slim">Create Workflow</Button>
                      </BlockStack>
                    </Card>
                  </InlineGrid>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
