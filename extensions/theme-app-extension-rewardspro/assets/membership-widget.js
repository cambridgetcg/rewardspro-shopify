/**
 * Membership Widget - UI Only Version
 * Simple, lightweight widget for displaying membership information
 */

(function() {
  'use strict';

  class MembershipWidget {
    constructor(rootElement) {
      this.root = rootElement;

      // Detect login state
      this.isLoggedIn = this.root.dataset.loggedIn === 'true';

      // Get shop information
      this.shopData = {
        domain: this.root.dataset.shopDomain || '',
        currency: this.root.dataset.shopCurrency || 'USD'
      };

      // Get customer information (if logged in)
      this.customerData = this.isLoggedIn ? {
        id: this.root.dataset.customerId || '',
        email: this.root.dataset.customerEmail || ''
      } : null;

      // Get configuration from data attributes
      this.config = {
        // Member state config
        tierName: this.root.dataset.tierName || 'Rewards',
        balance: this.root.dataset.balance || '$0.00',

        // Guest state config
        message: this.root.dataset.message || '',
        ctaText: this.root.dataset.ctaText || '',
        ctaUrl: this.root.dataset.ctaUrl || ''
      };

      // Initialize state
      this.state = {
        isExpanded: this.getStoredState()
      };

      // Log detection for debugging
      console.log('[Widget] Initialized:', {
        isLoggedIn: this.isLoggedIn,
        shop: this.shopData,
        customer: this.customerData,
        config: this.config
      });

      // Render the widget
      this.render();
      this.attachEventListeners();
    }

    getStoredState() {
      try {
        return localStorage.getItem('rewards-widget-expanded') !== 'false';
      } catch {
        return true; // Default to expanded
      }
    }

    saveState() {
      try {
        localStorage.setItem('rewards-widget-expanded', String(this.state.isExpanded));
      } catch {
        // Ignore localStorage errors
      }
    }

    render() {
      // Automatically choose state based on login status
      if (!this.isLoggedIn) {
        // Guest user - always show CTA
        this.renderUnauthenticated();
        return;
      }

      // Logged-in user - show member info
      const expandedClass = this.state.isExpanded ? 'membership-widget--expanded' : 'membership-widget--collapsed';
      this.root.innerHTML = `
        <div class="membership-widget membership-widget--bottom-right ${expandedClass}" role="complementary" aria-label="Rewards Information">
          <div class="membership-widget__header" role="button" tabindex="0" aria-expanded="${this.state.isExpanded}">
            <div class="membership-widget__tier">
              <span class="membership-widget__tier-name">${this.escapeHtml(this.config.tierName)}</span>
            </div>
            ${this.state.isExpanded ? `
              <button class="membership-widget__toggle" aria-label="Collapse widget">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="membership-widget__toggle-icon membership-widget__toggle-icon--expanded">
                  <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            ` : ''}
          </div>
          ${this.state.isExpanded ? `
            <div class="membership-widget__content">
              <div class="membership-widget__balance">
                <span class="membership-widget__label">Store Credit</span>
                <span class="membership-widget__amount">${this.escapeHtml(this.config.balance)}</span>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    renderUnauthenticated() {
      this.root.innerHTML = `
        <div class="membership-widget membership-widget--bottom-right membership-widget--unauthenticated" role="complementary" aria-label="Rewards Program">
          <div class="membership-widget__header">
            <div class="membership-widget__tier">
              <span class="membership-widget__tier-name">Rewards Program</span>
            </div>
          </div>
          <div class="membership-widget__content">
            ${this.config.message ? `
              <div class="membership-widget__message">
                ${this.escapeHtml(this.config.message)}
              </div>
            ` : ''}
            <a href="${this.escapeHtml(this.config.ctaUrl)}" class="membership-widget__cta">
              ${this.escapeHtml(this.config.ctaText)}
            </a>
          </div>
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

      // Only attach toggle listeners for member state (not unauthenticated)
      if (!widget.classList.contains('membership-widget--unauthenticated')) {
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

        const toggleBtn = widget.querySelector('.membership-widget__toggle');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
          });
        }
      }
    }

    toggle() {
      this.state.isExpanded = !this.state.isExpanded;
      this.saveState();
      this.render();
      this.attachEventListeners();
    }
  }

  // Initialize widget when DOM is ready
  function init() {
    const rootElement = document.getElementById('membership-widget-root');
    if (rootElement) {
      new MembershipWidget(rootElement);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
