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
              <div class="rp-widget__debug">
                <div class="rp-widget__debug-header">
                  <div class="rp-widget__debug-title">🔧 Debug Info</div>
                  <button class="rp-widget__refresh-btn" data-action="refresh" title="Clear cache and fetch fresh data">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M13.65 2.35A7.5 7.5 0 1 0 15.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      <path d="M12 1L13.65 2.35L12 3.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Refresh Data</span>
                  </button>
                </div>
                <div class="rp-widget__debug-item">
                  <span class="rp-widget__debug-label">Email:</span>
                  <span class="rp-widget__debug-value">${this.escapeHtml(this.config.customer.email)}</span>
                </div>
                <div class="rp-widget__debug-item">
                  <span class="rp-widget__debug-label">Store:</span>
                  <span class="rp-widget__debug-value">${this.escapeHtml(this.config.shop.domain)}</span>
                </div>
                <div class="rp-widget__debug-item">
                  <span class="rp-widget__debug-label">Customer ID:</span>
                  <span class="rp-widget__debug-value">${this.escapeHtml(this.config.customer.id)}</span>
                </div>
              </div>
              <div class="rp-widget__debug-log">
                <div class="rp-widget__debug-log-title">📊 Data Fetch Log</div>
                <div class="rp-widget__debug-log-item">
                  <span class="rp-widget__debug-log-label">Method:</span>
                  <span class="rp-widget__debug-log-value rp-widget__debug-log-badge rp-widget__debug-log-badge--${this.getDataSourceBadgeClass()}">${this.getDataSourceLabel()}</span>
                </div>
                <div class="rp-widget__debug-log-item">
                  <span class="rp-widget__debug-log-label">Tier Fetched:</span>
                  <span class="rp-widget__debug-log-value">${this.escapeHtml(membership.tier.name)} (${membership.tier.cashbackPercent}%)</span>
                </div>
                <div class="rp-widget__debug-log-item">
                  <span class="rp-widget__debug-log-label">Store Credit:</span>
                  <span class="rp-widget__debug-log-value">${this.formatCurrency(balance.storeCredit)}</span>
                </div>
                <div class="rp-widget__debug-log-item">
                  <span class="rp-widget__debug-log-label">Total Earned:</span>
                  <span class="rp-widget__debug-log-value">${this.formatCurrency(balance.totalEarned)}</span>
                </div>
                <div class="rp-widget__debug-log-item">
                  <span class="rp-widget__debug-log-label">Last Sync:</span>
                  <span class="rp-widget__debug-log-value">${balance.lastSynced ? new Date(balance.lastSynced).toLocaleString() : 'Never'}</span>
                </div>
                <div class="rp-widget__debug-log-item">
                  <span class="rp-widget__debug-log-label">Fetch Time:</span>
                  <span class="rp-widget__debug-log-value">${this.state.lastFetch ? new Date(this.state.lastFetch).toLocaleTimeString() : 'N/A'}</span>
                </div>
              </div>
              <div class="rp-widget__api-journey">
                <div class="rp-widget__api-journey-title">🔄 API Request Journey</div>
                <div class="rp-widget__api-journey-steps">
                  ${this.renderApiJourneySteps()}
                </div>
                <div class="rp-widget__api-journey-summary">
                  <div class="rp-widget__journey-summary-item">
                    <span class="rp-widget__journey-summary-label">Total Time:</span>
                    <span class="rp-widget__journey-summary-value">${this.getJourneyTotalTime()}</span>
                  </div>
                  <div class="rp-widget__journey-summary-item">
                    <span class="rp-widget__journey-summary-label">Status:</span>
                    <span class="rp-widget__journey-summary-value rp-widget__journey-status--${this.getJourneyStatus()}">${this.getJourneyStatusText()}</span>
                  </div>
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

            <div class="rp-widget__query-info">
              <div class="rp-widget__query-info-title">📋 Query Information</div>
              <div class="rp-widget__query-info-content">
                <div class="rp-widget__query-item">
                  <span class="rp-widget__query-label">Shop:</span>
                  <span class="rp-widget__query-value">${this.escapeHtml(query.shopDomain || this.config.shop.domain)}</span>
                </div>
                <div class="rp-widget__query-item">
                  <span class="rp-widget__query-label">Customer ID:</span>
                  <span class="rp-widget__query-value">${this.escapeHtml(query.shopifyCustomerId || this.config.customer.id)}</span>
                </div>
                <div class="rp-widget__query-item">
                  <span class="rp-widget__query-label">Email:</span>
                  <span class="rp-widget__query-value">${this.escapeHtml(this.config.customer.email)}</span>
                </div>
                <div class="rp-widget__query-item">
                  <span class="rp-widget__query-label">Endpoint:</span>
                  <span class="rp-widget__query-value">${this.escapeHtml(query.endpoint || 'N/A')}</span>
                </div>
                <div class="rp-widget__query-item">
                  <span class="rp-widget__query-label">Status:</span>
                  <span class="rp-widget__query-value rp-widget__query-status--not-found">Customer Not Found in Database</span>
                </div>
                <div class="rp-widget__query-item">
                  <span class="rp-widget__query-label">Message:</span>
                  <span class="rp-widget__query-value">${this.escapeHtml(this.state.data?.message || 'No data')}</span>
                </div>
                <div class="rp-widget__query-item">
                  <span class="rp-widget__query-label">Query Time:</span>
                  <span class="rp-widget__query-value">${this.state.lastFetch ? new Date(this.state.lastFetch).toLocaleString() : 'N/A'}</span>
                </div>
                <div class="rp-widget__query-item">
                  <span class="rp-widget__query-label">Query Method:</span>
                  <span class="rp-widget__query-value">${this.escapeHtml(query.method || 'N/A')}</span>
                </div>
                <div class="rp-widget__query-item">
                  <span class="rp-widget__query-label">Execution Time:</span>
                  <span class="rp-widget__query-value">${this.escapeHtml(query.executionTime || 'N/A')}</span>
                </div>
              </div>
            </div>

            <div class="rp-widget__not-found-action">
              <p class="rp-widget__not-found-help">
                <strong>For Store Owners:</strong> Run customer sync from Admin → Customers → Sync Customers
              </p>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * Render API journey steps with detailed status
     */
    renderApiJourneySteps() {
      const query = this.state.data?.query || {};
      const hasQueryData = this.state.data?.success && query && query.method;
      const hasValidQuery = query.method && query.executionTime;

      // Debug logging
      if (this.state.data && !hasValidQuery) {
        console.log('[RewardsWidget] ⚠️ Query metadata missing from response:', {
          hasData: !!this.state.data,
          hasQueryObject: !!this.state.data.query,
          queryKeys: this.state.data.query ? Object.keys(this.state.data.query) : [],
          dataSource: this.state.dataSource,
          fullResponse: this.state.data
        });
      }

      const steps = [
        {
          number: 1,
          title: 'Request Initiated',
          description: `Widget sent request to fetch customer data`,
          details: [
            `Shop: ${this.escapeHtml(this.config.shop.domain)}`,
            `Customer ID: ${this.escapeHtml(this.config.customer?.id || 'N/A')}`,
            `Endpoint: ${this.escapeHtml(this.config.api.endpoint || 'N/A')}`
          ],
          status: this.state.lastFetch ? 'success' : 'pending',
          timestamp: this.state.lastFetch ? new Date(this.state.lastFetch).toLocaleTimeString() : null
        },
        {
          number: 2,
          title: 'Shopify Proxy Intercept',
          description: 'Request routed through Shopify app proxy infrastructure',
          details: [
            'HMAC signature added for authentication',
            'Customer session validated',
            'Request forwarded to backend server'
          ],
          status: hasQueryData ? 'success' : 'pending',
          timestamp: null
        },
        {
          number: 3,
          title: 'Backend Authentication',
          description: 'Server validated Shopify HMAC signature',
          details: [
            'HMAC verification: ' + (hasQueryData ? '✓ Passed' : 'Pending'),
            'Shop domain verified: ' + (query.shopDomain || this.config.shop.domain),
            'Customer authorized: ' + (query.shopifyCustomerId || this.config.customer?.id || 'N/A')
          ],
          status: hasQueryData ? 'success' : 'pending',
          timestamp: null
        },
        {
          number: 4,
          title: 'Database Query Execution',
          description: hasValidQuery ? query.method : (this.state.data?.success ? 'Query metadata not available (using Prisma ORM fallback)' : 'Executing SQL query against database'),
          details: hasValidQuery ? [
            `Query Type: ${query.method}`,
            `Execution Time: ${query.executionTime}`,
            `Records Found: ${query.foundInDatabase ? '1 customer record' : 'No records'}`,
            `Tables Joined: Customer ⋈ Tier`
          ] : [
            `Query Type: ${this.state.data?.success ? 'Prisma ORM (no direct SQL metadata)' : 'Unknown'}`,
            `Execution Time: ${this.state.data?.success ? 'Not measured' : 'N/A'}`,
            `Records Found: ${this.state.data?.customer ? '1 customer record' : 'No records'}`,
            `Method: ${this.state.data?.success ? 'Prisma fallback query' : 'Pending'}`
          ],
          status: this.state.data?.success ? (this.state.data?.customer ? 'success' : 'warning') : 'pending',
          timestamp: null
        },
        {
          number: 5,
          title: 'Data Transformation',
          description: 'Raw database results transformed to API response',
          details: [
            `Customer Data: ${this.state.data?.customer ? '✓ Mapped' : 'Pending'}`,
            `Balance Data: ${this.state.data?.balance ? '✓ Calculated' : 'Pending'}`,
            `Membership Tier: ${this.state.data?.membership?.tier?.name || 'Pending'}`,
            `Response Format: JSON`
          ],
          status: this.state.data?.customer ? 'success' : 'pending',
          timestamp: null
        },
        {
          number: 6,
          title: 'Response Returned',
          description: 'Server sent JSON response back to widget',
          details: [
            `Status: ${this.state.data?.success ? '200 OK' : 'Error'}`,
            `Data Source: ${this.getDataSourceLabel()}`,
            `Response Size: ${this.state.data ? this.estimateResponseSize() : 'N/A'}`,
            `Cache Status: ${this.state.dataSource === 'cache' ? 'Hit' : 'Miss'}`
          ],
          status: this.state.data ? 'success' : 'pending',
          timestamp: null
        },
        {
          number: 7,
          title: 'Widget Rendering',
          description: 'Data displayed in widget UI',
          details: [
            `Tier Displayed: ${this.state.data?.membership?.tier?.name || 'Pending'}`,
            `Store Credit: ${this.state.data?.balance ? this.formatCurrency(this.state.data.balance.storeCredit) : 'Pending'}`,
            `UI State: ${this.state.isExpanded ? 'Expanded' : 'Collapsed'}`,
            `Render Time: ${this.state.lastFetch ? 'Complete' : 'Pending'}`
          ],
          status: this.state.data ? 'success' : 'pending',
          timestamp: this.state.lastFetch ? new Date(this.state.lastFetch).toLocaleTimeString() : null
        }
      ];

      return steps.map(step => `
        <div class="rp-widget__journey-step rp-widget__journey-step--${step.status}">
          <div class="rp-widget__journey-step-header">
            <div class="rp-widget__journey-step-number">${step.number}</div>
            <div class="rp-widget__journey-step-info">
              <div class="rp-widget__journey-step-title">
                ${step.title}
                <span class="rp-widget__journey-step-status rp-widget__journey-status--${step.status}">
                  ${this.getStatusIcon(step.status)}
                </span>
              </div>
              <div class="rp-widget__journey-step-description">${step.description}</div>
            </div>
          </div>
          <div class="rp-widget__journey-step-details">
            ${step.details.map(detail => `
              <div class="rp-widget__journey-detail">→ ${detail}</div>
            `).join('')}
            ${step.timestamp ? `<div class="rp-widget__journey-timestamp">⏱️ ${step.timestamp}</div>` : ''}
          </div>
        </div>
      `).join('');
    }

    /**
     * Get status icon for journey step
     */
    getStatusIcon(status) {
      switch(status) {
        case 'success': return '✓';
        case 'warning': return '⚠';
        case 'error': return '✗';
        case 'pending': return '○';
        default: return '?';
      }
    }

    /**
     * Get total journey time
     */
    getJourneyTotalTime() {
      const execTime = this.state.data?.query?.executionTime;
      if (execTime) {
        return `${execTime} (query) + network latency`;
      }
      return 'N/A';
    }

    /**
     * Get overall journey status
     */
    getJourneyStatus() {
      if (!this.state.data) return 'pending';
      if (!this.state.data.success) return 'error';
      if (!this.state.data.query?.foundInDatabase) return 'warning';
      return 'success';
    }

    /**
     * Get journey status text
     */
    getJourneyStatusText() {
      const status = this.getJourneyStatus();
      switch(status) {
        case 'success': return '✓ All Steps Completed';
        case 'warning': return '⚠ Completed with Warnings';
        case 'error': return '✗ Failed';
        case 'pending': return '○ In Progress';
        default: return 'Unknown';
      }
    }

    /**
     * Estimate response size in KB
     */
    estimateResponseSize() {
      if (!this.state.data) return '0 KB';
      const jsonString = JSON.stringify(this.state.data);
      const bytes = new Blob([jsonString]).size;
      const kb = (bytes / 1024).toFixed(2);
      return `${kb} KB`;
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
     * Get data source label for debug display
     */
    getDataSourceLabel() {
      switch(this.state.dataSource) {
        case 'fresh':
          return '🟢 Fresh API';
        case 'cache':
          return '🟡 Cached';
        case 'cache-stale':
          return '🟠 Stale Cache';
        case 'fallback':
          return '🔴 Fallback';
        case 'not_found':
          return '🔴 Not Found';
        default:
          return '⚪ Unknown';
      }
    }

    /**
     * Get CSS class for data source badge
     */
    getDataSourceBadgeClass() {
      switch(this.state.dataSource) {
        case 'fresh':
          return 'fresh';
        case 'cache':
          return 'cache';
        case 'cache-stale':
          return 'stale';
        case 'fallback':
          return 'fallback';
        case 'not_found':
          return 'fallback'; // Use same styling as fallback (red)
        default:
          return 'unknown';
      }
    }

    /**
     * Attach event listeners to widget
     */
    attachEventListeners() {
      const header = this.root.querySelector('.rp-widget__header');
      const toggle = this.root.querySelector('.rp-widget__toggle');
      const refreshBtn = this.root.querySelector('[data-action="refresh"]');

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

      // Refresh button
      if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleRefresh();
        });
      }

      // Add scroll detection for fade indicators
      this.attachScrollListeners();
    }

    /**
     * Handle refresh button click
     */
    async handleRefresh() {
      console.log('[RewardsWidget] 🔄 Refresh button clicked');

      const refreshBtn = this.root.querySelector('[data-action="refresh"]');

      // Add loading state to button
      if (refreshBtn) {
        refreshBtn.classList.add('rp-widget__refresh-btn--loading');
        refreshBtn.disabled = true;
      }

      try {
        // Clear cache for this customer
        this.clearCache();
        console.log('[RewardsWidget] 🗑️ Cache cleared');

        // Show loading state in widget
        this.state.isLoading = true;
        this.renderLoading();

        // Fetch fresh data with cache-busting parameter
        console.log('[RewardsWidget] 📞 Fetching fresh data...');
        await this.fetchCustomerData();

        console.log('[RewardsWidget] ✅ Refresh complete');

        // Show success feedback
        this.showRefreshFeedback('success', 'Data refreshed successfully!');

      } catch (error) {
        console.error('[RewardsWidget] ❌ Refresh failed:', error);
        this.showRefreshFeedback('error', 'Failed to refresh data');
      } finally {
        // Remove loading state from button
        if (refreshBtn) {
          refreshBtn.classList.remove('rp-widget__refresh-btn--loading');
          refreshBtn.disabled = false;
        }
        this.state.isLoading = false;
      }
    }

    /**
     * Clear cache for current customer
     */
    clearCache() {
      if (!this.config.customer?.id) return;

      try {
        const key = `rp-widget-${this.config.customer.id}`;
        localStorage.removeItem(key);
        console.log('[RewardsWidget] ✅ Removed cache key:', key);
      } catch (error) {
        console.error('[RewardsWidget] ❌ Failed to clear cache:', error);
      }
    }

    /**
     * Show refresh feedback message
     */
    showRefreshFeedback(type, message) {
      // Create feedback element
      const feedback = document.createElement('div');
      feedback.className = `rp-widget__refresh-feedback rp-widget__refresh-feedback--${type}`;
      feedback.textContent = message;

      // Insert after refresh button
      const refreshBtn = this.root.querySelector('[data-action="refresh"]');
      if (refreshBtn && refreshBtn.parentElement) {
        refreshBtn.parentElement.appendChild(feedback);

        // Remove after 3 seconds
        setTimeout(() => {
          feedback.style.opacity = '0';
          setTimeout(() => feedback.remove(), 300);
        }, 3000);
      }
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
