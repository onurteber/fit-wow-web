(function () {
  'use strict';

  // --- Ref parameter: capture from URL and apply to store links ---
  // When ref is present, all store buttons point to referral-capture URL; the backend
  // redirects to App Store or Play Store based on User-Agent.
  var params = new URLSearchParams(window.location.search);
  var ref = params.get('ref');
  if (ref) {
    try {
      sessionStorage.setItem('fitwow_ref', ref);
    } catch (e) {}
  } else {
    try {
      ref = sessionStorage.getItem('fitwow_ref');
    } catch (e) {}
  }

  var body = document.body;
  var appStoreUrl = body.getAttribute('data-app-store-url') || '#';
  var googlePlayUrl = body.getAttribute('data-google-play-url') || '#';
  var referralCaptureUrl = (body.getAttribute('data-referral-capture-url') || '').trim();
  var androidStatus = googlePlayUrl && googlePlayUrl !== '#' ? 'live' : 'coming-soon';
  var androidComingSoonLabels = {
    ar: 'قريبًا',
    az: 'Tezliklə',
    cs: 'Brzy',
    da: 'Snart',
    de: 'Bald',
    el: 'Σύντομα',
    en: 'Soon',
    es: 'Pronto',
    et: 'Varsti',
    fi: 'Pian',
    fr: 'Bientôt',
    hi: 'जल्द',
    it: 'Presto',
    ja: '近日',
    ko: '곧',
    nb: 'Snart',
    nl: 'Binnenkort',
    pl: 'Wkrótce',
    pt: 'Em breve',
    ru: 'Скоро',
    sv: 'Snart',
    tl: 'Malapit na',
    tr: 'Yakında',
    zh: '即将推出'
  };

  function getCurrentLang() {
    var lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    return lang.split('-')[0];
  }

  function getAndroidBadgeLabel() {
    var lang = getCurrentLang();
    return androidComingSoonLabels[lang] || androidComingSoonLabels.en;
  }

  function setAndroidComingSoonState(link) {
    var badgeLabel = getAndroidBadgeLabel();
    var ariaLabel = link.getAttribute('aria-label') || link.textContent.trim();

    link.setAttribute('href', '#');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('aria-label', ariaLabel + ' (' + badgeLabel + ')');
    link.setAttribute('data-badge', badgeLabel);
    link.classList.add('btn--soon');
    link.addEventListener('click', function (e) {
      e.preventDefault();
    });
  }

  function buildIosHref() {
    if (ref && referralCaptureUrl) {
      return referralCaptureUrl + '?ref=' + encodeURIComponent(ref) + '&platform=ios';
    }
    return appStoreUrl;
  }

  function buildAndroidHref() {
    if (!googlePlayUrl || googlePlayUrl === '#') return '#';
    if (ref && referralCaptureUrl) {
      return referralCaptureUrl + '?ref=' + encodeURIComponent(ref) + '&platform=android';
    }
    if (!ref) return googlePlayUrl;
    var sep = googlePlayUrl.indexOf('?') !== -1 ? '&' : '?';
    return googlePlayUrl + sep + 'referrer=' + encodeURIComponent('ref=' + ref);
  }

  document.querySelectorAll('a[data-store="ios"]').forEach(function (link) {
    link.setAttribute('href', buildIosHref());
  });
  document.querySelectorAll('a[data-store="android"]').forEach(function (link) {
    if (androidStatus === 'coming-soon') {
      setAndroidComingSoonState(link);
      return;
    }
    link.setAttribute('href', buildAndroidHref());
  });

  // Instagram/Facebook/Threads in-app browsers on iOS block navigation to
  // https://apps.apple.com (their WKWebView delegate suppresses the App
  // Store handoff). itms-apps:// is a custom URL scheme handled directly by
  // iOS rather than as a web navigation, which those in-app browsers do not
  // intercept. Google Play is unaffected and untouched.
  var uaString = navigator.userAgent || navigator.vendor || window.opera || '';
  var isIosDevice = /iPhone|iPad|iPod/i.test(uaString) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isInAppBrowser = /Instagram|FBAN|FBAV|Threads/i.test(uaString);

  if (isIosDevice && isInAppBrowser) {
    document.querySelectorAll('a[data-store="ios"], a[href*="apps.apple.com"]').forEach(function (link) {
      var url = link.getAttribute('href');
      if (url && url.indexOf('https://apps.apple.com') === 0) {
        link.setAttribute('href', url.replace('https://apps.apple.com', 'itms-apps://apps.apple.com'));
      }
    });
  }

  // Smooth scroll for anchor links (supplements CSS scroll-behavior for broader support)
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Sticky mobile download bar: reveal once the hero is scrolled past
  var stickyBar = document.querySelector('.sticky-download');
  if (stickyBar) {
    var hero = document.getElementById('hero');
    var revealSticky = function () {
      var threshold = hero ? hero.offsetTop + hero.offsetHeight : 400;
      if (window.scrollY > threshold) {
        stickyBar.classList.add('is-visible');
      } else {
        stickyBar.classList.remove('is-visible');
      }
    };
    window.addEventListener('scroll', revealSticky, { passive: true });
    revealSticky();
  }
})();
