/**
 * Membership Widget - Vanilla JavaScript Version
 * Lightweight widget for displaying membership information
 * No external dependencies
 */

(function() {
  'use strict';

  console.log('[MembershipWidget JS] Script loaded and executing');

  class MembershipWidget {
    constructor(rootElement) {
      console.log('[MembershipWidget JS] Constructor called');
      console.log('[MembershipWidget JS] Root element:', rootElement);

      this.root = rootElement;
      this.data = this.extractData();

      console.log('[MembershipWidget JS] Extracted data:', this.data);

      this.state = {
        isExpanded: this.getStoredState(),
        isVisible: true
      };

      console.log('[MembershipWidget JS] Initial state:', this.state);

      if (this.data.tier) {
        console.log('[MembershipWidget JS] ✅ Tier exists, rendering widget');
        this.render();
        this.attachEventListeners();
        console.log('[MembershipWidget JS] ✅ Widget rendered successfully');
      } else {
        console.warn('[MembershipWidget JS] ❌ No tier data found, widget will not render');
        console.log('[MembershipWidget JS] Root element dataset:', this.root.dataset);
      }
    }

    extractData() {
      const data = {
        tier: this.root.dataset.tier || '',
        balance: parseFloat(this.root.dataset.balance) || 0,
        currency: this.root.dataset.currency || 'USD',
        customerId: this.root.dataset.customerId,
        customerEmail: this.root.dataset.customerEmail
      };
      console.log('[MembershipWidget JS] extractData result:', data);
      return data;
    }

    getStoredState() {
      try {
        return localStorage.getItem('rewards-pro-widget-collapsed') !== 'true';
      } catch {
        return true;
      }
    }

    saveState() {
      try {
        localStorage.setItem('rewards-pro-widget-collapsed', String(!this.state.isExpanded));
      } catch {
        // Ignore if localStorage is not available
      }
    }

    formatCurrency(amount) {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: this.data.currency
        }).format(amount);
      } catch {
        return `${this.data.currency} ${amount.toFixed(2)}`;
      }
    }

    render() {
      const expandedClass = this.state.isExpanded ? 'membership-widget--expanded' : 'membership-widget--collapsed';

      this.root.innerHTML = `
        <div class="membership-widget membership-widget--bottom-right ${expandedClass}" role="complementary" aria-label="Membership Information">
          <div class="membership-widget__header" role="button" tabindex="0" aria-expanded="${this.state.isExpanded}">
            <div class="membership-widget__tier">
              <span class="membership-widget__icon">🌟</span>
              <span class="membership-widget__tier-name">${this.escapeHtml(this.data.tier)}</span>
            </div>
            <button class="membership-widget__toggle" aria-label="${this.state.isExpanded ? 'Collapse widget' : 'Expand widget'}">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="membership-widget__toggle-icon ${this.state.isExpanded ? 'membership-widget__toggle-icon--expanded' : ''}">
                <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          ${this.state.isExpanded ? `
            <div class="membership-widget__content">
              <div class="membership-widget__balance">
                <span class="membership-widget__label">Store Credit</span>
                <span class="membership-widget__amount">${this.formatCurrency(this.data.balance)}</span>
              </div>
              ${this.data.balance > 0 ? `
                <div class="membership-widget__hint">Available to use at checkout</div>
              ` : ''}
            </div>
          ` : ''}
          <button class="membership-widget__close" aria-label="Close membership widget" title="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      `;
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    attachEventListeners() {
      const widget = this.root.querySelector('.membership-widget');
      if (!widget) return;

      // Header click to toggle
      const header = widget.querySelector('.membership-widget__header');
      if (header) {
        header.addEventListener('click', (e) => {
          if (e.target.closest('.membership-widget__toggle')) return;
          this.toggle();
        });

        header.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.toggle();
          }
        });
      }

      // Toggle button
      const toggleBtn = widget.querySelector('.membership-widget__toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle();
        });
      }

      // Close button
      const closeBtn = widget.querySelector('.membership-widget__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }
    }

    toggle() {
      this.state.isExpanded = !this.state.isExpanded;
      this.saveState();
      this.render();
      this.attachEventListeners();
    }

    close() {
      this.state.isVisible = false;
      this.root.innerHTML = '';
    }
  }

  // Initialize widget when DOM is ready
  function init() {
    console.log('[MembershipWidget JS] init() called');
    console.log('[MembershipWidget JS] document.readyState:', document.readyState);

    const rootElement = document.getElementById('membership-widget-root');
    console.log('[MembershipWidget JS] Looking for #membership-widget-root');
    console.log('[MembershipWidget JS] Found element:', rootElement);

    if (rootElement) {
      console.log('[MembershipWidget JS] ✅ Root element found, initializing widget');
      try {
        new MembershipWidget(rootElement);
      } catch (error) {
        console.error('[MembershipWidget JS] ❌ Error initializing widget:', error);
        console.error('[MembershipWidget JS] Error stack:', error.stack);
      }
    } else {
      console.warn('[MembershipWidget JS] ❌ Root element #membership-widget-root not found');
      console.log('[MembershipWidget JS] Available elements with "membership":',
        document.querySelectorAll('[id*="membership"], [class*="membership"]'));
    }
  }

  console.log('[MembershipWidget JS] Setting up initialization');
  if (document.readyState === 'loading') {
    console.log('[MembershipWidget JS] DOM still loading, adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', init);
  } else {
    console.log('[MembershipWidget JS] DOM already loaded, initializing immediately');
    init();
  }
})();
