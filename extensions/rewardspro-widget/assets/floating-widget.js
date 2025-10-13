/**
 * RewardsPro Floating Widget
 * Security-hardened implementation with no innerHTML
 * Persistent across pages with minimize/maximize state
 */

(function() {
  'use strict';

  class RewardsProFloatingWidget {
    constructor(config) {
      this.config = config || window.RewardsProConfig || {};
      this.state = {
        isMinimized: false,
        isLoading: false,
        data: null,
        error: null,
        retryCount: 0,
        maxRetries: 3
      };

      this.locale = this.config.shop?.locale || 'en';
      this.translations = null;

      // Bind methods
      this.handleMinimize = this.handleMinimize.bind(this);
      this.handleMaximize = this.handleMaximize.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleRetry = this.handleRetry.bind(this);

      this.init();
    }

    // Secure DOM element creation (no innerHTML)
    createElement(tag, props = {}, children = []) {
      const element = document.createElement(tag);

      Object.keys(props).forEach(key => {
        if (key === 'className') {
          element.className = props[key];
        } else if (key === 'textContent') {
          element.textContent = props[key];
        } else if (key.startsWith('data-')) {
          element.setAttribute(key, props[key]);
        } else if (key.startsWith('aria-')) {
          element.setAttribute(key, props[key]);
        } else if (key === 'role') {
          element.setAttribute('role', props[key]);
        } else if (key === 'type') {
          element.type = props[key];
        } else if (key === 'href') {
          element.href = props[key];
        } else if (key === 'style' && typeof props[key] === 'object') {
          Object.assign(element.style, props[key]);
        } else if (key === 'onclick') {
          element.addEventListener('click', props[key]);
        }
      });

      children.forEach(child => {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
          element.appendChild(child);
        }
      });

      return element;
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
    }

    async setup() {
      const root = document.getElementById('rewardspro-floating-widget-root');
      if (!root) {
        console.warn('RewardsPro: Floating widget root not found');
        return;
      }

      await this.loadTranslations();

      // Check stored state
      if (this.config.settings?.rememberState) {
        const stored = this.getStoredState();
        if (stored !== null) {
          this.state.isMinimized = stored;
        } else {
          this.state.isMinimized = this.config.settings?.startMinimized ?? true;
        }
      } else {
        this.state.isMinimized = this.config.settings?.startMinimized ?? true;
      }

      this.container = this.createElement('div', {
        className: 'rp-widget-container',
        role: 'region',
        'aria-label': this.t('widget.title')
      });

      if (this.state.isMinimized) {
        this.renderMinimized();
      } else {
        this.renderExpanded();
        if (this.config.isAuthenticated) {
          this.loadData();
        }
      }

      root.appendChild(this.container);
      this.attachEventListeners();

      // Auto-hide if configured
      const autoHideDelay = this.config.settings?.autoHideDelay;
      if (autoHideDelay > 0 && !this.state.isMinimized) {
        setTimeout(() => this.handleMinimize(), autoHideDelay * 1000);
      }
    }

    async loadTranslations() {
      this.translations = {
        widget: {
          title: this.config.content?.title || 'Rewards Center',
          close: 'Close rewards widget',
          open: 'Open rewards widget',
          loading: 'Loading your rewards...',
          error: {
            title: 'Unable to load rewards data',
            retry: 'Try Again'
          },
          guest: {
            message: this.config.content?.guestMessage || 'Join our rewards program!',
            benefits: {
              cashback: 'Earn cashback on every order',
              tiers: 'Unlock exclusive member tiers',
              rewards: 'Get personalized rewards'
            },
            signin: this.config.content?.signInText || 'Sign In',
            register: this.config.content?.registerText || 'Join Now'
          },
          member: {
            balance: {
              label: 'Points Balance'
            },
            tier: {
              current: '{{tier}} Member',
              cashback: 'Earning {{rate}}% cashback'
            },
            actions: {
              dashboard: 'View Full Dashboard'
            }
          }
        }
      };
    }

    t(key, replacements = {}) {
      if (!this.translations) return key;

      const keys = key.split('.');
      let value = this.translations;

      for (const k of keys) {
        value = value?.[k];
        if (!value) break;
      }

      if (typeof value !== 'string') return key;

      return value.replace(/\{\{(\w+)\}\}/g, (match, placeholder) => {
        return replacements[placeholder] || match;
      });
    }

    renderMinimized() {
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild);
      }

      const button = this.createElement('button', {
        className: 'rp-widget-toggle rp-widget-minimized',
        'aria-label': this.t('widget.open'),
        'aria-expanded': 'false',
        type: 'button',
        onclick: this.handleMaximize
      });

      const iconSpan = this.createElement('span', {
        className: 'rp-widget-icon'
      });

      const iconStyle = this.config.settings?.iconStyle || 'emoji';
      if (iconStyle === 'svg') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'rp-icon-svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z');
        path.setAttribute('fill', 'currentColor');

        svg.appendChild(path);
        iconSpan.appendChild(svg);
      } else {
        iconSpan.textContent = '🎁';
      }

      button.appendChild(iconSpan);
      this.container.appendChild(button);
    }

    renderExpanded() {
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild);
      }

      const panel = this.createElement('div', {
        className: 'rp-widget-panel',
        role: 'dialog',
        'aria-label': this.t('widget.title')
      });

      // Header
      const header = this.createElement('div', {
        className: 'rp-widget-header'
      });

      header.appendChild(this.createElement('h3', {
        className: 'rp-widget-title',
        textContent: this.t('widget.title')
      }));

      header.appendChild(this.createElement('button', {
        className: 'rp-widget-close',
        'aria-label': this.t('widget.close'),
        type: 'button',
        onclick: this.handleMinimize
      }, ['×']));

      // Content
      const content = this.createElement('div', {
        className: 'rp-widget-content',
        role: 'main'
      });

      if (!this.config.isAuthenticated) {
        content.appendChild(this.createGuestContent());
      } else if (this.state.isLoading) {
        content.appendChild(this.createLoadingContent());
      } else if (this.state.error) {
        content.appendChild(this.createErrorContent());
      } else if (this.state.data) {
        content.appendChild(this.createMemberContent());
      } else {
        content.appendChild(this.createLoadingContent());
      }

      panel.appendChild(header);
      panel.appendChild(content);
      this.container.appendChild(panel);

      this.manageFocus();
    }

    createGuestContent() {
      const container = this.createElement('div', {
        className: 'rp-guest-prompt'
      });

      container.appendChild(this.createElement('div', {
        className: 'rp-guest-icon',
        textContent: '🎁'
      }));

      container.appendChild(this.createElement('p', {
        className: 'rp-guest-message',
        textContent: this.t('widget.guest.message')
      }));

      const benefits = this.createElement('div', {
        className: 'rp-guest-benefits'
      });

      [
        { icon: '💰', text: 'widget.guest.benefits.cashback' },
        { icon: '⭐', text: 'widget.guest.benefits.tiers' },
        { icon: '🎯', text: 'widget.guest.benefits.rewards' }
      ].forEach(item => {
        const benefit = this.createElement('div', { className: 'rp-benefit' });
        benefit.appendChild(this.createElement('span', {
          className: 'rp-benefit-icon',
          textContent: item.icon
        }));
        benefit.appendChild(this.createElement('span', {
          textContent: this.t(item.text)
        }));
        benefits.appendChild(benefit);
      });

      container.appendChild(benefits);

      const buttonGroup = this.createElement('div', {
        className: 'rp-button-group'
      });

      buttonGroup.appendChild(this.createElement('a', {
        href: this.config.urls?.login || '/account/login',
        className: 'rp-button rp-button-primary',
        textContent: this.t('widget.guest.signin')
      }));

      buttonGroup.appendChild(this.createElement('a', {
        href: this.config.urls?.register || '/account/register',
        className: 'rp-button rp-button-secondary',
        textContent: this.t('widget.guest.register')
      }));

      container.appendChild(buttonGroup);
      return container;
    }

    createLoadingContent() {
      const container = this.createElement('div', {
        className: 'rp-loading',
        role: 'status',
        'aria-live': 'polite'
      });

      container.appendChild(this.createElement('div', {
        className: 'rp-spinner',
        'aria-hidden': 'true'
      }));

      container.appendChild(this.createElement('p', {
        textContent: this.t('widget.loading')
      }));

      return container;
    }

    createErrorContent() {
      const container = this.createElement('div', {
        className: 'rp-error',
        role: 'alert'
      });

      container.appendChild(this.createElement('div', {
        className: 'rp-error-icon',
        textContent: '⚠️'
      }));

      container.appendChild(this.createElement('p', {
        textContent: this.t('widget.error.title')
      }));

      container.appendChild(this.createElement('button', {
        className: 'rp-button rp-retry-button',
        type: 'button',
        textContent: this.t('widget.error.retry'),
        onclick: this.handleRetry
      }));

      return container;
    }

    createMemberContent() {
      const data = this.state.data;
      const container = this.createElement('div', {
        className: 'rp-rewards-info'
      });

      // Balance section
      const balanceSection = this.createElement('div', {
        className: 'rp-balance-section'
      });

      balanceSection.appendChild(this.createElement('div', {
        className: 'rp-balance-label',
        textContent: this.t('widget.member.balance.label')
      }));

      balanceSection.appendChild(this.createElement('div', {
        className: 'rp-balance-amount',
        textContent: this.formatPoints(data.balance || 0)
      }));

      container.appendChild(balanceSection);

      // Tier section
      if (data.tier) {
        const tierSection = this.createElement('div', {
          className: 'rp-tier-section'
        });

        const tierBadge = this.createElement('div', {
          className: 'rp-tier-badge'
        });

        tierBadge.appendChild(this.createElement('span', {
          className: 'rp-tier-icon',
          textContent: data.tier.icon || '⭐'
        }));

        tierBadge.appendChild(this.createElement('span', {
          className: 'rp-tier-name',
          textContent: data.tier.name
        }));

        tierSection.appendChild(tierBadge);
        container.appendChild(tierSection);
      }

      // Progress section
      if (data.progress) {
        const progressSection = this.createElement('div', {
          className: 'rp-progress-section'
        });

        const progressHeader = this.createElement('div', {
          className: 'rp-progress-header'
        });

        progressHeader.appendChild(this.createElement('span', {
          textContent: `Progress to next tier`
        }));

        progressHeader.appendChild(this.createElement('span', {
          className: 'rp-progress-amount',
          textContent: `${data.progress.percentage}%`
        }));

        progressSection.appendChild(progressHeader);

        const progressBar = this.createElement('div', {
          className: 'rp-progress-bar'
        });

        progressBar.appendChild(this.createElement('div', {
          className: 'rp-progress-fill',
          style: { width: `${data.progress.percentage}%` },
          role: 'progressbar',
          'aria-valuenow': String(data.progress.percentage),
          'aria-valuemin': '0',
          'aria-valuemax': '100'
        }));

        progressSection.appendChild(progressBar);
        container.appendChild(progressSection);
      }

      // Action button
      const actions = this.createElement('div', {
        className: 'rp-actions'
      });

      actions.appendChild(this.createElement('a', {
        href: this.config.urls?.account || '/account',
        className: 'rp-button rp-button-primary',
        textContent: this.t('widget.member.actions.dashboard')
      }));

      container.appendChild(actions);
      return container;
    }

    async loadData() {
      if (this.state.isLoading) return;

      this.setState({ isLoading: true, error: null });
      this.updateContent();

      try {
        const apiUrl = new URL(this.config.urls?.membershipApi);
        apiUrl.searchParams.set('customerId', this.config.customerId);
        apiUrl.searchParams.set('shop', this.config.shop?.domain);

        const response = await fetch(apiUrl.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        this.setState({
          data,
          isLoading: false,
          error: null,
          retryCount: 0
        });
        this.updateContent();

      } catch (error) {
        console.error('RewardsPro: Failed to load data', error);
        this.setState({
          error: error.message || 'Unable to connect',
          isLoading: false
        });
        this.handleLoadError();
      }
    }

    handleLoadError() {
      if (this.state.retryCount < this.state.maxRetries) {
        this.state.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
        setTimeout(() => this.loadData(), delay);
      } else {
        this.updateContent();
      }
    }

    updateContent() {
      const contentArea = this.container.querySelector('.rp-widget-content');
      if (contentArea) {
        while (contentArea.firstChild) {
          contentArea.removeChild(contentArea.firstChild);
        }

        if (!this.config.isAuthenticated) {
          contentArea.appendChild(this.createGuestContent());
        } else if (this.state.isLoading) {
          contentArea.appendChild(this.createLoadingContent());
        } else if (this.state.error) {
          contentArea.appendChild(this.createErrorContent());
        } else if (this.state.data) {
          contentArea.appendChild(this.createMemberContent());
        }
      }
    }

    handleMinimize() {
      this.setState({ isMinimized: true });
      if (this.config.settings?.rememberState) {
        this.storeState(true);
      }
      this.renderMinimized();
      this.announceToScreenReader('Rewards widget minimized');
    }

    handleMaximize() {
      this.setState({ isMinimized: false });
      if (this.config.settings?.rememberState) {
        this.storeState(false);
      }
      this.renderExpanded();
      if (this.config.isAuthenticated && !this.state.data) {
        this.loadData();
      }
      this.announceToScreenReader('Rewards widget opened');
    }

    handleKeydown(event) {
      if (event.key === 'Escape' && !this.state.isMinimized) {
        this.handleMinimize();
      }
    }

    handleRetry() {
      this.state.retryCount = 0;
      this.loadData();
    }

    attachEventListeners() {
      document.addEventListener('keydown', this.handleKeydown);
      window.addEventListener('beforeunload', () => {
        document.removeEventListener('keydown', this.handleKeydown);
      });
    }

    manageFocus() {
      const panel = this.container.querySelector('.rp-widget-panel');
      if (!panel) return;

      this.previousFocus = document.activeElement;
      const focusableElements = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    setState(updates) {
      this.state = { ...this.state, ...updates };
    }

    getStoredState() {
      try {
        const stored = sessionStorage.getItem('rp_widget_state');
        return stored === 'minimized';
      } catch (e) {
        return null;
      }
    }

    storeState(isMinimized) {
      try {
        sessionStorage.setItem('rp_widget_state', isMinimized ? 'minimized' : 'expanded');
      } catch (e) {
        // Ignore
      }
    }

    formatPoints(points) {
      return new Intl.NumberFormat('en-US').format(points);
    }

    announceToScreenReader(message) {
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'rp-sr-only';
      announcement.textContent = message;

      document.body.appendChild(announcement);
      setTimeout(() => announcement.remove(), 1000);
    }
  }

  // Initialize
  function initWidget() {
    if (window.RewardsProConfig) {
      window.RewardsProFloatingWidget = new RewardsProFloatingWidget(window.RewardsProConfig);
    }
  }

  if (window.RewardsProConfig) {
    initWidget();
  } else {
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      if (window.RewardsProConfig || checkCount++ > 20) {
        clearInterval(checkInterval);
        if (window.RewardsProConfig) {
          initWidget();
        }
      }
    }, 100);
  }

})();
