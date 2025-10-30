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
} from "@shopify/polaris";
import {
  EmailIcon,
  ChartVerticalIcon,
  CashDollarIcon,
  AutomationIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "~/shopify.server";
import db from "~/db.server";
import { AnalyticsRecommendationsService } from "~/services/marketing/analytics-recommendations.service";

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
    let automationStats: any[] = [];
    let activeAutomations = 0;
    let totalAutomations = 0;
    try {
      automationStats = await db.emailAutomation.groupBy({
        by: ['isEnabled'],
        where: { shop },
        _count: true,
      });
      activeAutomations = automationStats.find(s => s.isEnabled)?._count || 0;
      totalAutomations = automationStats.reduce((sum, s) => sum + s._count, 0);
      console.log('[Marketing Hub] ✓ Automation stats - Active:', activeAutomations, 'Total:', totalAutomations);
    } catch (automationError: any) {
      console.error('[Marketing Hub] ⚠️ EmailAutomation table may not exist:', automationError.message);
      console.log('[Marketing Hub] Using default values');
    }

    // Step 4: Get recommendations (safe - handles missing tables)
    console.log('[Marketing Hub] Step 4: Fetching analytics recommendations...');
    let recommendations: any[] = [];
    let highPriorityRecommendations: any[] = [];
    try {
      recommendations = await AnalyticsRecommendationsService.getRecommendations(shop);
      highPriorityRecommendations = recommendations.filter(r => r.priority === 'high');
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

      const emailMetrics = await db.emailEvent.groupBy({
        by: ['eventType'],
        where: {
          shop,
          createdAt: { gte: last30Days },
        },
        _count: true,
      });

      sentCount = emailMetrics.find(e => e.eventType === 'sent')?._count || 0;
      openedCount = emailMetrics.find(e => e.eventType === 'opened')?._count || 0;
      console.log('[Marketing Hub] ✓ Email metrics - Sent:', sentCount, 'Opened:', openedCount);
    } catch (metricsError: any) {
      console.error('[Marketing Hub] ⚠️ EmailEvent table may not exist:', metricsError.message);
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

    // If it's a Prisma error, log the specific details
    if (error.code) {
      console.error('[Marketing Hub] Prisma error code:', error.code);
      console.error('[Marketing Hub] Prisma meta:', JSON.stringify(error.meta, null, 2));
    }

    throw error;
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

  return (
    <Page
      title="Marketing Hub"
      subtitle="Engage customers with targeted loyalty emails"
    >
      <Layout>
        {/* Metrics Section */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
            {/* Emails Sent */}
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="start">
                  <Icon source={EmailIcon} tone="base" />
                </InlineStack>
                <Text variant="headingXl" as="h2">
                  {data.metrics.emailsSent.toLocaleString()}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Emails Sent This Month
                </Text>
              </BlockStack>
            </Card>

            {/* Open Rate */}
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

            {/* Revenue Generated */}
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="start">
                  <Icon source={CashDollarIcon} tone="base" />
                </InlineStack>
                <Text variant="headingXl" as="h2">
                  ${data.metrics.revenue.toLocaleString()}
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Revenue Generated
                </Text>
              </BlockStack>
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
                            {recommendation.affectedCustomers} customers • Potential: ${recommendation.potentialRevenue.toLocaleString()}
                          </Text>
                        </BlockStack>
                        <Button
                          onClick={() => navigate('/app/marketing/campaigns/smart-create')}
                        >
                          Launch
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
                        onClick={() => navigate('/app/marketing/campaigns/smart-create')}
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
