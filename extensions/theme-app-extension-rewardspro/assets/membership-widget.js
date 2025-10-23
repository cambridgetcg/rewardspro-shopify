/**
 * RewardsPro Membership Widget
 *
 * Lightweight vanilla JavaScript widget for displaying customer rewards data
 * No external dependencies
 *
 * API Endpoint: /apps/rewardspromembership
 * Backend: app/routes/api.proxy.$.tsx
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
      this.data = this.extractData();
      this.debugMode = this.root.dataset.debug === 'true' || window.location.search.includes('debug=true');

      if (this.debugMode) {
        console.log('[RewardsPro] Initializing widget', this.data);
      }

      // Check if design mode (theme editor)
      if (this.root.dataset.designMode === 'true') {
        if (this.debugMode) console.log('[RewardsPro] Design mode - showing preview');
        return;
      }

      // Check if customer ID exists
      if (!this.data.customerId) {
        if (this.debugMode) console.log('[RewardsPro] No customer ID - skipping initialization');
        return;
      }

      this.init();
    }

    extractData() {
      return {
        apiUrl: this.root.dataset.apiUrl || '/apps/rewardspromembership',
        customerId: this.root.dataset.shopifyCustomerId,
        customerEmail: this.root.dataset.customerEmail,
        currency: this.root.dataset.shopCurrency || 'USD'
      };
    }

    async init() {
      try {
        this.showLoading();
        const memberData = await this.fetchMemberData();

        if (!memberData) {
          this.showError('Unable to load rewards data');
          return;
        }

        if (memberData.requiresLogin) {
          this.showLoginPrompt();
          return;
        }

        if (!memberData.enrolled) {
          this.showNotEnrolled(memberData.message);
          return;
        }

        this.render(memberData);
      } catch (error) {
        console.error('[RewardsPro] Error:', error);
        this.showError('Failed to load rewards data');
      }
    }

    async fetchMemberData() {
      const url = `${this.data.apiUrl}?shopifyCustomerId=${encodeURIComponent(this.data.customerId)}`;

      if (this.debugMode) {
        console.log('[RewardsPro] Fetching:', url);
      }

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (this.debugMode) {
          console.error('[RewardsPro] HTTP Error:', response.status, response.statusText);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (this.debugMode) {
        console.log('[RewardsPro] Response:', data);
      }

      return data;
    }

    showLoading() {
      this.root.innerHTML = `
        <div class="rp-widget">
          <div class="rp-loading">
            <div class="rp-spinner"></div>
            <p>Loading rewards...</p>
          </div>
        </div>
      `;
    }

    showLoginPrompt() {
      this.root.innerHTML = `
        <div class="rp-widget">
          <div class="rp-message">
            <h3>Join Our Rewards Program</h3>
            <p>Sign in to view your rewards and earn cashback on purchases.</p>
            <a href="/account/login" class="rp-btn">Sign In</a>
          </div>
        </div>
      `;
    }

    showNotEnrolled(message) {
      this.root.innerHTML = `
        <div class="rp-widget">
          <div class="rp-message">
            <h3>Rewards Program</h3>
            <p>${this.escapeHtml(message || 'Not enrolled in rewards program')}</p>
          </div>
        </div>
      `;
    }

    showError(message) {
      this.root.innerHTML = `
        <div class="rp-widget">
          <div class="rp-error">
            <h3>Unable to Load Rewards</h3>
            <p>${this.escapeHtml(message)}</p>
            ${this.debugMode ? '<p><small>Check browser console for details</small></p>' : ''}
          </div>
        </div>
      `;
    }

    render(data) {
      // Extract data with backward compatibility
      const balance = data.memberData?.storeCreditRaw ?? data.balance ?? 0;
      const balanceFormatted = data.memberData?.storeCredit ?? this.formatCurrency(balance);
      const tierName = data.memberData?.tierName ?? data.tier?.name ?? 'Member';
      const cashbackRate = data.memberData?.cashbackRate ?? data.tier?.cashbackPercent ?? 0;

      this.root.innerHTML = `
        <div class="rp-widget rp-widget-expanded">
          <div class="rp-header">
            <h3 class="rp-title">Your Rewards</h3>
          </div>
          <div class="rp-content">
            <div class="rp-stat rp-stat-primary">
              <div class="rp-stat-label">Store Credit</div>
              <div class="rp-stat-value">${balanceFormatted}</div>
            </div>
            <div class="rp-stats-grid">
              <div class="rp-stat">
                <div class="rp-stat-label">Tier</div>
                <div class="rp-stat-value-sm">${this.escapeHtml(tierName)}</div>
              </div>
              <div class="rp-stat">
                <div class="rp-stat-label">Cashback</div>
                <div class="rp-stat-value-sm">${cashbackRate}%</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    formatCurrency(amount) {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: this.data.currency
        }).format(amount);
      } catch {
        return `${this.data.currency} ${Number(amount).toFixed(2)}`;
      }
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = String(text);
      return div.innerHTML;
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

  // Export for global access
  window.RewardsProWidget = MembershipWidget;

})();
