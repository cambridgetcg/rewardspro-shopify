import { json, LoaderFunctionArgs, ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Banner,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import { AnalyticsRecommendationsService, type MarketingRecommendation } from "~/services/marketing/analytics-recommendations.service";
import db from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get analytics recommendations
  const recommendations = await AnalyticsRecommendationsService.getRecommendations(shop);

  // Get email settings to check if configured
  const emailSettings = await db.emailSettings.findUnique({
    where: { shop },
  });

  return json({
    shop,
    recommendations,
    emailSettings,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const recommendationId = formData.get("recommendationId") as string;
  const action = formData.get("action") as string;

  if (action === "create_campaign") {
    // Get the recommendation details
    const recommendations = await AnalyticsRecommendationsService.getRecommendations(shop);
    const recommendation = recommendations.find(r => r.id === recommendationId);

    if (!recommendation) {
      return json({ success: false, message: "Recommendation not found" }, { status: 404 });
    }

    // Create a default template for this recommendation type
    const template = await db.emailTemplate.create({
      data: {
        shop,
        name: `${recommendation.title} Template`,
        type: recommendation.type,
        subject: getDefaultSubject(recommendation.type),
        content: getDefaultContent(recommendation.type),
        isActive: true,
      },
    });

    // Create draft campaign
    const campaign = await db.emailCampaign.create({
      data: {
        shop,
        name: recommendation.title,
        templateId: template.id,
        status: 'draft',
        segmentRules: recommendation.segmentRules,
      },
    });

    // Redirect to campaign editor
    return redirect(`/app/marketing/campaigns/${campaign.id}/edit`);
  }

  return json({ success: false, message: "Invalid action" }, { status: 400 });
};

function getDefaultSubject(type: string): string {
  const subjects: Record<string, string> = {
    inactive_reengagement: "We Miss You, {{customer.firstName}}! Here's Something Special",
    tier_upgrade: "You're So Close to {{tier.nextTier}} Status!",
    reward_expiry: "⏰ Your ${{rewards.cashbackValue}} Expires in {{rewards.daysToExpiry}} Days",
    vip_retention: "Exclusive VIP Offer Just for You",
    birthday: "Happy Birthday {{customer.firstName}}! 🎉 Here's Your Gift",
    low_balance: "You Have ${{rewards.cashbackValue}} Waiting for You"
  };
  return subjects[type] || "Special Offer for You";
}

function getDefaultContent(type: string): any {
  return {
    blocks: [
      {
        type: 'header',
        content: { logo: true, navigation: [] }
      },
      {
        type: 'hero',
        content: {
          headline: `Based on ${type} campaign`,
          subheadline: 'This is a template you can customize'
        }
      },
      {
        type: 'cta',
        content: {
          text: 'Shop Now',
          url: '{{shop.url}}/collections/all'
        }
      },
      {
        type: 'footer',
        content: { legal: true }
      }
    ]
  };
}

export default function SmartCampaignCreator() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const handleLaunchCampaign = (recommendationId: string) => {
    const formData = new FormData();
    formData.append("recommendationId", recommendationId);
    formData.append("action", "create_campaign");
    fetcher.submit(formData, { method: "post" });
  };

  if (!data.emailSettings) {
    return (
      <Page
        title="Smart Campaign Creator"
        backAction={{ content: "Marketing", url: "/app/marketing" }}
      >
        <Layout>
          <Layout.Section>
            <Banner
              title="Email settings required"
              tone="warning"
            >
              <p>
                Configure your email sender settings before creating campaigns.
              </p>
              <Button onClick={() => navigate('/app/marketing/settings')}>
                Configure Settings
              </Button>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Smart Campaign Creator"
      subtitle="Launch data-driven campaigns from analytics insights"
      backAction={{ content: "Marketing", url: "/app/marketing" }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Analytics-Powered Templates
              </Text>
              <Text variant="bodyMd" tone="subdued" as="p">
                These campaigns are recommended based on your customer data and behavior patterns
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {data.recommendations.length === 0 ? (
            <Card>
              <EmptyState
                heading="No recommendations yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Check back later as your customer base grows and we identify opportunities.</p>
              </EmptyState>
            </Card>
          ) : (
            <BlockStack gap="400">
              {data.recommendations.map((recommendation) => (
                <ActionTemplateCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  onLaunch={handleLaunchCampaign}
                  isLoading={fetcher.state === "submitting"}
                />
              ))}
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}

interface ActionTemplateCardProps {
  recommendation: MarketingRecommendation;
  onLaunch: (id: string) => void;
  isLoading: boolean;
}

function ActionTemplateCard({ recommendation, onLaunch, isLoading }: ActionTemplateCardProps) {
  const navigate = useNavigate();

  const getPriorityBadge = () => {
    const toneMap: Record<string, any> = {
      high: 'critical',
      medium: 'attention',
      low: 'info'
    };
    return (
      <Badge tone={toneMap[recommendation.priority]}>
        {recommendation.priority.charAt(0).toUpperCase() + recommendation.priority.slice(1)} Priority
      </Badge>
    );
  };

  const getCategoryBadge = () => {
    const iconMap: Record<string, string> = {
      engagement: '🎯',
      growth: '📈',
      retention: '🔒',
      revenue: '💰'
    };
    return (
      <Badge tone="info">
        {iconMap[recommendation.category]} {recommendation.category.charAt(0).toUpperCase() + recommendation.category.slice(1)}
      </Badge>
    );
  };

  return (
    <Card>
      <BlockStack gap="300">
        {/* Header with badges */}
        <InlineStack gap="200" blockAlign="center">
          {getPriorityBadge()}
          {getCategoryBadge()}
        </InlineStack>

        {/* Title and Description */}
        <BlockStack gap="200">
          <Text variant="headingSm" as="h3" fontWeight="semibold">
            {recommendation.title}
          </Text>
          <Text variant="bodySm" tone="subdued" as="p">
            {recommendation.description}
          </Text>
        </BlockStack>

        {/* Metrics */}
        <div style={{
          padding: '12px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="bodySm" as="span" tone="subdued">
                Affected Customers
              </Text>
              <Text variant="bodyMd" as="span" fontWeight="semibold">
                {recommendation.affectedCustomers} customers
              </Text>
            </InlineStack>
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="bodySm" as="span" tone="subdued">
                Potential Revenue
              </Text>
              <Text variant="bodyMd" as="span" fontWeight="semibold" tone="success">
                ${recommendation.potentialRevenue.toLocaleString()}
              </Text>
            </InlineStack>
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="bodySm" as="span" tone="subdued">
                Expected Response Rate
              </Text>
              <Text variant="bodyMd" as="span" fontWeight="semibold">
                {recommendation.expectedResponseRate}%
              </Text>
            </InlineStack>
          </BlockStack>
        </div>

        {/* Action Buttons */}
        <InlineStack gap="200" align="end">
          <Button
            onClick={() => navigate(`/app/marketing/campaigns/preview?recommendation=${recommendation.id}`)}
          >
            Preview Segment
          </Button>
          <Button
            variant="primary"
            onClick={() => onLaunch(recommendation.id)}
            loading={isLoading}
          >
            Launch Campaign →
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
