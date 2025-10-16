/**
 * Type definitions for the Membership Widget
 */

export interface MembershipData {
  tier: string;
  balance: number;
  currency: string;
  customerId?: string;
  customerEmail?: string;
}

export interface WidgetSettings {
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showOnMobile: boolean;
  collapsible: boolean;
}

export interface MembershipWidgetProps {
  data: MembershipData;
  settings?: Partial<WidgetSettings>;
}

export interface WidgetState {
  isExpanded: boolean;
  isVisible: boolean;
}
