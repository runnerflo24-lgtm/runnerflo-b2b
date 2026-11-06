/**
 * Global Header & Footer Component
 * Automatically injects or enhances Header & Footer on any Veltra / Runnerflo B2B page.
 */
(function () {
  'use strict';

  function initGlobalHeaderFooter() {
    var path = window.location.pathname || '';
    var isHome = path === '/' || path.endsWith('/index.html') || path === '' || path.endsWith('/Runnerflo-B2B/') || path.endsWith('/Runnerflo-B2B/index.html');
    var isApiCatalog = path.indexOf('api_catalog') > -1;
    var basePrefix = isHome ? '' : '/';

    // 1. Auto-inject CSS stylesheet if not present
    var hasCss = document.querySelector('link[href*="global-header-footer.css"]');
    if (!hasCss) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/global-header-footer.css';
      document.head.appendChild(link);
    }

    // 2. Ensure Header
    var header = document.querySelector('header.global-nav, header.nav');
    if (!header) {
      header = document.createElement('header');
      header.className = 'nav global-nav';
      header.innerHTML = [
        '<a class="logo" href="' + (isHome ? '#top' : '/') + '"><i><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg></i>Veltra</a>',
        '<nav>',
        '  <a href="' + basePrefix + '#platform">Platform</a>',
        '  <a href="' + basePrefix + '#services">Services</a>',
        '  <a href="' + basePrefix + '#process">Process</a>',
        '  <a href="' + basePrefix + '#pricing">Pricing</a>',
        '  <a href="' + (isApiCatalog ? '#' : '/api_catalog.html') + '" class="' + (isApiCatalog ? 'active' : '') + '"' + (isApiCatalog ? ' aria-current="page"' : '') + '>Request API</a>',
        '  <a href="' + (isHome ? '#ide' : '/#ide') + '" class="nav-ideas-link" id="nav-ideas"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg> 10,284+ Ideas</a>',
        '</nav>',
        '<div class="nav-actions">',
        '  <a class="nav-ideas-mob" id="nav-ideas-mob" href="' + (isHome ? '#ide' : '/#ide') + '" aria-label="Open 10,284+ Ideas">',
        '    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>',
        '    <span>10,284+ Ideas</span>',
        '  </a>',
        '  <a class="btn" href="' + basePrefix + '#contact">Get Started</a>',
        '</div>'
      ].join('\n');
      document.body.insertAdjacentElement('afterbegin', header);
    } else {
      // If header already exists in markup, highlight the active page link
      var reqLink = header.querySelector('a[href*="api_catalog"]');
      if (reqLink && isApiCatalog) {
        reqLink.classList.add('active');
        reqLink.setAttribute('aria-current', 'page');
      }
    }

    // 3. Ensure Footer
    var footer = document.querySelector('footer.global-footer, footer');
    if (!footer) {
      footer = document.createElement('footer');
      footer.className = 'global-footer';
      footer.innerHTML = [
        '<div class="footer-wrap">',
        '  <span>&copy; 2026 Veltra &bull; runnerflo.com. All rights reserved.</span>',
        '  <span>hello@runnerflo.com &middot; Global Enterprise Solutions</span>',
        '</div>'
      ].join('\n');
      var mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.appendChild(footer);
      } else {
        document.body.appendChild(footer);
      }
    } else if (!footer.classList.contains('global-footer') && footer.parentElement && footer.parentElement.tagName !== 'MAIN') {
      footer.classList.add('global-footer');
    }

    // 4. Connect 10,284+ Ideas button if openIdeas exists on the current page
    var navIdeas = document.getElementById('nav-ideas');
    if (navIdeas && typeof window.openIdeas === 'function') {
      navIdeas.addEventListener('click', function (e) {
        e.preventDefault();
        window.openIdeas();
      });
    }
    var navIdeasMob = document.getElementById('nav-ideas-mob');
    if (navIdeasMob && typeof window.openIdeas === 'function') {
      navIdeasMob.addEventListener('click', function (e) {
        e.preventDefault();
        window.openIdeas();
      });
    }

    // 5. If arriving on home with hash #ide, auto-trigger openIdeas
    if (isHome && window.location.hash === '#ide') {
      setTimeout(function () {
        if (typeof window.openIdeas === 'function') {
          window.openIdeas();
        }
      }, 350);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalHeaderFooter);
  } else {
    initGlobalHeaderFooter();
  }
})();
