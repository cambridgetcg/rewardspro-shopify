/**
 * RewardsPro Membership Widget - Simple Expandable UI
 *
 * Lightweight vanilla JavaScript widget with expand/collapse functionality
 * No external dependencies or API calls
 */

(function() {
  'use strict';

  class MembershipWidget {
    constructor(rootElement) {
      if (!rootElement) {
        console.error('[RewardsPro] Root element not found');
        return;
      }

      this.root = rootElement;
      this.isExpanded = false;
      this.init();
    }

    init() {
      this.render();
      this.attachEventListeners();
    }

    render() {
      this.root.innerHTML = `
        <div class="rp-widget ${this.isExpanded ? 'rp-expanded' : 'rp-collapsed'}">
          <button class="rp-header" aria-expanded="${this.isExpanded}" aria-controls="rp-content">
            <span class="rp-header-text">
              <svg class="rp-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2L12.245 6.545L17.5 7.255L13.75 10.91L14.635 16.135L10 13.755L5.365 16.135L6.25 10.91L2.5 7.255L7.755 6.545L10 2Z" fill="currentColor"/>
              </svg>
              Your Rewards
            </span>
            <svg class="rp-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="rp-content" id="rp-content">
            <div class="rp-content-inner">
              <div class="rp-stat-card rp-stat-primary">
                <div class="rp-stat-label">Store Credit</div>
                <div class="rp-stat-value">$25.00</div>
              </div>
              <div class="rp-stats-grid">
                <div class="rp-stat-card">
                  <div class="rp-stat-label">Membership Tier</div>
                  <div class="rp-stat-value-sm">Gold Member</div>
                </div>
                <div class="rp-stat-card">
                  <div class="rp-stat-label">Cashback Rate</div>
                  <div class="rp-stat-value-sm">5%</div>
                </div>
              </div>
              <div class="rp-stat-card">
                <div class="rp-stat-label">Lifetime Earned</div>
                <div class="rp-stat-value-sm">$150.00</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    attachEventListeners() {
      const header = this.root.querySelector('.rp-header');
      if (header) {
        header.addEventListener('click', () => this.toggle());
      }
    }

    toggle() {
      this.isExpanded = !this.isExpanded;
      const widget = this.root.querySelector('.rp-widget');
      const header = this.root.querySelector('.rp-header');

      if (widget) {
        widget.classList.toggle('rp-expanded', this.isExpanded);
        widget.classList.toggle('rp-collapsed', !this.isExpanded);
      }

      if (header) {
        header.setAttribute('aria-expanded', this.isExpanded);
      }
    }

    expand() {
      if (!this.isExpanded) {
        this.toggle();
      }
    }

    collapse() {
      if (this.isExpanded) {
        this.toggle();
      }
    }
  }

  // Initialize widget when DOM is ready
  function init() {
    const rootElement = document.getElementById('membership-widget-root');
    if (rootElement) {
      window.rewardsProWidgetInstance = new MembershipWidget(rootElement);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for global access
  window.RewardsProWidget = MembershipWidget;

})();
