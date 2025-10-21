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
        isExpanded: this.getStoredState()
      };

      console.log('[MembershipWidget JS] Initial state:', this.state);

      if (this.data.shopifyCustomerId) {
        console.log('[MembershipWidget JS] ✅ Shopify customer ID found, fetching data from API');
        this.fetchAndRender();
      } else {
        console.warn('[MembershipWidget JS] ❌ No Shopify customer ID found, widget will not render');
        console.log('[MembershipWidget JS] Root element dataset:', this.root.dataset);
      }
    }

    async fetchAndRender() {
      console.log('[MembershipWidget JS] ========== FETCH START ==========');
      console.log('[MembershipWidget JS] Current URL:', window.location.href);
      console.log('[MembershipWidget JS] Shop domain:', window.Shopify?.shop || 'unknown');

      try {
        // Check if we're in design mode (theme editor)
        const isDesignMode = this.root.dataset.designMode === 'true';

        let apiData;

        if (isDesignMode) {
          console.log('[MembershipWidget JS] 🎨 Design mode - using mock data');
          // Mock data for theme editor preview
          apiData = {
            balance: 50.00,
            tier: {
              id: 'mock-tier',
              name: 'Gold',
              icon: '⭐',
              color: '#FFD700'
            }
          };
        } else {
          const url = `${this.data.apiUrl}?shopifyCustomerId=${encodeURIComponent(this.data.shopifyCustomerId)}`;

          console.log('[MembershipWidget JS] 📡 API Request Details:');
          console.log('  - API URL (base):', this.data.apiUrl);
          console.log('  - Shopify Customer ID:', this.data.shopifyCustomerId);
          console.log('  - Full URL:', url);
          console.log('  - Method: GET');
          console.log('  - Credentials: same-origin');

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            credentials: 'same-origin' // App proxy is same-origin
          });

          console.log('[MembershipWidget JS] 📥 API Response:');
          console.log('  - Status:', response.status);
          console.log('  - Status Text:', response.statusText);
          console.log('  - OK:', response.ok);
          console.log('  - Headers:', {
            contentType: response.headers.get('content-type'),
            cacheControl: response.headers.get('cache-control')
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[MembershipWidget JS] ❌ API Error Details:');
            console.error('  - Status:', response.status);
            console.error('  - Status Text:', response.statusText);
            console.error('  - Response Body:', errorText);
            console.error('  - Full URL attempted:', url);
            this.showError('Unable to load membership data');
            return;
          }

          apiData = await response.json();
          console.log('[MembershipWidget JS] ✅ API Data received:', apiData);
        }

        console.log('[MembershipWidget JS] API data received:', apiData);

        // Check if customer is enrolled
        if (apiData.success && apiData.enrolled === false) {
          console.log('[MembershipWidget JS] ℹ️ Customer not enrolled in rewards program');
          this.showInfo(apiData.message || 'Not enrolled in membership program');
          return;
        }

        // Update data from API response
        this.data.tier = apiData.tier?.name || null;
        this.data.balance = apiData.balance || 0;
        this.data.currency = this.data.shopCurrency;

        console.log('[MembershipWidget JS] Updated data:', {
          tier: this.data.tier,
          balance: this.data.balance,
          currency: this.data.currency
        });

        if (this.data.tier) {
          console.log('[MembershipWidget JS] ✅ Rendering widget with API data');
          this.render();
          this.attachEventListeners();
          console.log('[MembershipWidget JS] ✅ Widget rendered successfully');
          console.log('[MembershipWidget JS] ========== FETCH COMPLETE ==========');
        } else {
          console.warn('[MembershipWidget JS] ⚠️ No tier data in API response');
          console.log('[MembershipWidget JS] ========== FETCH COMPLETE (Not Enrolled) ==========');
          this.showError('Not enrolled in membership program');
        }

      } catch (error) {
        console.error('[MembershipWidget JS] ========== FETCH FAILED ==========');
        console.error('[MembershipWidget JS] ❌ Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3)
        });
        console.error('[MembershipWidget JS] Full error:', error);
        this.showError('Failed to load membership data');
      }
    }

    showError(message) {
      this.root.innerHTML = `
        <div style="padding: 20px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
          <strong>⚠️ ${this.escapeHtml(message)}</strong>
        </div>
      `;
    }

    showInfo(message) {
      this.root.innerHTML = `
        <div style="padding: 20px; background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px;">
          <strong>ℹ️ ${this.escapeHtml(message)}</strong>
        </div>
      `;
    }

    extractData() {
      const data = {
        apiUrl: this.root.dataset.apiUrl || '/apps/rewardspro/loyalty',
        shopifyCustomerId: this.root.dataset.shopifyCustomerId,
        customerEmail: this.root.dataset.customerEmail,
        shopCurrency: this.root.dataset.shopCurrency || 'USD',
        // Will be populated from API
        tier: null,
        balance: 0,
        currency: 'USD'
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
                <span class="membership-widget__amount">${this.formatCurrency(this.data.balance)}</span>
              </div>
              ${this.data.balance > 0 ? `
                <div class="membership-widget__hint">Available to use at checkout</div>
              ` : ''}
            </div>
          ` : ''}
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
    console.log('\n[MembershipWidget JS] ========== INITIALIZATION START ==========');
    console.log('[MembershipWidget JS] init() called');
    console.log('[MembershipWidget JS] document.readyState:', document.readyState);
    console.log('[MembershipWidget JS] document.location:', window.location.href);

    const rootElement = document.getElementById('membership-widget-root');
    console.log('[MembershipWidget JS] Looking for #membership-widget-root');
    console.log('[MembershipWidget JS] Found element:', !!rootElement);

    if (rootElement) {
      console.log('[MembershipWidget JS] ✅ Root element found, initializing widget');
      console.log('[MembershipWidget JS] Root element dataset:', rootElement.dataset);
      try {
        new MembershipWidget(rootElement);
        console.log('[MembershipWidget JS] ========== INITIALIZATION COMPLETE ==========\n');
      } catch (error) {
        console.error('[MembershipWidget JS] ========== INITIALIZATION FAILED ==========');
        console.error('[MembershipWidget JS] ❌ Error initializing widget:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5)
        });
      }
    } else {
      console.warn('[MembershipWidget JS] ❌ Root element #membership-widget-root not found');
      console.log('[MembershipWidget JS] Available IDs:',
        Array.from(document.querySelectorAll('[id]')).map(el => el.id).filter(id => id));
      console.log('[MembershipWidget JS] Elements with "membership" in class or id:',
        Array.from(document.querySelectorAll('[id*="membership"], [class*="membership"]')).map(el => ({
          tag: el.tagName,
          id: el.id,
          class: el.className
        })));
      console.log('[MembershipWidget JS] ========== INITIALIZATION FAILED (No Root) ==========\n');
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
