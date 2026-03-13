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
    link.setAttribute('href', buildAndroidHref());
  });

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
})();
