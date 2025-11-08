/**
 * RewardsPro Membership Widget - Dynamic Version
 * Fetches real-time customer data from proxy API
 * Handles authentication, caching, and error states
 */

(function() {
  'use strict';

  class MembershipWidget {
    constructor(rootElement) {
      this.root = rootElement;
      this.config = this.parseConfiguration();
      this.state = {
        isExpanded: this.loadExpandedState(),
        isLoading: false,
        data: null,
        error: null,
        lastFetch: null,
        dataSource: null, // 'fresh', 'cache', 'fallback'
        needsSync: false // Flag indicating customer needs database sync
      };

      // Prevent double initialization
      if (this.root.dataset.initialized === 'true') {
        return;
      }
      this.root.dataset.initialized = 'true';

      // Initialize based on authentication state
      this.initialize();
    }

    /**
     * Parse all configuration from data attributes
     */
    parseConfiguration() {
      const dataset = this.root.dataset;

      return {
        // Authentication state
        isAuthenticated: dataset.state === 'authenticated',

        // Customer data
        customer: dataset.state === 'authenticated' ? {
          id: dataset.customerId,
          email: dataset.customerEmail,
          name: dataset.customerName || 'Member',
          tags: dataset.customerTags ? dataset.customerTags.split(',').filter(t => t) : []
        } : null,

        // Shop data
        shop: {
          domain: dataset.shopDomain,
          currency: dataset.shopCurrency || 'USD'
        },

        // API configuration
        api: {
          endpoint: dataset.apiEndpoint,
          enabled: dataset.enableApi !== 'false',
          cacheDuration: parseInt(dataset.cacheDuration) || 300 // seconds
        },

        // Guest configuration
        guest: {
          message: dataset.message || '',
          ctaText: dataset.ctaText || 'Sign In',
          ctaUrl: dataset.ctaUrl || '/account/login'
        }
      };
    }

    /**
     * Initialize widget based on state
     */
    async initialize() {
      console.log('[RewardsWidget] Initializing:', {
        authenticated: this.config.isAuthenticated,
        customerId: this.config.customer?.id,
        apiEnabled: this.config.api.enabled,
        apiEndpoint: this.config.api.endpoint
      });

      if (!this.config.isAuthenticated) {
        // Guest user - render CTA immediately
        this.renderGuest();
        return;
      }

      // Authenticated user - check for cached data first
      const cachedData = this.getCachedData();

      if (cachedData) {
        console.log('[RewardsWidget] Using cached data');
        this.state.data = cachedData;
        this.state.dataSource = 'cache';
        this.renderAuthenticated();
      } else {
        // Show loading state
        this.renderLoading();
      }

      // Fetch fresh data if API is enabled
      if (this.config.api.enabled) {
        console.log('[RewardsWidget] 🚀 API is enabled, fetching customer data...');
        await this.fetchCustomerData();
      } else {
        console.log('[RewardsWidget] ⚠️ API disabled, using fallback data');
        console.log('[RewardsWidget] Config:', this.config);
        this.useFallbackData();
      }
    }

    /**
     * Fetch real customer data from proxy API
     */
    async fetchCustomerData() {
      console.log('[RewardsWidget] 📞 fetchCustomerData called');
      console.log('[RewardsWidget] API Config:', {
        endpoint: this.config.api.endpoint,
        enabled: this.config.api.enabled,
        customerId: this.config.customer?.id,
        shopDomain: this.config.shop.domain
      });

      if (!this.config.api.endpoint || !this.config.customer?.id) {
        console.error('[RewardsWidget] ❌ Missing API endpoint or customer ID:', {
          endpoint: this.config.api.endpoint,
          customerId: this.config.customer?.id
        });
        this.handleError('Configuration error');
        return;
      }

      this.state.isLoading = true;

      try {
        // Build URL with query parameters
        const url = new URL(this.config.api.endpoint, window.location.origin);
        url.searchParams.append('logged_in_customer_id', this.config.customer.id);
        url.searchParams.append('shop', this.config.shop.domain);

        console.log('[RewardsWidget] 🌐 MAKING API CALL TO:', url.toString());
        console.log('[RewardsWidget] 📍 Full URL breakdown:', {
          origin: window.location.origin,
          endpoint: this.config.api.endpoint,
          fullUrl: url.toString()
        });

        // Fetch with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          signal: controller.signal,
          credentials: 'same-origin'
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        console.log('[RewardsWidget] ✅ Response received:', data);
        console.log('[RewardsWidget] Response details:', {
          success: data.success,
          status: data.status,
          hasBalance: !!data.balance,
          hasMembership: !!data.membership,
          tierName: data.membership?.tier?.name,
          storeCredit: data.balance?.storeCredit,
          needsSync: data.needsSync || false,
          query: data.query
        });

        // Handle customer not found specifically
        if (!data.success && data.status === 'customer_not_found') {
          console.log('[RewardsWidget] 📭 Customer not found in database');

          // Update state with not found info
          this.state.data = data;
          this.state.error = null;
          this.state.lastFetch = Date.now();
          this.state.dataSource = 'not_found';
          this.state.needsSync = true;

          // Render "no data" state
          this.renderNotFound();
          return;
        }

        if (!data.success) {
          throw new Error(data.message || 'API request failed');
        }

        // Update state with fresh data
        this.state.data = data;
        this.state.error = null;
        this.state.lastFetch = Date.now();
        this.state.dataSource = 'fresh';
        this.state.needsSync = data.needsSync || false;

        // Cache the data
        this.cacheData(data);

        // Re-render with new data
        this.renderAuthenticated();

      } catch (error) {
        console.error('[RewardsWidget] Fetch error:', error);

        if (error.name === 'AbortError') {
          this.handleError('Request timed out');
        } else {
          this.handleError(error.message);
        }

        // Try to use cached data on error
        const cachedData = this.getCachedData();
        if (cachedData) {
          console.log('[RewardsWidget] Using cached data after error');
          this.state.data = cachedData;
          this.state.dataSource = 'cache-stale';
          this.renderAuthenticated(true); // Show stale indicator
        } else {
          // Use fallback data as last resort
          this.useFallbackData();
        }
      } finally {
        this.state.isLoading = false;
      }
    }

    /**
     * Get cached data if available and fresh
     */
    getCachedData() {
      if (!this.config.customer?.id) return null;

      try {
        const key = `rp-widget-${this.config.customer.id}`;
        const cached = localStorage.getItem(key);

        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        const age = (Date.now() - timestamp) / 1000; // Age in seconds

        // Check if cache is still fresh
        if (age < this.config.api.cacheDuration) {
          console.log('[RewardsWidget] Cache is fresh (age: ' + Math.round(age) + 's)');
          return data;
        }

        console.log('[RewardsWidget] Cache expired (age: ' + Math.round(age) + 's)');
        return null;

      } catch (error) {
        console.error('[RewardsWidget] Cache read error:', error);
        // Clear corrupted cache
        try {
          localStorage.removeItem('rp-widget-' + this.config.customer.id);
        } catch (e) {}
        return null;
      }
    }

    /**
     * Cache data with timestamp
     */
    cacheData(data) {
      if (!this.config.customer?.id) return;

      try {
        const key = `rp-widget-${this.config.customer.id}`;
        const cache = {
          data: data,
          timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(cache));
        console.log('[RewardsWidget] Data cached successfully');
      } catch (error) {
        console.error('[RewardsWidget] Cache write error:', error);
      }
    }

    /**
     * Use fallback data when API is unavailable
     */
    useFallbackData() {
      console.log('[RewardsWidget] Using fallback data');
      this.state.data = {
        customer: {
          id: this.config.customer.id,
          email: this.config.customer.email,
          name: this.config.customer.name
        },
        balance: {
          storeCredit: 0,
          totalEarned: 0,
          lastSynced: null
        },
        membership: {
          tier: {
            id: 'default',
            name: 'Member',
            cashbackPercent: 1
          }
        }
      };
      this.state.dataSource = 'fallback';

      this.renderAuthenticated(false, true); // Show offline indicator
    }

    /**
     * Handle errors
     */
    handleError(message) {
      this.state.error = message;
      this.renderError();
    }

    /**
     * Render methods for different states
     */
    renderGuest() {
      const { message, ctaText, ctaUrl } = this.config.guest;

      this.root.innerHTML = `
        <div class="rp-widget rp-widget--guest">
          <div class="rp-widget__content">
            ${message ? `<p class="rp-widget__message">${this.escapeHtml(message)}</p>` : ''}
            <a href="${this.escapeHtml(ctaUrl)}" class="rp-widget__cta">
              ${this.escapeHtml(ctaText)}
            </a>
          </div>
        </div>
      `;
    }

    renderLoading() {
      this.root.innerHTML = `
        <div class="rp-widget rp-widget--loading">
          <div class="rp-widget__content">
            <div class="rp-widget__spinner"></div>
            <p class="rp-widget__loading-text">Loading rewards...</p>
          </div>
        </div>
      `;
    }

    renderError() {
      this.root.innerHTML = `
        <div class="rp-widget rp-widget--error">
          <div class="rp-widget__content">
            <p class="rp-widget__error-message">Unable to load rewards data</p>
            <button class="rp-widget__retry" data-retry="true">
              Try Again
            </button>
          </div>
        </div>
      `;

      // Attach retry listener
      const retryBtn = this.root.querySelector('[data-retry]');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.renderLoading();
          this.fetchCustomerData();
        });
      }
    }

    renderAuthenticated(isStale = false, isOffline = false) {
      if (!this.state.data) {
        console.warn('[RewardsWidget] Cannot render - no data available');
        return;
      }

      const { balance, membership } = this.state.data;
      const expandedClass = this.state.isExpanded ? 'rp-widget--expanded' : 'rp-widget--collapsed';

      this.root.innerHTML = `
        <div class="rp-widget rp-widget--authenticated ${expandedClass}">
          <div class="rp-widget__header" role="button" tabindex="0" aria-expanded="${this.state.isExpanded}">
            <div class="rp-widget__header-content">
              <span class="rp-widget__tier">${this.escapeHtml(membership.tier.name)}</span>
              <span class="rp-widget__cashback">${membership.tier.cashbackPercent}% back</span>
            </div>
            <button class="rp-widget__toggle" aria-label="${this.state.isExpanded ? 'Collapse widget' : 'Expand widget'}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          ${this.state.isExpanded ? `
            <div class="rp-widget__body">
              <div class="rp-widget__balance">
                <span class="rp-widget__balance-label">Store Credit</span>
                <span class="rp-widget__balance-amount">
                  ${this.formatCurrency(balance.storeCredit)}
                </span>
              </div>
              <div class="rp-widget__stats">
                <div class="rp-widget__stat">
                  <span class="rp-widget__stat-label">Total Earned</span>
                  <span class="rp-widget__stat-value">${this.formatCurrency(balance.totalEarned)}</span>
                </div>
              </div>
              ${isStale ? '<div class="rp-widget__indicator rp-widget__indicator--stale">Data may be outdated</div>' : ''}
              ${isOffline ? '<div class="rp-widget__indicator rp-widget__indicator--offline">Offline mode</div>' : ''}
              ${this.state.needsSync ? '<div class="rp-widget__indicator rp-widget__indicator--sync"><strong>⚠️ Data Not Synced:</strong> Your account is showing default data. The merchant needs to run customer sync from the admin panel to display your real tier and rewards.</div>' : ''}
            </div>
          ` : ''}
        </div>
      `;

      this.attachEventListeners();
    }

    /**
     * Render "not found" state when customer doesn't exist in database
     */
    renderNotFound() {
      console.log('[RewardsWidget] Rendering not found state');

      const query = this.state.data?.query || {};

      this.root.innerHTML = `
        <div class="rp-widget rp-widget--not-found rp-widget--expanded">
          <div class="rp-widget__not-found">
            <div class="rp-widget__not-found-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 class="rp-widget__not-found-title">No Rewards Data Available</h3>
            <p class="rp-widget__not-found-message">
              Your rewards account hasn't been synced to the database yet.
              Please contact the store or wait for the merchant to complete customer synchronization.
            </p>
          </div>
        </div>
      `;
    }


    /**
     * Format currency
     */
    formatCurrency(amount) {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: this.config.shop.currency
        }).format(amount || 0);
      } catch (error) {
        // Fallback if currency code is invalid
        return '$' + (amount || 0).toFixed(2);
      }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }


    /**
     * Attach event listeners to widget
     */
    attachEventListeners() {
      const header = this.root.querySelector('.rp-widget__header');
      const toggle = this.root.querySelector('.rp-widget__toggle');

      if (header) {
        header.addEventListener('click', (e) => {
          // Don't toggle if clicking the toggle button itself
          if (!e.target.closest('.rp-widget__toggle')) {
            this.toggleExpanded();
          }
        });

        // Keyboard support
        header.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.toggleExpanded();
          }
        });
      }

      if (toggle) {
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleExpanded();
        });
      }

      // Add scroll detection for fade indicators
      this.attachScrollListeners();
    }


    /**
     * Attach scroll listeners for scroll indicators
     */
    attachScrollListeners() {
      const body = this.root.querySelector('.rp-widget__body');

      if (!body) return;

      const updateScrollIndicators = () => {
        const scrollTop = body.scrollTop;
        const scrollHeight = body.scrollHeight;
        const clientHeight = body.clientHeight;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;

        // Add 'is-scrolled' class if scrolled from top
        if (scrollTop > 10) {
          body.classList.add('is-scrolled');
        } else {
          body.classList.remove('is-scrolled');
        }

        // Add 'has-more-content' class if there's more content below
        if (scrollBottom > 10) {
          body.classList.add('has-more-content');
        } else {
          body.classList.remove('has-more-content');
        }
      };

      // Initial check
      updateScrollIndicators();

      // Update on scroll
      body.addEventListener('scroll', updateScrollIndicators);

      // Update on resize (in case content changes)
      const resizeObserver = new ResizeObserver(() => {
        updateScrollIndicators();
      });
      resizeObserver.observe(body);

      // Store cleanup function
      this._scrollCleanup = () => {
        body.removeEventListener('scroll', updateScrollIndicators);
        resizeObserver.disconnect();
      };
    }

    /**
     * Toggle expanded/collapsed state
     */
    toggleExpanded() {
      this.state.isExpanded = !this.state.isExpanded;
      this.saveExpandedState();

      if (this.state.data) {
        this.renderAuthenticated();
      }
    }

    /**
     * Load expanded state from localStorage
     */
    loadExpandedState() {
      try {
        const stored = localStorage.getItem('rp-widget-expanded');
        return stored !== 'false'; // Default to true
      } catch {
        return true;
      }
    }

    /**
     * Save expanded state to localStorage
     */
    saveExpandedState() {
      try {
        localStorage.setItem('rp-widget-expanded', String(this.state.isExpanded));
      } catch (error) {
        // Silently fail if localStorage is not available
      }
    }
  }

  /**
   * Initialize widget when DOM is ready
   */
  function initWidget() {
    const root = document.getElementById('membership-widget-root');
    if (root && !root.dataset.initialized) {
      console.log('[RewardsWidget] Initializing widget');
      new MembershipWidget(root);
    }
  }

  // Multiple initialization strategies for different scenarios
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }

  // Re-initialize on Shopify theme editor events
  if (typeof Shopify !== 'undefined') {
    document.addEventListener('shopify:section:load', initWidget);
    document.addEventListener('shopify:section:reorder', initWidget);
  }
})();
