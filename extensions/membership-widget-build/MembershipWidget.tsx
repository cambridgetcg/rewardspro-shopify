import React, { useState, useEffect } from 'react';
import type { MembershipWidgetProps, WidgetState } from './types';

/**
 * MembershipWidget Component
 *
 * Displays customer membership tier and store credit balance
 * as a floating widget on the storefront.
 */
export const MembershipWidget: React.FC<MembershipWidgetProps> = ({ data, settings }) => {
  const [state, setState] = useState<WidgetState>({
    isExpanded: true,
    isVisible: true,
  });

  const { tier, balance, currency } = data;
  const collapsible = settings?.collapsible ?? true;
  const position = settings?.position ?? 'bottom-right';

  // Format currency
  const formatCurrency = (amount: number, curr: string): string => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: curr || 'USD',
      }).format(amount);
    } catch {
      return `${curr} ${amount.toFixed(2)}`;
    }
  };

  const toggleExpand = () => {
    if (collapsible) {
      setState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
    }
  };

  const close = () => {
    setState(prev => ({ ...prev, isVisible: false }));
  };

  // Save collapse state to localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('rewards-pro-widget-collapsed');
    if (savedState === 'true' && collapsible) {
      setState(prev => ({ ...prev, isExpanded: false }));
    }
  }, [collapsible]);

  useEffect(() => {
    if (collapsible) {
      localStorage.setItem('rewards-pro-widget-collapsed', String(!state.isExpanded));
    }
  }, [state.isExpanded, collapsible]);

  if (!state.isVisible) {
    return null;
  }

  return (
    <div
      className={`membership-widget membership-widget--${position} ${state.isExpanded ? 'membership-widget--expanded' : 'membership-widget--collapsed'}`}
      role="complementary"
      aria-label="Membership Information"
    >
      {/* Widget Header */}
      <div
        className="membership-widget__header"
        onClick={toggleExpand}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? state.isExpanded : undefined}
        onKeyDown={(e) => {
          if (collapsible && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleExpand();
          }
        }}
      >
        <div className="membership-widget__tier">
          <span className="membership-widget__icon">🌟</span>
          <span className="membership-widget__tier-name">{tier}</span>
        </div>

        {collapsible && (
          <button
            className="membership-widget__toggle"
            aria-label={state.isExpanded ? 'Collapse widget' : 'Expand widget'}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand();
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={`membership-widget__toggle-icon ${state.isExpanded ? 'membership-widget__toggle-icon--expanded' : ''}`}
            >
              <path
                d="M2 4L6 8L10 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Widget Content (collapsible) */}
      {state.isExpanded && (
        <div className="membership-widget__content">
          <div className="membership-widget__balance">
            <span className="membership-widget__label">Store Credit</span>
            <span className="membership-widget__amount">
              {formatCurrency(balance, currency)}
            </span>
          </div>

          {balance > 0 && (
            <div className="membership-widget__hint">
              Available to use at checkout
            </div>
          )}
        </div>
      )}

      {/* Close button */}
      <button
        className="membership-widget__close"
        onClick={close}
        aria-label="Close membership widget"
        title="Close"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M1 1L13 13M13 1L1 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
};
