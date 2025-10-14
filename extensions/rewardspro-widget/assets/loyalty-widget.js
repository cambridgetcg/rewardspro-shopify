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
    // Clear existing content
    this.contentEl.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'rewardspro-card';

    // Tier section
    if (data.tier) {
      const tierDiv = document.createElement('div');
      tierDiv.className = 'rewardspro-tier';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'rewardspro-tier-icon';
      iconSpan.textContent = data.tier.icon || '⭐';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'rewardspro-tier-name';
      nameSpan.textContent = data.tier.name;
      nameSpan.style.color = this.sanitizeColor(data.tier.color);

      tierDiv.appendChild(iconSpan);
      tierDiv.appendChild(nameSpan);
      card.appendChild(tierDiv);
    }

    // Balance section
    const balanceDiv = document.createElement('div');
    balanceDiv.className = 'rewardspro-balance';

    const amountDiv = document.createElement('div');
    amountDiv.className = 'rewardspro-balance-amount';
    amountDiv.textContent = this.formatPoints(data.balance);

    const labelDiv = document.createElement('div');
    labelDiv.className = 'rewardspro-balance-label';
    labelDiv.textContent = 'Points Available';

    balanceDiv.appendChild(amountDiv);
    balanceDiv.appendChild(labelDiv);
    card.appendChild(balanceDiv);

    // Progress section
    if (this.showProgress && data.progress) {
      const progressDiv = document.createElement('div');
      progressDiv.className = 'rewardspro-progress';

      const progressLabel = document.createElement('div');
      progressLabel.className = 'rewardspro-progress-label';
      progressLabel.textContent = `${data.progress.current} / ${data.progress.next} points to next tier`;

      const progressBar = document.createElement('div');
      progressBar.className = 'rewardspro-progress-bar';

      const progressFill = document.createElement('div');
      progressFill.className = 'rewardspro-progress-fill';
      progressFill.style.width = `${Math.min(100, Math.max(0, data.progress.percentage))}%`;

      const progressPercentage = document.createElement('div');
      progressPercentage.className = 'rewardspro-progress-percentage';
      progressPercentage.textContent = `${data.progress.percentage}%`;

      progressBar.appendChild(progressFill);
      progressDiv.appendChild(progressLabel);
      progressDiv.appendChild(progressBar);
      progressDiv.appendChild(progressPercentage);
      card.appendChild(progressDiv);
    }

    // Expiring points section
    if (this.showExpiring && data.expiringPoints) {
      const expiringDiv = document.createElement('div');
      expiringDiv.className = 'rewardspro-expiring';

      // Create SVG warning icon
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'rewardspro-warning-icon');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.setAttribute('fill', 'none');

      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path1.setAttribute('d', 'M8 1L1 14H15L8 1Z');
      path1.setAttribute('stroke', 'currentColor');
      path1.setAttribute('stroke-width', '2');
      path1.setAttribute('stroke-linejoin', 'round');

      const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path2.setAttribute('d', 'M8 6V9');
      path2.setAttribute('stroke', 'currentColor');
      path2.setAttribute('stroke-width', '2');
      path2.setAttribute('stroke-linecap', 'round');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '8');
      circle.setAttribute('cy', '11.5');
      circle.setAttribute('r', '0.5');
      circle.setAttribute('fill', 'currentColor');

      svg.appendChild(path1);
      svg.appendChild(path2);
      svg.appendChild(circle);

      const textSpan = document.createElement('span');
      textSpan.textContent = `${this.formatPoints(data.expiringPoints.amount)} points expiring ${this.formatDate(data.expiringPoints.date)}`;

      expiringDiv.appendChild(svg);
      expiringDiv.appendChild(textSpan);
      card.appendChild(expiringDiv);
    }

    // CTA button
    const ctaLink = document.createElement('a');
    ctaLink.href = this.sanitizeUrl(this.ctaUrl);
    ctaLink.className = 'rewardspro-cta';
    ctaLink.textContent = this.ctaText;
    card.appendChild(ctaLink);

    this.contentEl.appendChild(card);
  }

  renderCompact(data) {
    this.contentEl.innerHTML = '';

    const compact = document.createElement('div');
    compact.className = 'rewardspro-compact';

    if (data.tier) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'rewardspro-tier-icon';
      iconSpan.textContent = data.tier.icon || '⭐';
      compact.appendChild(iconSpan);
    }

    const balanceSpan = document.createElement('span');
    balanceSpan.className = 'rewardspro-balance-compact';
    balanceSpan.textContent = `${this.formatPoints(data.balance)} pts`;
    compact.appendChild(balanceSpan);

    const link = document.createElement('a');
    link.href = this.sanitizeUrl(this.ctaUrl);
    link.className = 'rewardspro-link';
    link.textContent = 'View';
    compact.appendChild(link);

    this.contentEl.appendChild(compact);
  }

  renderInline(data) {
    this.contentEl.innerHTML = '';

    const inline = document.createElement('div');
    inline.className = 'rewardspro-inline';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'rewardspro-inline-info';

    if (data.tier) {
      const badge = document.createElement('span');
      badge.className = 'rewardspro-tier-badge';
      badge.style.backgroundColor = this.sanitizeColor(data.tier.color);
      badge.textContent = `${data.tier.icon || '⭐'} ${data.tier.name}`;
      infoDiv.appendChild(badge);
    }

    const balanceSpan = document.createElement('span');
    balanceSpan.className = 'rewardspro-balance-inline';
    balanceSpan.textContent = `${this.formatPoints(data.balance)} points`;
    infoDiv.appendChild(balanceSpan);

    inline.appendChild(infoDiv);

    if (this.showProgress && data.progress) {
      const progressDiv = document.createElement('div');
      progressDiv.className = 'rewardspro-progress-inline';

      const progressBar = document.createElement('div');
      progressBar.className = 'rewardspro-progress-bar';

      const progressFill = document.createElement('div');
      progressFill.className = 'rewardspro-progress-fill';
      progressFill.style.width = `${Math.min(100, Math.max(0, data.progress.percentage))}%`;

      const progressText = document.createElement('span');
      progressText.className = 'rewardspro-progress-text';
      progressText.textContent = `${data.progress.percentage}% to next tier`;

      progressBar.appendChild(progressFill);
      progressDiv.appendChild(progressBar);
      progressDiv.appendChild(progressText);
      inline.appendChild(progressDiv);
    }

    const link = document.createElement('a');
    link.href = this.sanitizeUrl(this.ctaUrl);
    link.className = 'rewardspro-cta-inline';
    link.textContent = this.ctaText;
    inline.appendChild(link);

    this.contentEl.appendChild(inline);
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

    // Clear existing content
    this.errorEl.innerHTML = '';

    // Build setup message with DOM APIs (XSS-safe)
    const setupDiv = document.createElement('div');
    setupDiv.className = 'rewardspro-setup-required';

    const heading = document.createElement('h3');
    heading.textContent = 'Setup Required';
    setupDiv.appendChild(heading);

    const para1 = document.createElement('p');
    para1.textContent = 'The RewardsPro app needs to configure your rewards data.';
    setupDiv.appendChild(para1);

    const para2 = document.createElement('p');
    para2.className = 'rewardspro-setup-note';

    const strong = document.createElement('strong');
    strong.textContent = 'For merchants:';
    para2.appendChild(strong);

    para2.appendChild(document.createTextNode(' Please contact '));

    const link = document.createElement('a');
    link.href = 'mailto:support@rewardspro.app';
    link.textContent = 'support@rewardspro.app';
    para2.appendChild(link);

    para2.appendChild(document.createTextNode(' or check the app admin panel to complete setup.'));
    setupDiv.appendChild(para2);

    this.errorEl.appendChild(setupDiv);

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

  /**
   * Sanitize color value to prevent XSS
   * Only allows hex colors and CSS color names
   */
  sanitizeColor(color) {
    if (!color) return '#FFD700'; // Default gold color

    // Allow hex colors (#RGB or #RRGGBB)
    if (/^#([0-9A-F]{3}){1,2}$/i.test(color)) {
      return color;
    }

    // Allow rgb/rgba
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i.test(color)) {
      return color;
    }

    // Allow hsl/hsla
    if (/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(,\s*[\d.]+\s*)?\)$/i.test(color)) {
      return color;
    }

    // Fallback to default
    console.warn('[RewardsPro] Invalid color value:', color);
    return '#FFD700';
  }

  /**
   * Sanitize URL to prevent javascript: and data: URLs
   */
  sanitizeUrl(url) {
    if (!url) return '/account';

    const urlString = String(url).trim().toLowerCase();

    // Block dangerous protocols
    if (urlString.startsWith('javascript:') ||
        urlString.startsWith('data:') ||
        urlString.startsWith('vbscript:')) {
      console.warn('[RewardsPro] Blocked dangerous URL:', url);
      return '/account';
    }

    return url;
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
