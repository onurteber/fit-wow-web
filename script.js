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

  // --- iOS in-app browser App Store workaround ---
  // Instagram/Facebook/Threads in-app browsers on iOS deliberately block navigation
  // to apps.apple.com (short tap, synthetic click, and even server-side redirects all
  // get intercepted at the WebView level), while long-press "Open Link" still works
  // since that bypasses page JS entirely. There is no reliable way to force the
  // navigation through, so instead we show instructions to open the link in Safari.
  var iosInAppMessages = {
    ar: 'لفتح App Store، اضغط على ⋯ أعلى الشاشة واختر "فتح في Safari".',
    az: 'App Store-u açmaq üçün sağ yuxarıda ⋯ işarəsinə toxunun və "Safari-də aç"-ı seçin.',
    cs: 'Chcete-li otevřít App Store, klepněte vpravo nahoře na ⋯ a vyberte možnost „Otevřít v Safari“.',
    da: 'For at åbne App Store skal du trykke på ⋯ øverst til højre og vælge "Åbn i Safari".',
    de: 'Um den App Store zu öffnen, tippe oben rechts auf ⋯ und wähle „In Safari öffnen“.',
    el: 'Για να ανοίξετε το App Store, πατήστε ⋯ πάνω δεξιά και επιλέξτε «Άνοιγμα σε Safari».',
    en: 'To open the App Store, tap ⋯ at the top right and choose "Open in Safari".',
    es: 'Para abrir la App Store, toca ⋯ en la esquina superior derecha y elige "Abrir en Safari".',
    et: 'App Store\'i avamiseks puudutage paremas ülanurgas ikooni ⋯ ja valige „Ava Safaris".',
    fi: 'Avaa App Store napauttamalla ⋯ oikeasta yläkulmasta ja valitsemalla "Avaa Safarissa".',
    fr: 'Pour ouvrir l\'App Store, appuyez sur ⋯ en haut à droite et choisissez « Ouvrir dans Safari ».',
    hi: 'App Store खोलने के लिए ऊपर दाईं ओर ⋯ पर टैप करें और "Safari में खोलें" चुनें।',
    it: 'Per aprire l\'App Store, tocca ⋯ in alto a destra e scegli "Apri in Safari".',
    ja: 'App Storeを開くには、右上の ⋯ をタップして「Safariで開く」を選択してください。',
    ko: 'App Store를 열려면 오른쪽 상단의 ⋯ 를 탭하고 "Safari에서 열기"를 선택하세요.',
    nb: 'For å åpne App Store, trykk på ⋯ øverst til høyre og velg «Åpne i Safari».',
    nl: 'Om de App Store te openen, tik rechtsboven op ⋯ en kies "Open in Safari".',
    pl: 'Aby otworzyć App Store, dotknij ⋯ w prawym górnym rogu i wybierz "Otwórz w Safari".',
    pt: 'Para abrir a App Store, toque em ⋯ no canto superior direito e escolha "Abrir no Safari".',
    ru: 'Чтобы открыть App Store, нажмите ⋯ вверху справа и выберите «Открыть в Safari».',
    sv: 'För att öppna App Store, tryck på ⋯ uppe till höger och välj "Öppna i Safari".',
    tl: 'Para buksan ang App Store, i-tap ang ⋯ sa kanang itaas at piliin ang "Buksan sa Safari".',
    tr: 'App Store\'u açmak için sağ üstteki ⋯ simgesine dokunun ve "Safari\'de Aç"ı seçin.',
    zh: '如需打开 App Store,请点击右上角的 ⋯ 并选择"在 Safari 中打开"。'
  };

  function isIosInAppBrowser() {
    var ua = navigator.userAgent || '';
    var isIos = /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isInApp = /FBAN|FBAV|Instagram|Threads|Line\//i.test(ua);
    return isIos && isInApp;
  }

  function showOpenInSafariBanner() {
    if (document.getElementById('fitwow-inapp-banner')) return;
    var message = iosInAppMessages[getCurrentLang()] || iosInAppMessages.en;

    var overlay = document.createElement('div');
    overlay.id = 'fitwow-inapp-banner';
    overlay.setAttribute('role', 'dialog');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;color:#111;max-width:420px;width:100%;margin:0 16px 16px;padding:20px;border-radius:16px;font:15px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.2);';

    var text = document.createElement('p');
    text.style.cssText = 'margin:0 0 16px;';
    text.textContent = message;

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'OK';
    closeBtn.style.cssText = 'display:block;width:100%;padding:12px;border:0;border-radius:10px;background:#111;color:#fff;font-weight:600;font-size:15px;';
    closeBtn.addEventListener('click', function () {
      overlay.remove();
    });

    box.appendChild(text);
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
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

  if (isIosInAppBrowser()) {
    document.querySelectorAll('a[href*="apps.apple.com"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        showOpenInSafariBanner();
      });
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
