/**
 * RewardsPro Loyalty Widget
 * Loads and displays customer loyalty data on storefront
 */

class RewardsProWidget {
  constructor(element) {
    this.element = element;
    this.customerId = element.dataset.customerId;
    this.shop = element.dataset.shop;
    this.apiUrl = element.dataset.apiUrl; // App backend URL
    this.variant = element.dataset.variant || 'card';
    this.showProgress = element.dataset.showProgress === 'true';
    this.showExpiring = element.dataset.showExpiring === 'true';
    this.ctaText = element.dataset.ctaText || 'View Rewards';
    this.ctaUrl = element.dataset.ctaUrl || '/account';

    this.loadingEl = element.querySelector('.rewardspro-widget-loading');
    this.errorEl = element.querySelector('.rewardspro-widget-error');
    this.contentEl = element.querySelector('.rewardspro-widget-content');

    this.cacheKey = `rewardspro_loyalty_${this.customerId}`;
    this.cacheTTL = 30000; // 30 seconds

    this.init();
  }

  async init() {
    // Try to load from cache first
    const cachedData = this.getFromCache();
    if (cachedData) {
      this.render(cachedData);
      // Fetch fresh data in background
      this.fetchData(true);
    } else {
      // No cache, show loading and fetch
      await this.fetchData(false);
    }
  }

