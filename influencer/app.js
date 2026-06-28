(function () {
  'use strict';

  var config = window.FITWOW_INFLUENCER_CONFIG || {};
  var supabaseUrl = config.supabaseUrl || readMeta('fitwow:supabase-url');
  var supabaseAnonKey = config.supabaseAnonKey || readMeta('fitwow:supabase-anon-key');
  var session = null;
  var selectedRange = '30';
  var SESSION_KEY = 'fitwow_influencer_session';

  var els = {
    loginView: document.getElementById('loginView'),
    dashboardView: document.getElementById('dashboardView'),
    loginForm: document.getElementById('loginForm'),
    emailInput: document.getElementById('emailInput'),
    passwordInput: document.getElementById('passwordInput'),
    loginButton: document.getElementById('loginButton'),
    googleLoginButton: document.getElementById('googleLoginButton'),
    appleLoginButton: document.getElementById('appleLoginButton'),
    loginMessage: document.getElementById('loginMessage'),
    logoutButton: document.getElementById('logoutButton'),
    userEmail: document.getElementById('userEmail'),
    accountName: document.getElementById('accountName'),
    accountStatus: document.getElementById('accountStatus'),
    payoutEmail: document.getElementById('payoutEmail'),
    ibanText: document.getElementById('ibanText'),
    fromDate: document.getElementById('fromDate'),
    toDate: document.getElementById('toDate'),
    refreshButton: document.getElementById('refreshButton'),
    rangeButtons: Array.prototype.slice.call(document.querySelectorAll('[data-range]')),
    tableStatus: document.getElementById('tableStatus'),
    statsBody: document.getElementById('statsBody'),
    appliedUsersMetric: document.getElementById('appliedUsersMetric'),
    convertedUsersMetric: document.getElementById('convertedUsersMetric'),
    initialPurchasesMetric: document.getElementById('initialPurchasesMetric'),
    renewalsMetric: document.getElementById('renewalsMetric')
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindEvents();
    setDefaultDates();

    if (!isConfigured()) {
      setLoginMessage('Supabase URL ve anon key ayarı eksik. influencer/index.html içindeki meta alanlarını doldur.', 'error');
      setAuthButtonsDisabled(true);
      showLogin();
      return;
    }

    persistOAuthCallbackSession();
    restoreSession().then(renderSession).catch(function () {
      clearStoredSession();
      renderSession(null);
    });
  }

  function bindEvents() {
    els.loginForm.addEventListener('submit', handleLogin);
    els.googleLoginButton.addEventListener('click', function () {
      handleOAuthLogin('google');
    });
    els.appleLoginButton.addEventListener('click', function () {
      handleOAuthLogin('apple');
    });
    els.logoutButton.addEventListener('click', handleLogout);
    els.refreshButton.addEventListener('click', loadDashboard);
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
      saveSession(result);
      session = result;
      setLoginMessage('', '');
      renderSession(session);
    }).catch(function (error) {
      setLoginMessage(error.message || 'Giriş yapılamadı.', 'error');
    }).finally(function () {
      setAuthButtonsDisabled(false);
    });
  }

  function handleOAuthLogin(provider) {
    setAuthButtonsDisabled(true);
    setLoginMessage(providerLabel(provider) + ' ile yönlendiriliyor...', '');

    window.location.assign(
      supabaseUrl.replace(/\/$/, '') +
        '/auth/v1/authorize?provider=' +
        encodeURIComponent(provider) +
        '&redirect_to=' +
        encodeURIComponent(getRedirectUrl())
    );
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
    els.dashboardView.hidden = true;
  }

  function showDashboard() {
    els.loginView.hidden = true;
    els.dashboardView.hidden = false;
  }

  function loadDashboard() {
    if (!session) return;

    setTableStatus('Yükleniyor...', '');
    renderEmptyRow('Yükleniyor...');
    renderTotals([]);

    var range = getDateRange();
    var accountRequest = apiRequest('/influencer_accounts?select=full_name,iban,payout_email,status')
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

    Promise.all([accountRequest, statsRequest]).then(function (results) {
      var account = results[0];
      var stats = results[1] || [];

      renderAccount(account);
      renderRows(stats);
      renderTotals(stats);

      if (!account) {
        setTableStatus('Bu email için influencer hesabı bulunamadı.', 'error');
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

  function renderAccount(account) {
    if (!account) {
      els.accountName.textContent = 'Performans';
      els.accountStatus.textContent = 'Hesap yok';
      els.accountStatus.classList.add('paused');
      els.payoutEmail.textContent = '';
      els.ibanText.textContent = '';
      return;
    }

    els.accountName.textContent = account.full_name || 'Performans';
    els.accountStatus.textContent = account.status === 'paused' ? 'Duraklatıldı' : 'Aktif';
    els.accountStatus.classList.toggle('paused', account.status === 'paused');
    els.payoutEmail.textContent = account.payout_email ? account.payout_email : '';
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
        '<td>', formatNumber(row.applied_users), '</td>',
        '<td>', formatNumber(row.converted_users), '</td>',
        '<td>', formatNumber(row.initial_purchases), '</td>',
        '<td>', formatNumber(row.non_renewing_purchases), '</td>',
        '<td>', formatNumber(row.renewals), '</td>',
        '<td>', formatDateTime(row.latest_purchase_at), '</td>',
        '</tr>'
      ].join('');
    }).join('');
  }

  function renderEmptyRow(text) {
    els.statsBody.innerHTML = '<tr><td colspan="7" class="empty-cell">' + escapeHtml(text) + '</td></tr>';
  }

  function renderTotals(rows) {
    var totals = rows.reduce(function (acc, row) {
      acc.appliedUsers += toNumber(row.applied_users);
      acc.convertedUsers += toNumber(row.converted_users);
      acc.initialPurchases += toNumber(row.initial_purchases);
      acc.renewals += toNumber(row.renewals);
      return acc;
    }, {
      appliedUsers: 0,
      convertedUsers: 0,
      initialPurchases: 0,
      renewals: 0
    });

    els.appliedUsersMetric.textContent = formatNumber(totals.appliedUsers);
    els.convertedUsersMetric.textContent = formatNumber(totals.convertedUsers);
    els.initialPurchasesMetric.textContent = formatNumber(totals.initialPurchases);
    els.renewalsMetric.textContent = formatNumber(totals.renewals);
  }

  function setDefaultDates() {
    setDatesForRange(selectedRange);
    applyRangeButtons();
  }

  function setDatesForRange(range) {
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

  function selectCustomRange() {
    selectedRange = 'custom';
    applyRangeButtons();
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

  function setTableStatus(text, type) {
    els.tableStatus.textContent = text;
    els.tableStatus.className = 'message' + (type ? ' ' + type : '');
  }

  function setAuthButtonsDisabled(disabled) {
    els.loginButton.disabled = disabled;
    els.googleLoginButton.disabled = disabled;
    els.appleLoginButton.disabled = disabled;
  }

  function providerLabel(provider) {
    return provider === 'apple' ? 'Apple' : 'Google';
  }

  function getRedirectUrl() {
    if (window.location.protocol === 'file:') {
      return 'https://fitwowapp.com/influencer/';
    }
    return window.location.origin + '/influencer/';
  }

  function persistOAuthCallbackSession() {
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

  function toNumber(value) {
    return Number(value || 0);
  }

  function formatDateTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
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
