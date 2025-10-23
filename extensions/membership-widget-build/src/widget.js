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
      this.debugInfo = {
        errors: [],
        requests: [],
        timestamp: new Date().toISOString()
      };

      console.log('[MembershipWidget JS] Extracted data:', this.data);

      this.state = {
        isExpanded: this.getStoredState(),
        showDebugInfo: this.root.dataset.debug === 'true' || window.location.search.includes('debug=true')
      };

      console.log('[MembershipWidget JS] Initial state:', this.state);
      console.log('[MembershipWidget JS] Debug mode:', this.state.showDebugInfo);

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
            success: true,
            enrolled: true,
            balance: 50.00,
            tier: {
              id: 'mock-tier',
              name: 'Gold',
              icon: '⭐',
              color: '#FFD700'
            },
            memberData: {
              storeCredit: '$50.00',
              storeCreditRaw: 50.00,
              tierName: 'Gold',
              cashbackRate: 5
            }
          };
        } else {
          // BACKWARD COMPATIBILITY: Keep manual customer ID parameter for now
          // In future, this will be removed when all stores use Customer Accounts
          const url = this.data.shopifyCustomerId
            ? `${this.data.apiUrl}?shopifyCustomerId=${encodeURIComponent(this.data.shopifyCustomerId)}`
            : this.data.apiUrl; // No param - Shopify will add logged_in_customer_id automatically

          const requestInfo = {
            url: url,
            fullUrl: window.location.origin + url,
            method: 'GET',
            timestamp: new Date().toISOString(),
            shopifyCustomerId: this.data.shopifyCustomerId || null,
            shopDomain: window.Shopify?.shop || 'unknown',
            pageUrl: window.location.href
          };

          console.log('[MembershipWidget JS] 📡 API Request Details:');
          console.log('  - API URL (base):', this.data.apiUrl);
          console.log('  - Shopify Customer ID:', this.data.shopifyCustomerId || 'none (using automatic)');
          console.log('  - Full URL:', url);
          console.log('  - Method: GET');
          console.log('  - Credentials: same-origin');
          console.log('  - Shop Domain:', requestInfo.shopDomain);
          console.log('  - Page URL:', requestInfo.pageUrl);
          console.log('  - Timestamp:', requestInfo.timestamp);

          this.debugInfo.requests.push(requestInfo);

          const requestStartTime = Date.now();
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            credentials: 'same-origin' // App proxy is same-origin
          });
          const requestDuration = Date.now() - requestStartTime;

          const responseInfo = {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: {
              contentType: response.headers.get('content-type'),
              cacheControl: response.headers.get('cache-control'),
              xResponseTime: response.headers.get('x-response-time'),
              xRateLimitLimit: response.headers.get('x-ratelimit-limit'),
              xRateLimitRemaining: response.headers.get('x-ratelimit-remaining')
            },
            duration: requestDuration,
            timestamp: new Date().toISOString()
          };

          console.log('[MembershipWidget JS] 📥 API Response:');
          console.log('  - Status:', responseInfo.status);
          console.log('  - Status Text:', responseInfo.statusText);
          console.log('  - OK:', responseInfo.ok);
          console.log('  - Duration:', responseInfo.duration + 'ms');
          console.log('  - Headers:', responseInfo.headers);

          if (!response.ok) {
            let errorMessage = 'Unable to load rewards data';
            let errorData = null;
            let responseBody = null;

            try {
              const responseText = await response.text();
              responseBody = responseText;

              try {
                errorData = JSON.parse(responseText);
                errorMessage = errorData.message || errorData.error || errorMessage;
              } catch {
                // Not JSON, use response text if available
                if (responseText && responseText.length < 200) {
                  responseBody = responseText;
                }
              }
            } catch {
              responseBody = 'Unable to read response body';
            }

            // Set user-friendly messages based on status code
            let userMessage = errorMessage;
            switch (response.status) {
              case 401:
                userMessage = 'Please ask your store admin to install RewardsPro';
                break;
              case 403:
                userMessage = 'App not installed or access denied';
                break;
              case 404:
                userMessage = 'Rewards service not found. Please contact support.';
                break;
              case 429:
                userMessage = 'Too many requests. Please try again in a minute.';
                break;
              case 500:
              case 503:
                userMessage = 'Service temporarily unavailable. Please try again later.';
                break;
              default:
                if (!errorData) {
                  userMessage = `Error loading rewards (HTTP ${response.status})`;
                }
            }

            const errorDetails = {
              type: 'HTTP_ERROR',
              message: userMessage,
              status: response.status,
              statusText: response.statusText,
              request: requestInfo,
              response: responseInfo,
              responseBody: responseBody,
              errorData: errorData,
              timestamp: new Date().toISOString()
            };

            this.debugInfo.errors.push(errorDetails);

            console.error('[MembershipWidget JS] ❌ API Error Details:');
            console.error('  - Status:', response.status);
            console.error('  - Status Text:', response.statusText);
            console.error('  - Error Message:', userMessage);
            console.error('  - Full URL attempted:', url);
            console.error('  - Response Body:', responseBody);
            console.error('  - Duration:', requestDuration + 'ms');
            console.error('  - Complete Error Details:', errorDetails);

            this.showError(userMessage, errorDetails);
            return;
          }

          apiData = await response.json();
          console.log('[MembershipWidget JS] ✅ API Data received:', apiData);
        }

        // Handle guest users (not logged in)
        if (apiData.success && apiData.requiresLogin) {
          console.log('[MembershipWidget JS] ℹ️ Guest user - not logged in');
          this.showInfo(apiData.message || 'Please log in to view your rewards');
          return;
        }

        // Handle non-enrolled customers
        if (apiData.success && apiData.enrolled === false) {
          console.log('[MembershipWidget JS] ℹ️ Customer not enrolled in rewards program');
          this.showInfo(apiData.message || 'Join our rewards program to start earning!');
          return;
        }

        // Parse response data (supports both old and new formats)
        // NEW FORMAT: Use memberData if available
        if (apiData.memberData) {
          this.data.tier = apiData.memberData.tierName;
          this.data.balance = apiData.memberData.storeCreditRaw;
          this.data.balanceFormatted = apiData.memberData.storeCredit;
          this.data.cashbackRate = apiData.memberData.cashbackRate;
          console.log('[MembershipWidget JS] ✅ Using new memberData format');
        }
        // OLD FORMAT: Fallback to legacy format
        else {
          this.data.tier = apiData.tier?.name || null;
          this.data.balance = apiData.balance || 0;
          this.data.balanceFormatted = null; // Will format manually
          console.log('[MembershipWidget JS] ⚠️ Using legacy format (fallback)');
        }

        this.data.currency = this.data.shopCurrency;

        console.log('[MembershipWidget JS] Updated data:', {
          tier: this.data.tier,
          balance: this.data.balance,
          balanceFormatted: this.data.balanceFormatted,
          cashbackRate: this.data.cashbackRate,
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
          this.showInfo('Not enrolled in rewards program');
        }

      } catch (error) {
        const errorDetails = {
          type: error.name || 'UNKNOWN_ERROR',
          message: error.message || 'Failed to load rewards data',
          stack: error.stack?.split('\n').slice(0, 5),
          networkError: error instanceof TypeError && error.message.includes('fetch'),
          timestamp: new Date().toISOString(),
          pageUrl: window.location.href,
          shopDomain: window.Shopify?.shop || 'unknown'
        };

        this.debugInfo.errors.push(errorDetails);

        console.error('[MembershipWidget JS] ========== FETCH FAILED ==========');
        console.error('[MembershipWidget JS] ❌ Error Type:', errorDetails.type);
        console.error('[MembershipWidget JS] ❌ Error Message:', errorDetails.message);
        console.error('[MembershipWidget JS] ❌ Is Network Error:', errorDetails.networkError);
        console.error('[MembershipWidget JS] ❌ Stack Trace:', errorDetails.stack);
        console.error('[MembershipWidget JS] ❌ Complete Error Details:', errorDetails);
        console.error('[MembershipWidget JS] Full error object:', error);

        let userMessage = 'Failed to load rewards data';
        if (errorDetails.networkError) {
          userMessage = 'Network error - Unable to reach rewards service';
        }

        this.showError(userMessage, errorDetails);
      }
    }

    showError(message, errorDetails = null) {
      // Always expand widget to show error message
      this.state.isExpanded = true;
      this.saveState();

      let debugInfoHtml = '';

      if (this.state.showDebugInfo && errorDetails) {
        const debugData = {
          errorType: errorDetails.type,
          timestamp: errorDetails.timestamp || new Date().toISOString(),
          ...(errorDetails.status && { httpStatus: errorDetails.status }),
          ...(errorDetails.statusText && { statusText: errorDetails.statusText }),
          ...(errorDetails.request && {
            requestUrl: errorDetails.request.url,
            shopDomain: errorDetails.request.shopDomain,
            customerId: errorDetails.request.shopifyCustomerId
          }),
          ...(errorDetails.response && {
            duration: errorDetails.response.duration + 'ms',
            contentType: errorDetails.response.headers?.contentType
          }),
          ...(errorDetails.networkError !== undefined && { networkError: errorDetails.networkError }),
          ...(errorDetails.responseBody && { responseBody: errorDetails.responseBody }),
          ...(errorDetails.stack && { stack: errorDetails.stack.join('\\n') })
        };

        debugInfoHtml = `
          <details style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 11px;">
            <summary style="cursor: pointer; font-weight: bold; color: #495057;">🔍 Debug Information (Click to expand)</summary>
            <pre style="margin: 10px 0 0 0; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; color: #212529;">${this.escapeHtml(JSON.stringify(debugData, null, 2))}</pre>
            <button onclick="navigator.clipboard.writeText(JSON.stringify(${this.escapeHtml(JSON.stringify(debugData))}, null, 2)); this.textContent='✓ Copied!';" style="margin-top: 8px; padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">📋 Copy Debug Info</button>
          </details>
        `;
      }

      this.root.innerHTML = `
        <div class="membership-widget membership-widget--bottom-right membership-widget--expanded" role="complementary" aria-label="Rewards Information">
          <div class="membership-widget__header" role="button" tabindex="0" aria-expanded="true">
            <div class="membership-widget__tier">
              <span class="membership-widget__tier-name">Rewards</span>
            </div>
            <button class="membership-widget__toggle" aria-label="Collapse widget">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="membership-widget__toggle-icon membership-widget__toggle-icon--expanded">
                <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="membership-widget__content">
            <div style="padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin: 10px 0;">
              <strong style="color: #856404;">⚠️ ${this.escapeHtml(message)}</strong>
              ${debugInfoHtml}
            </div>
          </div>
        </div>
      `;

      // Attach event listeners for toggle functionality
      this.attachEventListeners();
    }

    showInfo(message) {
      // Always expand widget to show info message
      this.state.isExpanded = true;
      this.saveState();

      this.root.innerHTML = `
        <div class="membership-widget membership-widget--bottom-right membership-widget--expanded" role="complementary" aria-label="Rewards Information">
          <div class="membership-widget__header" role="button" tabindex="0" aria-expanded="true">
            <div class="membership-widget__tier">
              <span class="membership-widget__tier-name">Rewards</span>
            </div>
            <button class="membership-widget__toggle" aria-label="Collapse widget">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="membership-widget__toggle-icon membership-widget__toggle-icon--expanded">
                <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="membership-widget__content">
            <div style="padding: 15px; background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px; margin: 10px 0;">
              <strong style="color: #0c5460;">ℹ️ ${this.escapeHtml(message)}</strong>
            </div>
          </div>
        </div>
      `;

      // Attach event listeners for toggle functionality
      this.attachEventListeners();
    }

    extractData() {
      const data = {
        apiUrl: this.root.dataset.apiUrl || '/apps/rewardspromembership/loyalty',
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

      // Use pre-formatted balance if available, otherwise format manually
      const formattedBalance = this.data.balanceFormatted || this.formatCurrency(this.data.balance);

      this.root.innerHTML = `
        <div class="membership-widget membership-widget--bottom-right ${expandedClass}" role="complementary" aria-label="Rewards Information">
          <div class="membership-widget__header" role="button" tabindex="0" aria-expanded="${this.state.isExpanded}">
            <div class="membership-widget__tier">
              <span class="membership-widget__tier-name">Rewards</span>
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
                <span class="membership-widget__amount">${formattedBalance}</span>
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