  getFromCache() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < this.cacheTTL) {
        return data;
      }

      // Cache expired
      localStorage.removeItem(this.cacheKey);
      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  setCache(data) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  async fetchData(background = false) {
    // Check if metafield exists and is valid
    if (!this.customerId || this.customerId === 'null' || this.customerId === 'undefined') {
      this.showSetupRequired();
      return;
    }

    if (!this.shop) {
      this.showError('Missing shop information');
      return;
    }

    if (!this.apiUrl) {
      this.showError('App API URL not configured');
      return;
    }

    try {
      const apiUrl = new URL('/api/storefront/loyalty', this.apiUrl);
      apiUrl.searchParams.set('customerId', this.customerId);
      apiUrl.searchParams.set('shop', this.shop);

      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the fresh data
      this.setCache(data);

      // Only update UI if not background refresh
      if (!background) {
        this.render(data);
      }
    } catch (error) {
      console.error('Failed to fetch loyalty data:', error);
      if (!background) {
        this.showError(error.message);
      }
    }
  }

  render(data) {
    if (!data) {
      this.showError('No data available');
      return;
    }

    // Hide loading, show content
    this.loadingEl.style.display = 'none';
    this.errorEl.style.display = 'none';
    this.contentEl.style.display = 'block';

    // Render based on variant
    switch (this.variant) {
      case 'compact':
        this.renderCompact(data);
        break;
      case 'inline':
        this.renderInline(data);
        break;
      case 'card':
      default:
        this.renderCard(data);
        break;
    }

    // Add fade-in animation
    this.contentEl.classList.add('rewardspro-fade-in');
  }

  renderCard(data) {
    const html = `
      <div class="rewardspro-card">
        ${data.tier ? `
          <div class="rewardspro-tier">
            <span class="rewardspro-tier-icon">${data.tier.icon}</span>
            <span class="rewardspro-tier-name" style="color: ${data.tier.color}">${data.tier.name}</span>
          </div>
        ` : ''}

        <div class="rewardspro-balance">
          <div class="rewardspro-balance-amount">${this.formatPoints(data.balance)}</div>
          <div class="rewardspro-balance-label">Points Available</div>
        </div>

        ${this.showProgress && data.progress ? `
          <div class="rewardspro-progress">
            <div class="rewardspro-progress-label">
              ${data.progress.current} / ${data.progress.next} points to next tier
            </div>
            <div class="rewardspro-progress-bar">
              <div class="rewardspro-progress-fill" style="width: ${data.progress.percentage}%"></div>
            </div>
            <div class="rewardspro-progress-percentage">${data.progress.percentage}%</div>
          </div>
        ` : ''}

        ${this.showExpiring && data.expiringPoints ? `
          <div class="rewardspro-expiring">
            <svg class="rewardspro-warning-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L1 14H15L8 1Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <path d="M8 6V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <circle cx="8" cy="11.5" r="0.5" fill="currentColor"/>
            </svg>
            <span>${this.formatPoints(data.expiringPoints.amount)} points expiring ${this.formatDate(data.expiringPoints.date)}</span>
          </div>
        ` : ''}

        <a href="${this.ctaUrl}" class="rewardspro-cta">
          ${this.ctaText}
        </a>
      </div>
    `;
    this.contentEl.innerHTML = html;
  }

  renderCompact(data) {
    const html = `
      <div class="rewardspro-compact">
        ${data.tier ? `
          <span class="rewardspro-tier-icon">${data.tier.icon}</span>
        ` : ''}
        <span class="rewardspro-balance-compact">${this.formatPoints(data.balance)} pts</span>
        <a href="${this.ctaUrl}" class="rewardspro-link">View</a>
      </div>
    `;
    this.contentEl.innerHTML = html;
  }

  renderInline(data) {
    const html = `
      <div class="rewardspro-inline">
        <div class="rewardspro-inline-info">
          ${data.tier ? `
            <span class="rewardspro-tier-badge" style="background-color: ${data.tier.color}">
              ${data.tier.icon} ${data.tier.name}
            </span>
          ` : ''}
          <span class="rewardspro-balance-inline">${this.formatPoints(data.balance)} points</span>
        </div>
        ${this.showProgress && data.progress ? `
          <div class="rewardspro-progress-inline">
            <div class="rewardspro-progress-bar">
              <div class="rewardspro-progress-fill" style="width: ${data.progress.percentage}%"></div>
            </div>
            <span class="rewardspro-progress-text">${data.progress.percentage}% to next tier</span>
          </div>
        ` : ''}
        <a href="${this.ctaUrl}" class="rewardspro-cta-inline">${this.ctaText}</a>
      </div>
    `;
    this.contentEl.innerHTML = html;
  }

  showError(message) {
    this.loadingEl.style.display = 'none';
    this.contentEl.style.display = 'none';
    this.errorEl.style.display = 'block';
    console.error('RewardsPro Widget Error:', message);
  }

  showSetupRequired() {
    this.loadingEl.style.display = 'none';
    this.contentEl.style.display = 'none';
    this.errorEl.style.display = 'block';

    // Update error element with setup message
    this.errorEl.innerHTML = `
      <div class="rewardspro-setup-required">
        <h3>Setup Required</h3>
        <p>The RewardsPro app needs to configure your rewards data.</p>
        <p class="rewardspro-setup-note">
          <strong>For merchants:</strong> Please contact <a href="mailto:support@rewardspro.app">support@rewardspro.app</a>
          or check the app admin panel to complete setup.
        </p>
      </div>
    `;

    console.warn('[RewardsPro] Customer metafield not set. Merchants should run the setup endpoint in the app admin.');
  }

  formatPoints(points) {
    return new Intl.NumberFormat('en-US').format(points);
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays < 7) return `in ${diffDays} days`;
    if (diffDays < 30) return `in ${Math.ceil(diffDays / 7)} weeks`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// Initialize all widgets on page
document.addEventListener('DOMContentLoaded', () => {
  const widgets = document.querySelectorAll('.rewardspro-loyalty-widget');
  widgets.forEach(widget => {
    new RewardsProWidget(widget);
  });
});

// Re-initialize on Shopify section rendering (theme editor)
if (window.Shopify && window.Shopify.designMode) {
  document.addEventListener('shopify:section:load', () => {
    const widgets = document.querySelectorAll('.rewardspro-loyalty-widget');
    widgets.forEach(widget => {
      if (!widget.dataset.initialized) {
        new RewardsProWidget(widget);
        widget.dataset.initialized = 'true';
      }
    });
  });
}
