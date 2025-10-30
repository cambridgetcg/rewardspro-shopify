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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get email settings
  const emailSettings = await db.emailSettings.findUnique({
    where: { shop },
  });

  // Get automation counts
  const automationStats = await db.emailAutomation.groupBy({
    by: ['isEnabled'],
    where: { shop },
    _count: true,
  });

  const activeAutomations = automationStats.find(s => s.isEnabled)?._count || 0;
  const totalAutomations = automationStats.reduce((sum, s) => sum + s._count, 0);

  // Get recent campaigns
  const recentCampaigns = await db.emailCampaign.findMany({
    where: { shop },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      template: {
        select: { name: true, type: true },
      },
    },
  });

  // Calculate aggregate metrics from campaigns
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

  const sentCount = emailMetrics.find(e => e.eventType === 'sent')?._count || 0;
  const openedCount = emailMetrics.find(e => e.eventType === 'opened')?._count || 0;

  // Mock revenue data (would come from order tracking in production)
  const revenueGenerated = 0;

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
  });
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
                  onClick={() => navigate('/app/marketing/campaigns/new')}
                >
                  + New Campaign
                </Button>
                <Button onClick={() => navigate('/app/marketing/templates')}>
                  Edit Templates
                </Button>
                <Button onClick={() => navigate('/app/marketing/automation')}>
                  Automation Rules
                </Button>
                <Button onClick={() => navigate('/app/marketing/settings')}>
                  Settings
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

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
