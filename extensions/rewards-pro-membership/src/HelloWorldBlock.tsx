import {
  reactExtension,
  Banner,
  BlockStack,
  Text,
  useApi,
} from '@shopify/ui-extensions-react/customer-account';

export default reactExtension(
  'customer-account.profile.block.render',
  () => <HelloWorldBlock />
);

function HelloWorldBlock() {
  const { i18n } = useApi();

  return (
    <BlockStack spacing="base">
      <Banner title="Hello World! 🎉">
        This is a test block on the Profile page.
      </Banner>
      <Text>
        This extension is rendering on the customer account profile page.
      </Text>
      <Text size="small" appearance="subdued">
        Current locale: {i18n.formatDate(new Date())}
      </Text>
    </BlockStack>
  );
}
