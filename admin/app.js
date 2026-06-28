(function () {
  'use strict';

  var config = window.FITWOW_ADMIN_CONFIG || {};
  var supabaseUrl = config.supabaseUrl || readMeta('fitwow:supabase-url');
  var supabaseAnonKey = config.supabaseAnonKey || readMeta('fitwow:supabase-anon-key');
  var session = null;
  var selectedRange = '30';
  var SESSION_KEY = 'fitwow_admin_session';
  var ADMIN_SELECT = '/admin_accounts?select=id';

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
    monthInput: document.getElementById('monthInput'),
    fromDate: document.getElementById('fromDate'),
    toDate: document.getElementById('toDate'),
    refreshButton: document.getElementById('refreshButton'),
    rangeButtons: Array.prototype.slice.call(document.querySelectorAll('[data-range]')),
    tableStatus: document.getElementById('tableStatus'),
    statsBody: document.getElementById('statsBody'),
    influencerCountMetric: document.getElementById('influencerCountMetric'),
    totalCodeUsageMetric: document.getElementById('totalCodeUsageMetric'),
    subscriptionPurchasesMetric: document.getElementById('subscriptionPurchasesMetric'),
    activeFreeTrialsMetric: document.getElementById('activeFreeTrialsMetric')
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindEvents();
    setDefaultDates();

    if (!isConfigured()) {
      setLoginMessage('Supabase URL ve anon key ayarı eksik. admin/index.html içindeki meta alanlarını doldur.', 'error');
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
      return requireAdminAccess().then(function () {
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
    els.monthInput.addEventListener('change', selectMonthRange);
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
      return requireAdminAccess().then(function () {
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

    authRequest('/recover?redirect_to=' + encodeURIComponent(getRedirectUrl()), {
      method: 'POST',
      body: JSON.stringify({
        email: email
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
      return requireAdminAccess().then(function () {
        saveSession(session);
        setResetMessage('Şifre kaydedildi. Panele yönlendiriliyorsun.', 'success');
        renderSession(session);
      });
    }).catch(function (error) {
      if (error && error.code === 'not_admin') {
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
    apiRequest('/rpc/get_admin_influencer_stats', {
      method: 'POST',
      body: JSON.stringify({
        p_from: range.from,
        p_to: range.to
      })
    }).then(function (rows) {
      var stats = rows || [];
      renderRows(stats);
      renderTotals(stats);

      if (!stats.length) {
        setTableStatus('Bu tarih aralığında influencer promo kodu verisi yok.', '');
        return;
      }

      setTableStatus('Güncel', 'success');
    }).catch(function (error) {
      renderRows([]);
      renderTotals([]);
      if (isPermissionError(error)) {
        rejectCurrentSession('Bu panel sadece admin hesaplarına açık.');
        return;
      }
      setTableStatus(error.message || 'İstatistikler alınamadı.', 'error');
    });
  }

  function requireAdminAccess() {
    return apiRequest(ADMIN_SELECT).then(function (rows) {
      if (rows && rows.length) return rows[0];
      var error = new Error('Bu panel sadece admin hesaplarına açık.');
      error.code = 'not_admin';
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

  function renderRows(rows) {
    if (!rows.length) {
      renderEmptyRow('Veri yok');
      return;
    }

    els.statsBody.innerHTML = rows.map(function (row) {
      return [
        '<tr>',
        '<td class="code-cell">', escapeHtml(row.full_name || '-'), '</td>',
        '<td>', escapeHtml(row.user_email || '-'), '</td>',
        '<td>', escapeHtml(row.payout_email || '-'), '</td>',
        '<td>', escapeHtml(row.iban || '-'), '</td>',
        '<td>', formatStatus(row.status), '</td>',
        '<td class="code-cell">', escapeHtml(row.promo_code || '-'), '</td>',
        '<td>', formatNumber(row.total_code_usage), '</td>',
        '<td>', formatNumber(row.subscription_purchases), '</td>',
        '<td>', formatNumber(row.active_free_trials), '</td>',
        '<td>', formatNumber(row.cancelled_free_trials), '</td>',
        '</tr>'
      ].join('');
    }).join('');
  }

  function renderEmptyRow(text) {
    els.statsBody.innerHTML = '<tr><td colspan="10" class="empty-cell">' + escapeHtml(text) + '</td></tr>';
  }

  function renderTotals(rows) {
    var influencerIds = {};
    var totals = rows.reduce(function (acc, row) {
      if (row.influencer_account_id) influencerIds[row.influencer_account_id] = true;
      acc.totalCodeUsage += toNumber(row.total_code_usage);
      acc.subscriptionPurchases += toNumber(row.subscription_purchases);
      acc.activeFreeTrials += toNumber(row.active_free_trials);
      return acc;
    }, {
      totalCodeUsage: 0,
      subscriptionPurchases: 0,
      activeFreeTrials: 0
    });

    els.influencerCountMetric.textContent = formatNumber(Object.keys(influencerIds).length);
    els.totalCodeUsageMetric.textContent = formatNumber(totals.totalCodeUsage);
    els.subscriptionPurchasesMetric.textContent = formatNumber(totals.subscriptionPurchases);
    els.activeFreeTrialsMetric.textContent = formatNumber(totals.activeFreeTrials);
  }

  function setDefaultDates() {
    setDatesForRange(selectedRange);
    applyRangeButtons();
  }

  function setDatesForRange(range) {
    els.monthInput.value = '';

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
    if (!els.monthInput.value) return;
    selectedRange = 'month';
    applyRangeButtons();
    setDatesForMonth(els.monthInput.value);
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
    els.monthInput.value = '';
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
    if (window.location.protocol === 'file:') {
      return 'https://fitwowapp.com/admin/';
    }
    return window.location.origin + '/admin/';
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
          var error = new Error(payload.msg || payload.message || payload.error_description || payload.error || 'İstek başarısız.');
          error.status = response.status;
          error.code = payload.code || payload.error_code || '';
          error.payload = payload;
          throw error;
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

  function formatStatus(status) {
    if (status === 'paused') return 'Duraklatıldı';
    if (status === 'active') return 'Aktif';
    return escapeHtml(status || '-');
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('tr-TR').format(toNumber(value));
  }

  function toNumber(value) {
    return Number(value || 0);
  }

  function isPermissionError(error) {
    return error && (
      error.status === 401 ||
      error.status === 403 ||
      error.code === '42501' ||
      error.code === 'not_admin'
    );
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
