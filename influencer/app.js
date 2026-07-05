(function () {
  'use strict';

  var config = window.FITWOW_INFLUENCER_CONFIG || {};
  var supabaseUrl = config.supabaseUrl || readMeta('fitwow:supabase-url');
  var supabaseAnonKey = config.supabaseAnonKey || readMeta('fitwow:supabase-anon-key');
  var session = null;
  var selectedRange = '30';
  var selectedMonthValue = '';
  var SESSION_KEY = 'fitwow_influencer_session';
  var ACCOUNT_SELECT = '/influencer_accounts?select=full_name,iban,status,commission_rate_percent';
  var REVENUECAT_EVENT_TABLE_CANDIDATES = [
    'revenuecat_subscription_events',
    'revenuecat_events',
    'subscription_events'
  ];
  var REVENUECAT_EVENT_SELECT = [
    'user_id',
    'event_type',
    'event_at',
    'created_at',
    'purchased_at',
    'product_id',
    'promo_code_id',
    'promo_code'
  ].join(',');
  var PURCHASE_EVENT_TYPES = {
    INITIAL_PURCHASE: true,
    NON_RENEWING_PURCHASE: true,
    RENEWAL: true
  };
  var PURCHASE_REVERSAL_EVENT_TYPES = {
    CANCELLATION: true,
    EXPIRATION: true,
    REFUND: true
  };

  var els = {
    loginView: document.getElementById('loginView'),
    resetView: document.getElementById('resetView'),
    dashboardView: document.getElementById('dashboardView'),
    loginForm: document.getElementById('loginForm'),
    resetForm: document.getElementById('resetForm'),
    emailInput: document.getElementById('emailInput'),
    passwordInput: document.getElementById('passwordInput'),
    newPasswordInput: document.getElementById('newPasswordInput'),
    newPasswordConfirmInput: document.getElementById('newPasswordConfirmInput'),
    loginButton: document.getElementById('loginButton'),
    resetPasswordButton: document.getElementById('resetPasswordButton'),
    savePasswordButton: document.getElementById('savePasswordButton'),
    backToLoginButton: document.getElementById('backToLoginButton'),
    loginMessage: document.getElementById('loginMessage'),
    resetMessage: document.getElementById('resetMessage'),
    logoutButton: document.getElementById('logoutButton'),
    userEmail: document.getElementById('userEmail'),
    accountName: document.getElementById('accountName'),
    accountStatus: document.getElementById('accountStatus'),
    commissionText: document.getElementById('commissionText'),
    ibanText: document.getElementById('ibanText'),
    monthPicker: document.getElementById('monthPicker'),
    monthButton: document.getElementById('monthButton'),
    monthMenu: document.getElementById('monthMenu'),
    fromDate: document.getElementById('fromDate'),
    toDate: document.getElementById('toDate'),
    refreshButton: document.getElementById('refreshButton'),
    rangeButtons: Array.prototype.slice.call(document.querySelectorAll('[data-range]')),
    tableStatus: document.getElementById('tableStatus'),
    statsBody: document.getElementById('statsBody'),
    totalCodeUsageMetric: document.getElementById('totalCodeUsageMetric'),
    subscriptionPurchasesMetric: document.getElementById('subscriptionPurchasesMetric'),
    refundedSubscriptionsMetric: document.getElementById('refundedSubscriptionsMetric'),
    weeklySubscriptionsMetric: document.getElementById('weeklySubscriptionsMetric'),
    monthlySubscriptionsMetric: document.getElementById('monthlySubscriptionsMetric'),
    yearlySubscriptionsMetric: document.getElementById('yearlySubscriptionsMetric'),
    activeFreeTrialsMetric: document.getElementById('activeFreeTrialsMetric'),
    cancelledFreeTrialsMetric: document.getElementById('cancelledFreeTrialsMetric')
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    populateMonthMenu();
    bindEvents();
    setDefaultDates();

    if (!isConfigured()) {
      setLoginMessage('Supabase URL ve anon key ayarı eksik. influencer/index.html içindeki meta alanlarını doldur.', 'error');
      setAuthButtonsDisabled(true);
      showLogin();
      return;
    }

    var callbackType = persistAuthCallbackSession();
    if (callbackType === 'recovery') {
      session = readStoredSession();
      showReset();
      return;
    }

    restoreSession().then(function (activeSession) {
      if (!activeSession) {
        renderSession(null);
        return null;
      }
      return requireInfluencerAccess().then(function () {
        renderSession(activeSession);
      });
    }).catch(function (error) {
      clearStoredSession();
      session = null;
      renderSession(null);
      if (error && error.message) {
        setLoginMessage(error.message, 'error');
      }
    });
  }

  function bindEvents() {
    els.loginForm.addEventListener('submit', handleLogin);
    els.resetForm.addEventListener('submit', handleSavePassword);
    els.resetPasswordButton.addEventListener('click', handleSendPasswordReset);
    els.backToLoginButton.addEventListener('click', function () {
      setResetMessage('', '');
      showLogin();
    });
    els.logoutButton.addEventListener('click', handleLogout);
    els.refreshButton.addEventListener('click', loadDashboard);
    els.monthButton.addEventListener('click', toggleMonthMenu);
    els.monthMenu.addEventListener('click', handleMonthOptionClick);
    document.addEventListener('click', closeMonthMenu);
    els.fromDate.addEventListener('change', selectCustomRange);
    els.toDate.addEventListener('change', selectCustomRange);

    els.rangeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        selectedRange = button.getAttribute('data-range');
        applyRangeButtons();
        setDatesForRange(selectedRange);
        loadDashboard();
      });
    });
  }

  function handleLogin(event) {
    event.preventDefault();
    var email = els.emailInput.value.trim();
    var password = els.passwordInput.value;
    if (!email || !password) return;

    setAuthButtonsDisabled(true);
    setLoginMessage('Giriş yapılıyor...', '');

    authRequest('/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({
        email: email,
        password: password
      })
    }).then(function (result) {
      session = result;
      return requireInfluencerAccess().then(function () {
        saveSession(session);
        setLoginMessage('', '');
        renderSession(session);
      });
    }).catch(function (error) {
      clearStoredSession();
      session = null;
      setLoginMessage(error.message || 'Giriş yapılamadı.', 'error');
    }).finally(function () {
      setAuthButtonsDisabled(false);
    });
  }

  function handleSendPasswordReset() {
    var email = els.emailInput.value.trim();
    if (!email) {
      setLoginMessage('Şifre linki için email adresini yaz.', 'error');
      els.emailInput.focus();
      return;
    }

    setAuthButtonsDisabled(true);
    setLoginMessage('Şifre oluşturma linki gönderiliyor...', '');

    functionRequest('/send-localized-reset-email', {
      method: 'POST',
      body: JSON.stringify({
        email: email,
        language: 'tr',
        display_name: null,
        redirect_to: getRedirectUrl()
      })
    }).then(function () {
      setLoginMessage('Emailine şifre oluşturma linki gönderdik. Gelen linke tıkla, sonra yeni şifreni belirle.', 'success');
    }).catch(function (error) {
      setLoginMessage(error.message || 'Şifre linki gönderilemedi.', 'error');
    }).finally(function () {
      setAuthButtonsDisabled(false);
    });
  }

  function handleSavePassword(event) {
    event.preventDefault();
    var password = els.newPasswordInput.value;
    var passwordConfirm = els.newPasswordConfirmInput.value;

    if (!session || !session.access_token) {
      setResetMessage('Şifre belirleme linkinin süresi dolmuş olabilir. Login ekranından tekrar link iste.', 'error');
      return;
    }
    if (password.length < 6) {
      setResetMessage('Şifre en az 6 karakter olmalı.', 'error');
      return;
    }
    if (password !== passwordConfirm) {
      setResetMessage('Şifreler aynı değil.', 'error');
      return;
    }

    setResetButtonsDisabled(true);
    setResetMessage('Şifre kaydediliyor...', '');

    authRequest('/user', {
      method: 'PUT',
      accessToken: session.access_token,
      body: JSON.stringify({
        password: password
      })
    }).then(function (user) {
      session.user = user;
      return requireInfluencerAccess().then(function () {
        saveSession(session);
        setResetMessage('Şifre kaydedildi. Panele yönlendiriliyorsun.', 'success');
        renderSession(session);
      });
    }).catch(function (error) {
      if (error && error.code === 'not_influencer') {
        clearStoredSession();
        session = null;
      }
      setResetMessage(error.message || 'Şifre kaydedilemedi.', 'error');
    }).finally(function () {
      setResetButtonsDisabled(false);
    });
  }

  function handleLogout() {
    var activeSession = session;
    clearStoredSession();
    session = null;
    renderSession(null);

    if (!activeSession || !activeSession.access_token) return;
    authRequest('/logout', {
      method: 'POST',
      accessToken: activeSession.access_token
    }).catch(function () {});
  }

  function renderSession(activeSession) {
    if (!activeSession) {
      els.userEmail.textContent = '';
      els.logoutButton.hidden = true;
      showLogin();
      return;
    }

    els.userEmail.textContent = (activeSession.user && activeSession.user.email) || '';
    els.logoutButton.hidden = false;
    showDashboard();
    loadDashboard();
  }

  function showLogin() {
    els.loginView.hidden = false;
    els.resetView.hidden = true;
    els.dashboardView.hidden = true;
  }

  function showReset() {
    els.loginView.hidden = true;
    els.resetView.hidden = false;
    els.dashboardView.hidden = true;
  }

  function showDashboard() {
    els.loginView.hidden = true;
    els.resetView.hidden = true;
    els.dashboardView.hidden = false;
  }

  function loadDashboard() {
    if (!session) return;

    setTableStatus('Yükleniyor...', '');
    renderEmptyRow('Yükleniyor...');
    renderTotals([]);

    var range = getDateRange();
    var accountRequest = apiRequest(ACCOUNT_SELECT)
      .then(function (rows) {
        return rows && rows.length ? rows[0] : null;
      });
    var statsRequest = apiRequest('/rpc/get_my_influencer_stats', {
      method: 'POST',
      body: JSON.stringify({
        p_from: range.from,
        p_to: range.to
      })
    });
    var refundCountsRequest = fetchRefundCounts(range).catch(function () {
      return null;
    });

    Promise.all([accountRequest, statsRequest, refundCountsRequest]).then(function (results) {
      var account = results[0];
      var stats = applyRefundCounts(results[1] || [], results[2]);

      renderAccount(account);
      renderRows(stats);
      renderTotals(stats);

      if (!account) {
        rejectCurrentSession('Bu panel sadece influencer hesaplarına açık.');
        return;
      }

      if (!stats.length) {
        setTableStatus('Bu tarih aralığında bağlı promo kodu verisi yok.', '');
        return;
      }

      setTableStatus('Güncel', 'success');
    }).catch(function (error) {
      renderAccount(null);
      renderRows([]);
      renderTotals([]);
      setTableStatus(error.message || 'İstatistikler alınamadı.', 'error');
    });
  }

  function fetchRefundCounts(range) {
    return fetchRevenueCatEvents(range).then(buildRefundCounts);
  }

  function fetchRevenueCatEvents(range, tableIndex) {
    var index = tableIndex || 0;
    var table = REVENUECAT_EVENT_TABLE_CANDIDATES[index];
    if (!table) return Promise.reject(new Error('RevenueCat event tablosu okunamadı.'));

    return apiRequest('/' + table + buildRevenueCatEventQuery(range)).catch(function () {
      return fetchRevenueCatEvents(range, index + 1);
    });
  }

  function buildRevenueCatEventQuery(range) {
    var params = [
      'select=' + REVENUECAT_EVENT_SELECT,
      'event_type=in.(INITIAL_PURCHASE,NON_RENEWING_PURCHASE,RENEWAL,CANCELLATION,EXPIRATION,REFUND,UNCANCELLATION)',
      'order=created_at.asc'
    ];

    if (range.from) {
      params.push('purchased_at=gte.' + encodeURIComponent(range.from));
    }
    if (range.to) {
      params.push('purchased_at=lt.' + encodeURIComponent(range.to));
    }

    return '?' + params.join('&');
  }

  function buildRefundCounts(events) {
    var transactions = (events || []).reduce(function (map, event) {
      var key = getTransactionKey(event);
      if (!key) return map;

      var transaction = map[key] || {
        purchase: null,
        latestLifecycleEvent: null
      };

      if (PURCHASE_EVENT_TYPES[event.event_type] && getPromoKey(event)) {
        transaction.purchase = event;
      }
      if (isLifecycleEvent(event.event_type) && isLaterEvent(event, transaction.latestLifecycleEvent)) {
        transaction.latestLifecycleEvent = event;
      }

      map[key] = transaction;
      return map;
    }, {});

    return Object.keys(transactions).reduce(function (counts, key) {
      addRefundCounts(counts, transactions[key]);
      return counts;
    }, {
      eventCount: (events || []).length,
      byPromo: {}
    });
  }

  function addRefundCounts(counts, transaction) {
    var purchase = transaction.purchase;
    if (!purchase || !isReversedTransaction(transaction)) return;

    var promoKeys = getPromoKeys(purchase);
    if (!promoKeys.length) return;

    promoKeys.forEach(function (promoKey) {
      var refundCounts = counts.byPromo[promoKey] || emptyRefundCounts();
      refundCounts.refunded_subscriptions += 1;
      counts.byPromo[promoKey] = refundCounts;
    });
  }

  function applyRefundCounts(rows, refundCounts) {
    if (!refundCounts || refundCounts.eventCount === 0) return rows;

    return rows.map(function (row) {
      var promoKey = getPromoKey(row);
      if (!promoKey) return row;
      return mergeRefundCounts(row, getRefundCountsForRow(refundCounts.byPromo, row));
    });
  }

  function mergeRefundCounts(row, counts) {
    return Object.assign({}, row, {
      refunded_subscriptions: Math.max(
        toNumber(row.refunded_subscriptions),
        toNumber(counts.refunded_subscriptions)
      )
    });
  }

  function getRefundCountsForRow(map, row) {
    var keys = getPromoKeys(row);
    for (var index = 0; index < keys.length; index += 1) {
      if (map[keys[index]]) return map[keys[index]];
    }
    return emptyRefundCounts();
  }

  function emptyRefundCounts() {
    return {
      refunded_subscriptions: 0
    };
  }

  function getTransactionKey(event) {
    if (!event.user_id || !event.product_id) return '';
    return [
      event.user_id,
      event.product_id,
      normalizeTimestamp(event.purchased_at || event.event_at || event.created_at)
    ].join('|');
  }

  function normalizeTimestamp(value) {
    if (!value) return '';
    var time = new Date(value).getTime();
    return Number.isFinite(time) ? String(time) : String(value);
  }

  function getPromoKey(row) {
    return getPromoKeys(row)[0] || '';
  }

  function getPromoKeys(row) {
    var keys = [];
    if (row.promo_code_id) keys.push('id:' + row.promo_code_id);
    if (row.promo_code) keys.push('code:' + String(row.promo_code).trim().toUpperCase());
    return keys;
  }

  function isLifecycleEvent(eventType) {
    return Boolean(PURCHASE_REVERSAL_EVENT_TYPES[eventType] || eventType === 'UNCANCELLATION');
  }

  function isLaterEvent(event, previousEvent) {
    if (!previousEvent) return true;
    return new Date(event.event_at || event.created_at || 0).getTime() >= new Date(previousEvent.event_at || previousEvent.created_at || 0).getTime();
  }

  function isReversedTransaction(transaction) {
    var latestEvent = transaction.latestLifecycleEvent;
    return Boolean(latestEvent && PURCHASE_REVERSAL_EVENT_TYPES[latestEvent.event_type]);
  }

  function requireInfluencerAccess() {
    return apiRequest(ACCOUNT_SELECT).then(function (rows) {
      if (rows && rows.length) return rows[0];
      var error = new Error('Bu panel sadece influencer hesaplarına açık.');
      error.code = 'not_influencer';
      throw error;
    });
  }

  function rejectCurrentSession(message) {
    var activeSession = session;
    clearStoredSession();
    session = null;
    renderSession(null);
    setLoginMessage(message, 'error');

    if (!activeSession || !activeSession.access_token) return;
    authRequest('/logout', {
      method: 'POST',
      accessToken: activeSession.access_token
    }).catch(function () {});
  }

  function renderAccount(account) {
    if (!account) {
      els.accountName.textContent = 'Performans';
      els.accountStatus.textContent = 'Hesap yok';
      els.accountStatus.classList.add('paused');
      els.commissionText.textContent = '';
      els.ibanText.textContent = '';
      return;
    }

    els.accountName.textContent = account.full_name || 'Performans';
    els.accountStatus.textContent = account.status === 'paused' ? 'Duraklatıldı' : 'Aktif';
    els.accountStatus.classList.toggle('paused', account.status === 'paused');
    els.commissionText.textContent = hasCommissionRate(account) ? 'Komisyon ' + formatCommissionRate(getCommissionRate(account)) : '';
    els.ibanText.textContent = account.iban ? maskIban(account.iban) : '';
  }

  function renderRows(rows) {
    if (!rows.length) {
      renderEmptyRow('Veri yok');
      return;
    }

    els.statsBody.innerHTML = rows.map(function (row) {
      return [
        '<tr>',
        '<td class="code-cell">', escapeHtml(row.promo_code || '-'), '</td>',
        '<td>', formatNumber(row.total_code_usage), '</td>',
        '<td>', formatNumber(row.subscription_purchases), '</td>',
        '<td>', formatNumber(row.refunded_subscriptions), '</td>',
        '<td>', formatNumber(row.weekly_subscriptions), '</td>',
        '<td>', formatNumber(row.monthly_subscriptions), '</td>',
        '<td>', formatNumber(row.yearly_subscriptions), '</td>',
        '<td>', formatNumber(row.active_free_trials), '</td>',
        '<td>', formatNumber(row.cancelled_free_trials), '</td>',
        '</tr>'
      ].join('');
    }).join('');
  }

  function renderEmptyRow(text) {
    els.statsBody.innerHTML = '<tr><td colspan="9" class="empty-cell">' + escapeHtml(text) + '</td></tr>';
  }

  function renderTotals(rows) {
    var totals = rows.reduce(function (acc, row) {
      acc.totalCodeUsage += toNumber(row.total_code_usage);
      acc.subscriptionPurchases += toNumber(row.subscription_purchases);
      acc.refundedSubscriptions += toNumber(row.refunded_subscriptions);
      acc.weeklySubscriptions += toNumber(row.weekly_subscriptions);
      acc.monthlySubscriptions += toNumber(row.monthly_subscriptions);
      acc.yearlySubscriptions += toNumber(row.yearly_subscriptions);
      acc.activeFreeTrials += toNumber(row.active_free_trials);
      acc.cancelledFreeTrials += toNumber(row.cancelled_free_trials);
      return acc;
    }, {
      totalCodeUsage: 0,
      subscriptionPurchases: 0,
      refundedSubscriptions: 0,
      weeklySubscriptions: 0,
      monthlySubscriptions: 0,
      yearlySubscriptions: 0,
      activeFreeTrials: 0,
      cancelledFreeTrials: 0
    });

    els.totalCodeUsageMetric.textContent = formatNumber(totals.totalCodeUsage);
    els.subscriptionPurchasesMetric.textContent = formatNumber(totals.subscriptionPurchases);
    els.refundedSubscriptionsMetric.textContent = formatNumber(totals.refundedSubscriptions);
    els.weeklySubscriptionsMetric.textContent = formatNumber(totals.weeklySubscriptions);
    els.monthlySubscriptionsMetric.textContent = formatNumber(totals.monthlySubscriptions);
    els.yearlySubscriptionsMetric.textContent = formatNumber(totals.yearlySubscriptions);
    els.activeFreeTrialsMetric.textContent = formatNumber(totals.activeFreeTrials);
    els.cancelledFreeTrialsMetric.textContent = formatNumber(totals.cancelledFreeTrials);
  }

  function setDefaultDates() {
    setDatesForRange(selectedRange);
    applyRangeButtons();
  }

  function setDatesForRange(range) {
    setSelectedMonth('', 'Ay seç');

    if (range === 'all') {
      els.fromDate.value = '';
      els.toDate.value = '';
      return;
    }

    var days = Number(range);
    var today = new Date();
    var from = new Date(today);
    from.setDate(today.getDate() - days + 1);
    els.fromDate.value = toDateInputValue(from);
    els.toDate.value = toDateInputValue(today);
  }

  function selectMonthRange() {
    if (!selectedMonthValue) return;
    selectedRange = 'month';
    applyRangeButtons();
    setDatesForMonth(selectedMonthValue);
    loadDashboard();
  }

  function setDatesForMonth(value) {
    var parts = value.split('-');
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    if (!year || !month) return;

    var firstDay = new Date(year, month - 1, 1);
    var lastDay = new Date(year, month, 0);
    els.fromDate.value = toDateInputValue(firstDay);
    els.toDate.value = toDateInputValue(lastDay);
  }

  function selectCustomRange() {
    selectedRange = 'custom';
    setSelectedMonth('', 'Ay seç');
    applyRangeButtons();
  }

  function populateMonthMenu() {
    var formatter = new Intl.DateTimeFormat('tr-TR', {
      month: 'long',
      year: 'numeric'
    });
    var options = [];
    var cursor = new Date();

    for (var index = 0; index < 36; index += 1) {
      var value = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0');
      var label = formatter.format(cursor);
      options.push(
        '<button class="month-option" type="button" role="option" data-month="' +
        escapeHtml(value) +
        '">' +
        escapeHtml(label) +
        '</button>'
      );
      cursor.setMonth(cursor.getMonth() - 1);
    }

    els.monthMenu.innerHTML = options.join('');
  }

  function toggleMonthMenu(event) {
    event.stopPropagation();
    var isOpen = !els.monthMenu.hidden;
    setMonthMenuOpen(!isOpen);
  }

  function closeMonthMenu() {
    setMonthMenuOpen(false);
  }

  function setMonthMenuOpen(isOpen) {
    els.monthMenu.hidden = !isOpen;
    els.monthButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function handleMonthOptionClick(event) {
    var button = event.target.closest('.month-option');
    if (!button) return;

    event.stopPropagation();
    setSelectedMonth(button.getAttribute('data-month'), button.textContent);
    closeMonthMenu();
    selectMonthRange();
  }

  function setSelectedMonth(value, label) {
    selectedMonthValue = value || '';
    els.monthButton.textContent = label || 'Ay seç';
    Array.prototype.forEach.call(els.monthMenu.querySelectorAll('.month-option'), function (button) {
      var isActive = button.getAttribute('data-month') === selectedMonthValue;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function applyRangeButtons() {
    els.rangeButtons.forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-range') === selectedRange);
    });
  }

  function getDateRange() {
    return {
      from: dateStartIso(els.fromDate.value),
      to: dateEndIso(els.toDate.value)
    };
  }

  function dateStartIso(value) {
    if (!value) return null;
    return new Date(value + 'T00:00:00').toISOString();
  }

  function dateEndIso(value) {
    if (!value) return null;
    var date = new Date(value + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    return date.toISOString();
  }

  function toDateInputValue(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function setLoginMessage(text, type) {
    els.loginMessage.textContent = text;
    els.loginMessage.className = 'message' + (type ? ' ' + type : '');
  }

  function setResetMessage(text, type) {
    els.resetMessage.textContent = text;
    els.resetMessage.className = 'message' + (type ? ' ' + type : '');
  }

  function setTableStatus(text, type) {
    els.tableStatus.textContent = text;
    els.tableStatus.className = 'message' + (type ? ' ' + type : '');
  }

  function setAuthButtonsDisabled(disabled) {
    els.loginButton.disabled = disabled;
    els.resetPasswordButton.disabled = disabled;
  }

  function setResetButtonsDisabled(disabled) {
    els.savePasswordButton.disabled = disabled;
    els.backToLoginButton.disabled = disabled;
  }

  function getRedirectUrl() {
    var productionUrl = 'https://www.fitwowapp.com/influencer/';
    var hostname = window.location.hostname;

    if (hostname === 'fitwowapp.com' || hostname === 'www.fitwowapp.com') {
      return window.location.origin + '/influencer/';
    }

    return productionUrl;
  }

  function persistAuthCallbackSession() {
    var hash = window.location.hash ? window.location.hash.slice(1) : '';
    if (!hash) return;

    var params = new URLSearchParams(hash);
    var accessToken = params.get('access_token');
    if (!accessToken) return;

    var expiresIn = Number(params.get('expires_in') || 3600);
    saveSession({
      access_token: accessToken,
      refresh_token: params.get('refresh_token') || '',
      token_type: params.get('token_type') || 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + expiresIn
    });
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    return params.get('type') || '';
  }

  function restoreSession() {
    var stored = readStoredSession();
    if (!stored || !stored.access_token) return Promise.resolve(null);

    session = stored;
    return refreshSessionIfNeeded(session).then(function (freshSession) {
      session = freshSession;
      return authRequest('/user', {
        method: 'GET',
        accessToken: freshSession.access_token
      }).then(function (user) {
        freshSession.user = user;
        saveSession(freshSession);
        return freshSession;
      });
    });
  }

  function refreshSessionIfNeeded(activeSession) {
    var now = Math.floor(Date.now() / 1000);
    if (!activeSession.expires_at || activeSession.expires_at - now > 60) {
      return Promise.resolve(activeSession);
    }
    if (!activeSession.refresh_token) return Promise.resolve(activeSession);

    return authRequest('/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({
        refresh_token: activeSession.refresh_token
      })
    }).then(function (freshSession) {
      saveSession(freshSession);
      return freshSession;
    });
  }

  function authRequest(path, options) {
    var requestOptions = options || {};
    var headers = {
      apikey: supabaseAnonKey,
      Authorization: 'Bearer ' + supabaseAnonKey,
      'Content-Type': 'application/json'
    };
    if (requestOptions.accessToken) {
      headers.Authorization = 'Bearer ' + requestOptions.accessToken;
    }

    return requestJson(supabaseUrl.replace(/\/$/, '') + '/auth/v1' + path, {
      method: requestOptions.method || 'GET',
      headers: headers,
      body: requestOptions.body
    });
  }

  function apiRequest(path, options) {
    var requestOptions = options || {};
    return refreshSessionIfNeeded(session).then(function (freshSession) {
      session = freshSession;
      var headers = {
        apikey: supabaseAnonKey,
        Authorization: 'Bearer ' + freshSession.access_token,
        'Content-Type': 'application/json'
      };
      return requestJson(supabaseUrl.replace(/\/$/, '') + '/rest/v1' + path, {
        method: requestOptions.method || 'GET',
        headers: headers,
        body: requestOptions.body
      });
    });
  }

  function functionRequest(path, options) {
    var requestOptions = options || {};
    var headers = {
      apikey: supabaseAnonKey,
      Authorization: 'Bearer ' + supabaseAnonKey,
      'Content-Type': 'application/json'
    };
    return requestJson(supabaseUrl.replace(/\/$/, '') + '/functions/v1' + path, {
      method: requestOptions.method || 'POST',
      headers: headers,
      body: requestOptions.body
    }).then(function (payload) {
      if (payload && payload.success === false) {
        throw new Error(payload.error || 'İstek başarısız.');
      }
      return payload;
    });
  }

  function requestJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.text().then(function (text) {
        var payload = text ? JSON.parse(text) : {};
        if (!response.ok) {
          throw new Error(payload.msg || payload.message || payload.error_description || payload.error || 'İstek başarısız.');
        }
        return payload;
      });
    });
  }

  function saveSession(value) {
    var nextSession = Object.assign({}, value);
    if (!nextSession.expires_at && nextSession.expires_in) {
      nextSession.expires_at = Math.floor(Date.now() / 1000) + Number(nextSession.expires_in);
    }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    } catch (e) {}
  }

  function readStoredSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearStoredSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('tr-TR').format(toNumber(value));
  }

  function formatCommissionRate(value) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string' && value.indexOf('%') !== -1) return value;

    var rate = Number(value);
    if (!Number.isFinite(rate)) return String(value);
    var percent = Math.abs(rate) <= 1 ? rate * 100 : rate;

    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(percent) + '%';
  }

  function toNumber(value) {
    return Number(value || 0);
  }

  function hasCommissionRate(row) {
    return getCommissionRate(row) !== undefined && getCommissionRate(row) !== null && getCommissionRate(row) !== '';
  }

  function getCommissionRate(row) {
    if (!row) return undefined;
    return row.commission_rate_percent;
  }

  function maskIban(value) {
    var cleaned = String(value).replace(/\s+/g, '');
    if (cleaned.length <= 8) return cleaned;
    return cleaned.slice(0, 4) + '...' + cleaned.slice(-4);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function readMeta(name) {
    var tag = document.querySelector('meta[name="' + name + '"]');
    return tag ? tag.getAttribute('content').trim() : '';
  }

  function isConfigured() {
    return Boolean(supabaseUrl && supabaseAnonKey);
  }
})();
