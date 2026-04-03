const api = {
    async list({ page, pageSize, q }) { const r = await fetch(`/api/routes?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q||'')}`); return r.json(); },
    async create(data) { const r = await fetch('/api/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
    async update(id, data) { const r = await fetch(`/api/routes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
    async remove(id) { const r = await fetch(`/api/routes/${id}`, { method: 'DELETE' }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); },
    async exportCsv() { const r = await fetch('/api/routes/export'); if (!r.ok) throw new Error(window.i18n.t('messages.exportFailed')); return r.text(); },
    async importCsv(text) { const r = await fetch('/api/routes/import', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
    async createUser(data) { const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
    deleteUser: async (id) => {
      await fetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    // Roles API
    async getRoles() { const r = await fetch('/api/roles'); if (!r.ok) throw new Error(window.i18n.t('messages.failedToFetchRoles')); return r.json(); },
    async createRole(data) { const r = await fetch('/api/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
    async updateRole(id, data) { const r = await fetch(`/api/roles/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
    async deleteRole(id) { const r = await fetch(`/api/roles/${id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(await r.text()); },
    // Web Settings API
    async getWebSettings() { const r = await fetch('/api/web-settings'); if (!r.ok) throw new Error(window.i18n.t('messages.failedToFetchWebSettings')); return r.json(); },
    async updateWebSettings(data) { const r = await fetch('/api/web-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
    async uploadCertificate(formData) {
      const response = await fetch('/api/web-settings/certificate', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      return response.json();
    },
    async validatePrivateKey(formData) {
      const response = await fetch('/api/web-settings/validate-key', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Validation failed');
      }
      return result;
    }
  };

  // Micro component loader
  async function includeComponents() {
    const containers = document.querySelectorAll('[data-include]');
    await Promise.all(Array.from(containers).map(async (el) => {
      const src = el.getAttribute('data-include');
      const res = await fetch(src);
      const html = await res.text();
      el.outerHTML = html; // Replace placeholder with fetched markup
    }));
  }

  // Ensure components are loaded before querying DOM elements
  await includeComponents();
  
  // Initialize modern checkbox styling for add routes form
  function initAddRoutesCheckboxes() {
    document.querySelectorAll('#add-days-group input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const label = e.target.closest('label');
        label.classList.toggle('checked', e.target.checked);
      });
    });
  }
  
  // Call after components are loaded
  initAddRoutesCheckboxes();

  const tbody = document.getElementById('routes-body');
  const searchInput = document.getElementById('search');
  const pageSizeSel = document.getElementById('pageSize');
  const firstBtn = document.getElementById('first');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const lastBtn = document.getElementById('last');
  const pageInfo = document.getElementById('pageInfo');
  const summary = document.getElementById('summary');
  const refreshBtn = document.getElementById('refresh');
  const exportBtn = document.getElementById('exportCsv');
  const importInput = document.getElementById('importCsv');
  const themeSwitch = document.getElementById('themeSwitch');
  const authCard = document.getElementById('auth-card');
  const routesCard = document.getElementById('routes-card');
  const usersCard = document.getElementById('users-card');
  const logoutBtn = document.getElementById('logoutBtn');
  const sidebar = document.getElementById('sidebar');
  const sidebarTheme = null;
  const sidebarLogout = null;
  const navRoutes = document.getElementById('nav-routes');
  const navUsers = document.getElementById('nav-users');
  const menuToggle = document.getElementById('menuToggle');
  const navProfile = document.getElementById('nav-profile');
  const profileCard = document.getElementById('profile-card');
  const helpCard = document.getElementById('help-card');
  const helpContent = document.getElementById('help-content');
  const navHelp = document.getElementById('nav-help');
  const navTokens = document.getElementById('nav-tokens');
  const tokensCard = document.getElementById('tokens-card');
  const navRoles = document.getElementById('nav-roles');
  const rolesCard = document.getElementById('roles-card');
  const navWebSettings = document.getElementById('nav-web-settings');
  const webSettingsCard = document.getElementById('web-settings-card');
  const menuDividerLabel = document.getElementById('menu-divider-label');
  

  let resetUserId = null;
  let resetUsername = null;

  // auth API helpers
  async function authMe() { const r = await fetch('/api/auth/me'); return r.json(); }
  async function authLogin(username, password) { const r = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password })}); if (!r.ok) throw new Error(await r.text()); return r.json(); }
  async function authLogout() { await fetch('/api/auth/logout', { method:'POST' }); }

  // Routes
  function rowTemplate(route) {
    const tr = document.createElement('tr');

    // ID cell
    const tdId = document.createElement("td");
    tdId.textContent = route.id;
    tr.appendChild(tdId);

    // dstUri input
    const tdDstUri = document.createElement("td");
    const inputDstUri = document.createElement("input");
    inputDstUri.value = route.dstUri || "";
    inputDstUri.style.width = "260px";
    tdDstUri.appendChild(inputDstUri);
    tr.appendChild(tdDstUri);

    // dstIPGname input
    const tdDstIPGname = document.createElement("td");
    const inputDstIPG = document.createElement("input");
    inputDstIPG.value = route.dstIPGname || "";
    inputDstIPG.style.width = "140px";
    tdDstIPGname.appendChild(inputDstIPG);
    tr.appendChild(tdDstIPGname);

    // days cell
    const tdDays = document.createElement("td");
    tdDays.className = "days-cell";
    tr.appendChild(tdDays);

    // start time
    const tdStart = document.createElement("td");
    const spanStart = document.createElement("span");
    spanStart.className = "time-field";
    const inputStart = document.createElement("input");
    inputStart.type = "time";
    inputStart.step = "60";
    inputStart.value = route.startTime || "";
    inputStart.style.width = "140px";
    spanStart.appendChild(inputStart);
    tdStart.appendChild(spanStart);
    tr.appendChild(tdStart);

    // end time
    const tdEnd = document.createElement("td");
    const spanEnd = document.createElement("span");
    spanEnd.className = "time-field";
    const inputEnd = document.createElement("input");
    inputEnd.type = "time";
    inputEnd.step = "60";
    inputEnd.value = route.endTime || "";
    inputEnd.style.width = "140px";
    spanEnd.appendChild(inputEnd);
    tdEnd.appendChild(spanEnd);
    tr.appendChild(tdEnd);

    // actions cell
    const tdActions = document.createElement("td");

    const actionsWrapper = document.createElement("div");
    actionsWrapper.style.display = "flex";
    actionsWrapper.style.gap = "0.5rem";
    actionsWrapper.style.alignItems = "center";

    tdActions.appendChild(actionsWrapper);

    // save button
    const btnSave = document.createElement("button");
    btnSave.className = "icon-btn save";
    btnSave.title = window.i18n.t("routes.saveRoute");
    btnSave.setAttribute("aria-label", window.i18n.t("routes.saveRoute"));
    const iconSave = document.createElement("i");
    iconSave.className = "fa-solid fa-floppy-disk";
    btnSave.appendChild(iconSave);
    actionsWrapper.appendChild(btnSave);

    // delete button
    const btnDelete = document.createElement("button");
    btnDelete.className = "icon-btn btn-red delete";
    btnDelete.title = window.i18n.t("routes.deleteRoute");
    btnDelete.setAttribute("aria-label", window.i18n.t("routes.deleteRoute"));
    const iconDelete = document.createElement("i");
    iconDelete.className = "fa-solid fa-trash";
    btnDelete.appendChild(iconDelete);
    actionsWrapper.appendChild(btnDelete);

    tr.appendChild(tdActions);

    const uriInput = tr.querySelector('td:nth-child(2) input');
    const nameInput = tr.querySelector('td:nth-child(3) input');
    const startInput = tr.querySelector('td:nth-child(5) input[type="time"]');
    const endInput = tr.querySelector('td:nth-child(6) input[type="time"]');

    // render weekday checkboxes for this row
    const selectedDays = (route.days || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const daysCell = tr.querySelector('.days-cell');
    const dayDefs = [
      ['mon', window.i18n.t('routes.weekdays.mon')], ['tue', window.i18n.t('routes.weekdays.tue')], ['wed', window.i18n.t('routes.weekdays.wed')], ['thu', window.i18n.t('routes.weekdays.thu')], ['fri', window.i18n.t('routes.weekdays.fri')], ['sat', window.i18n.t('routes.weekdays.sat')], ['sun', window.i18n.t('routes.weekdays.sun')]
    ];
    daysCell.textContent = ""; // clear first

    dayDefs.forEach(([val, label]) => {
      const lbl = document.createElement("label");
      if (selectedDays.includes(val)) {
        lbl.classList.add("checked");
      }

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "row-day";
      checkbox.value = val;
      checkbox.checked = selectedDays.includes(val);

      const span = document.createElement("span");
      span.textContent = label; // safe text injection

      lbl.appendChild(checkbox);
      lbl.appendChild(span);

      daysCell.appendChild(lbl);
      daysCell.appendChild(document.createTextNode(" ")); // keep spacing
    });
    
    // Add event listeners for modern checkbox styling
    daysCell.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const label = e.target.closest('label');
        label.classList.toggle('checked', e.target.checked);
      });
    });
    tr.querySelector('.save').addEventListener('click', async () => {
      const confirmed = await showConfirm(window.i18n.t('routes.editConfirm', { id: route.id }));
      if (!confirmed) return;
      try {
        const updated = await api.update(route.id, {
          dstUri: uriInput.value.trim(),
          dstIPGname: nameInput.value.trim(),
          days: Array.from(tr.querySelectorAll('.row-day:checked')).map(cb => cb.value).join(','),
          startTime: startInput.value.trim(),
          endTime: endInput.value.trim()
        });
        tr.replaceWith(rowTemplate(updated));
      } catch (e) { showMessage(window.i18n.t('messages.operationFailed') + ': ' + e.message, 'error'); }
    });
    tr.querySelector('.delete').addEventListener('click', async () => {
      const confirmed = await showConfirm(window.i18n.t('routes.deleteConfirm', { id: route.id }));
      if (!confirmed) return;
      try { await api.remove(route.id); tr.remove(); } catch (e) { showMessage(window.i18n.t('messages.operationFailed') + ': ' + e.message, 'error'); }
    });
    return tr;
  }

  let state = { page: 1, pageSize: 10, q: '' };

  async function refresh() {
    // Clear tbody safely
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }
  
    const res = await api.list(state);
  
    // Append rows safely (rowTemplate must return a <tr> element)
    for (const r of res.items) {
      tbody.appendChild(rowTemplate(r));
    }
  
    // Page info
    pageInfo.textContent = window.i18n.t('pagination.page', { 
      current: res.page, 
      total: Math.max(1, res.totalPages) 
    });
  
    // Summary info
    summary.textContent = window.i18n.t('pagination.showing', { 
      start: ((res.page - 1) * res.pageSize) + 1, 
      end: Math.min(res.page * res.pageSize, res.total), 
      total: res.total 
    });
  
    // Pagination buttons
    firstBtn.disabled = res.page <= 1;
    prevBtn.disabled = res.page <= 1;
    nextBtn.disabled = res.page >= res.totalPages;
    lastBtn.disabled = res.page >= res.totalPages;
  }

  // routes pagination controls
  firstBtn.addEventListener('click', () => { state.page = 1; refresh(); });
  prevBtn.addEventListener('click', () => { if (state.page > 1) { state.page--; refresh(); } });
  nextBtn.addEventListener('click', () => { state.page++; refresh(); });
  lastBtn.addEventListener('click', async () => { 
    const res = await api.list(state); 
    state.page = Math.max(1, res.totalPages); 
    refresh(); 
  });
  pageSizeSel.addEventListener('change', () => { state.pageSize = parseInt(pageSizeSel.value, 10); state.page = 1; refresh(); });
  refreshBtn.addEventListener('click', () => { state.page = 1; state.q = searchInput.value.trim(); refresh(); });
  
  // Live search with debounce
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.page = 1;
      state.q = searchInput.value.trim();
      refresh();
    }, 300); // 300ms debounce delay
  });
  
  // Keep Enter key functionality as backup
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); state.page = 1; state.q = searchInput.value.trim(); refresh(); } });

  // routes export
  exportBtn.addEventListener('click', async () => {
    try {
      const text = await api.exportCsv();
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'routes.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { showMessage(window.i18n.t('messages.exportFailed') + ': ' + e.message, 'error'); }
  });

  // routes import
  importInput.parentElement.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await api.importCsv(text);
      showMessage(window.i18n.t('messages.operationSuccessful') + `. Inserted: ${res.inserted}, Updated: ${res.updated}, Skipped: ${res.skipped}`, 'success');
      state.page = 1;
      await refresh();
    } catch (e) { showMessage(window.i18n.t('messages.operationFailed') + ': ' + e.message, 'error'); }
    finally {
      importInput.value = '';
    }
  });

// routes add
  const showAddRoutesBtn = document.getElementById('show-add-routes');
  const addRoutesLightbox = document.getElementById('add-routes-lightbox');
  const addRoutesForm = document.getElementById('add-routes-form');
  const cancelAddRoutesBtn = document.getElementById('cancel-add-routes');

  showAddRoutesBtn.addEventListener('click', () => {
    addRoutesLightbox.style.display = 'flex';
    addRoutesForm.reset();
    
    // Reset all day checkboxes to unchecked state
    document.querySelectorAll('#add-days-group label').forEach(label => {
      label.classList.remove('checked');
    });
    
    document.getElementById('add-routes-dstUri').focus();
  });

  cancelAddRoutesBtn.addEventListener('click', () => {
    addRoutesLightbox.style.display = 'none';
  });

  addRoutesLightbox.addEventListener('click', (e) => {
    if (e.target === addRoutesLightbox) addRoutesLightbox.style.display = 'none';
  });

  addRoutesLightbox.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dstUri = document.getElementById('add-routes-dstUri').value.trim();
    const dstIPGname = document.getElementById('add-routes-dstIPGname').value.trim();
    // FIX: collect checked days from checkboxes
    const days= Array.from(document.querySelectorAll('.add-routes-day:checked')).map(cb => cb.value).join(',');
    const startTime = document.getElementById('add-routes-startTime').value.trim();
    const endTime = document.getElementById('add-routes-endTime').value.trim();
    if (!dstUri || !dstIPGname) return;
    try {
      await api.create({ dstUri, dstIPGname, days, startTime, endTime });
      addRoutesForm.reset();
      addRoutesLightbox.style.display = 'none';
      state.page = 1; await refresh();
    }
    catch (e2) { showMessage(window.i18n.t('messages.operationFailed') + ': ' + e2.message, 'error'); }
  });

  // theme toggle
  (async function init(){
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.toggle('light', saved === 'light');
    try {
      const me = await authMe();
      if (me.user) {
        authCard.style.display = 'none';
        routesCard.style.display = '';
        logoutBtn.style.display = '';
        sidebar.style.display = '';
        menuDividerLabel.style.display = me.user.role === 'admin' ? '' : 'none';
        navUsers.style.display = me.user.role === 'admin' ? '' : 'none';
        navRoles.style.display = me.user.role === 'admin' ? '' : 'none';
        navTokens.style.display = me.user.role === 'admin' ? '' : 'none';
        navWebSettings.style.display = me.user.role === 'admin' ? '' : 'none';
        await refresh();
        if (me.user.role === 'admin') {
          await refreshUsers();
          await loadTokens();
          await loadRoles();
          initTokenUI();
          initRoleUI();
        }
      } else {
        window.location.href = '/login.html';
      }
    } catch (_) {
      window.location.href = '/login.html';
    }
  })();

  function updateThemeIcon() {
        const themeIcon = document.getElementById('themeIcon');
        if (document.documentElement.classList.contains('light')) {
          themeIcon.classList.remove('fa-sun');
          themeIcon.classList.add('fa-moon');
        } else {
          themeIcon.classList.remove('fa-moon');
          themeIcon.classList.add('fa-sun');
        }
      }

  (function initTheme(){
        const saved = localStorage.getItem('theme') || 'dark';
        document.documentElement.classList.toggle('light', saved === 'light');
        updateThemeIcon();
      })();

  themeSwitch.addEventListener('click', () => {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon();
  });

  // Language switcher functionality
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    // Set initial language from localStorage or browser default
    const savedLanguage = localStorage.getItem('language') || window.i18n.getCurrentLanguage();
    languageSelect.value = savedLanguage;
    
    document.addEventListener('languageChanged', () => {
      window.i18n.translateDOM();
      // Reload help content if help card is currently visible
      if (helpCard.style.display !== 'none') {
        loadHelp();
      }
    });

    languageSelect.addEventListener('change', (e) => {
      const selectedLanguage = e.target.value;
      localStorage.setItem('language', selectedLanguage);
      window.i18n.setLanguage(selectedLanguage);
    });
  }

  // login handlers
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();
    try { await authLogin(u, p); location.reload(); } catch { showMessage(window.i18n.t('messages.invalidCredentials'), 'error'); }
  });
  logoutBtn.addEventListener('click', async () => { await authLogout(); location.reload(); });

  // navigation
  function activate(view) {
    document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
    document.getElementById(`nav-${view}`).classList.add('active');
    authCard.style.display = view === 'auth' ? '' : 'none';
    routesCard.style.display = view === 'routes' ? '' : 'none';
    usersCard.style.display = view === 'users' ? '' : 'none';
    rolesCard.style.display = view === 'roles' ? '' : 'none';
    webSettingsCard.style.display = view === 'web-settings' ? '' : 'none';
    profileCard.style.display = view === 'profile' ? '' : 'none';
    helpCard.style.display = view === 'help' ? '' : 'none';
    tokensCard.style.display = view === 'tokens' ? '' : 'none';
    if (view === 'help') loadHelp();
    if (view === 'tokens') loadTokens();
    if (view === 'roles') loadRoles();
    if (view === 'web-settings') loadWebSettings();
  }
  navRoutes.addEventListener('click', (e) => { e.preventDefault(); activate('routes'); });
  navUsers.addEventListener('click', (e) => { e.preventDefault(); activate('users'); });
  navRoles.addEventListener('click', (e) => { e.preventDefault(); activate('roles'); });
  navWebSettings.addEventListener('click', (e) => { e.preventDefault(); activate('web-settings'); loadWebSettings(); });
  navProfile.addEventListener('click', (e) => { e.preventDefault(); activate('profile'); loadProfile(); });
  navHelp.addEventListener('click', (e) => { e.preventDefault(); activate('help'); });
  navTokens.addEventListener('click', (e) => { e.preventDefault(); activate('tokens'); });

  // collapse / expand menu
  menuToggle.addEventListener('click', () => {
    document.querySelector('.app').classList.toggle('collapsed');
  });

  // profile load/save
  async function loadProfile(){
    try {
      const r = await fetch('/api/profile');
      if (!r.ok) return;
      const p = await r.json();
      document.getElementById('pf-first').value = p.firstName || '';
      document.getElementById('pf-last').value = p.lastName || '';
      document.getElementById('pf-avatar').src = p.avatar || '/avatar-placeholder.svg';
      // 2FA/OTP toggle switch
      const otpToggle = document.getElementById('otp-toggle');
      const otpStatus = document.getElementById('otp-status');
      if (otpToggle && otpStatus) {
        otpToggle.checked = p.otp_enabled || false;
        otpStatus.textContent = p.otp_enabled ? window.i18n.t('profile.enabled') : window.i18n.t('profile.disabled');
      }
    } catch(_) {}
  }
  // Personal information save button handler
  document.getElementById('pf-personal-save').addEventListener('click', async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('pf-first').value.trim();
    const lastName = document.getElementById('pf-last').value.trim();
    
    const confirmed = await showConfirm(window.i18n.t('profile.updatePersonalInfo', { firstName: firstName || '(empty)', lastName: lastName || '(empty)' }));
    if (!confirmed) return;
    
    const payload = { firstName, lastName };
    const r = await fetch('/api/profile/personal', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) { 
      return; 
    }
    await loadProfile();
  });

  // Security save button handler
  document.getElementById('pf-security-save').addEventListener('click', async (e) => {
    e.preventDefault();
    const password = document.getElementById('pf-password').value.trim();
    const passwordConfirm = document.getElementById('pf-password-confirm').value.trim();
    
    if (!password) {
      showMessage('Please enter a new password', 'warning');
      return;
    }
    
    if (!passwordConfirm) {
      showMessage('Please confirm your password', 'warning');
      return;
    }
    
    if (password !== passwordConfirm) {
      showMessage('Passwords do not match. Please ensure both password fields are identical.', 'error');
      return;
    }
    
    const confirmed = await showConfirm('Are you sure you want to change your password?');
    if (!confirmed) return;
    
    const payload = { password };
    const r = await fetch('/api/profile/security', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) { 
      return; 
    }
    document.getElementById('pf-password').value = '';
    document.getElementById('pf-password-confirm').value = '';
  });

  // Removed duplicate avatar handler - using the one below

  // Avatar upload functionality
  document.getElementById('pf-image-upload').addEventListener('click', () => {
    document.getElementById('pf-file').click();
  });
  
  document.getElementById('pf-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('avatar', f);
    try {
      const r = await fetch('/api/profile/avatar', { method:'POST', body: fd });
      if (!r.ok) throw new Error(await r.text());
      const { avatar } = await r.json();
      document.getElementById('pf-avatar').src = avatar;
    } catch (err) {
      showMessage(window.i18n.t('messages.fileUploadFailed') + ': ' + err.message, 'error');
    }
  });

  // OTP (2FA) toggle switch logic
  function initOtp2fa() {
    const otpToggle = document.getElementById('otp-toggle');
    const otpStatus = document.getElementById('otp-status');
    const otpLightbox = document.getElementById('otp-lightbox');
    const otpForm = document.getElementById('otp-form');
    const otpQrcode = document.getElementById('otp-qrcode');
    const otpCodeInput = document.getElementById('otp-code');
    const cancelOtpBtn = document.getElementById('cancel-otp');
    if (!otpToggle || !otpStatus || !otpLightbox || !otpForm || !otpQrcode || !otpCodeInput || !cancelOtpBtn) {
      console.error('Missing 2FA elements:', { otpToggle, otpStatus, otpLightbox, otpForm, otpQrcode, otpCodeInput, cancelOtpBtn });
      return;
    }

    // Handle toggle switch changes
    otpToggle.addEventListener('change', async (e) => {
      const isEnabling = e.target.checked;
      
      if (isEnabling) {
        // Show confirmation for enabling 2FA
        const confirmed = await showConfirm(window.i18n.t('profile.enable2FAConfirm'));
        if (!confirmed) {
          e.target.checked = false;
          return;
        }
        
        // Start OTP setup
        try {
          const r = await fetch('/api/profile/otp/setup', { method: 'POST' });
          if (!r.ok) throw new Error('Failed to start OTP setup');
          const { qr } = await r.json();
          otpQrcode.src = qr;
          otpLightbox.style.display = 'flex';
          otpCodeInput.value = '';
          otpCodeInput.focus();
        } catch (err) {
          showMessage(window.i18n.t('messages.operationFailed') + ': ' + (err.message || err), 'error');
          e.target.checked = false;
        }
      } else {
        // Show confirmation for disabling 2FA
        const confirmed = await showConfirm(window.i18n.t('profile.disable2FAConfirm'));
        if (!confirmed) {
          e.target.checked = true;
          return;
        }
        
        // Disable OTP
        try {
          const r = await fetch('/api/profile/otp/disable', { method: 'POST' });
          if (!r.ok) throw new Error(await r.text());
          otpStatus.textContent = window.i18n.t('profile.disabled');
        } catch (err) {
          showMessage(window.i18n.t('messages.operationFailed') + ': ' + (err.message || err), 'error');
          e.target.checked = true;
        }
      }
    });

    // Cancel OTP setup
    cancelOtpBtn.addEventListener('click', async () => {
      // Call cleanup API
      try {
        await fetch('/api/profile/otp/cancel', { method: 'POST' });
      } catch (err) {
        console.error('Failed to cleanup OTP setup:', err);
      }
      otpLightbox.style.display = 'none';
      otpToggle.checked = false;
    });
    otpLightbox.addEventListener('click', async (e) => {
      if (e.target === otpLightbox) {
        // Call cleanup API
        try {
          await fetch('/api/profile/otp/cancel', { method: 'POST' });
        } catch (err) {
          console.error('Failed to cleanup OTP setup:', err);
        }
        otpLightbox.style.display = 'none';
        otpToggle.checked = false;
      }
    });

    // Submit OTP code to verify
    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = otpCodeInput.value.trim();
      if (!code) return;
      try {
        const r = await fetch('/api/profile/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        if (!r.ok) throw new Error(await r.text());
        otpLightbox.style.display = 'none';
        otpToggle.checked = true;
        otpStatus.textContent = window.i18n.t('profile.enabled');
      } catch (err) {
        showMessage(window.i18n.t('messages.operationFailed') + ': ' + (err.message || err), 'error');
        otpToggle.checked = false;
      }
    });
  }
  
  // Initialize 2FA functionality
  initOtp2fa();

  // Users admin
  async function refreshUsers() {
    const resp = await fetch('/api/users');
    if (!resp.ok) return;
    const users = await resp.json();
    const body = document.getElementById('users-body');
    while (body.firstChild) {
      body.removeChild(body.firstChild);
    }
    for (const u of users) {
      const tr = document.createElement("tr");

      // ID
      const tdId = document.createElement("td");
      tdId.textContent = u.id;
      tr.appendChild(tdId);

      // Username
      const tdUsername = document.createElement("td");
      tdUsername.textContent = u.username;
      tr.appendChild(tdUsername);

      // Role select
      const tdRole = document.createElement("td");
      const selectRole = document.createElement("select");
      selectRole.className = "role";

      ["user", "admin"].forEach(role => {
        const opt = document.createElement("option");
        opt.value = role;
        opt.textContent = role;
        if (u.role === role) {
          opt.selected = true;
        }
        selectRole.appendChild(opt);
      });
      tdRole.appendChild(selectRole);
      tr.appendChild(tdRole);

      // OTP enabled toggle
      const tdOtp = document.createElement("td");
      const label = document.createElement("label");
      label.className = "toggle-switch";

      const inputOtp = document.createElement("input");
      inputOtp.type = "checkbox";
      inputOtp.className = "otp-enabled";
      inputOtp.checked = !!u.otp_enabled;

      const spanSlider = document.createElement("span");
      spanSlider.className = "toggle-slider";

      label.appendChild(inputOtp);
      label.appendChild(spanSlider);
      tdOtp.appendChild(label);
      tr.appendChild(tdOtp);

      // Actions
      const tdActions = document.createElement("td");
      const actionsWrapper = document.createElement("div");
      actionsWrapper.style.display = "flex";
      actionsWrapper.style.gap = "0.5rem";
      actionsWrapper.style.alignItems = "center";
      tdActions.appendChild(actionsWrapper);

      // save
      const btnSave = document.createElement("button");
      btnSave.className = "icon-btn save-user";
      btnSave.title = "Save changes";
      btnSave.setAttribute("aria-label", "Save changes");
      const iconSave = document.createElement("i");
      iconSave.className = "fa-solid fa-floppy-disk";
      btnSave.appendChild(iconSave);
      actionsWrapper.appendChild(btnSave);

      // reset password
      const btnReset = document.createElement("button");
      btnReset.className = "icon-btn btn-orange reset-password-user";
      btnReset.title = "Reset Password";
      btnReset.setAttribute("aria-label", "Reset Password");
      const iconReset = document.createElement("i");
      iconReset.className = "fa-solid fa-key";
      btnReset.appendChild(iconReset);
      actionsWrapper.appendChild(btnReset);

      // delete
      const btnDelete = document.createElement("button");
      btnDelete.className = "icon-btn btn-red delete-user";
      btnDelete.title = "Delete user";
      btnDelete.setAttribute("aria-label", "Delete user");
      const iconDelete = document.createElement("i");
      iconDelete.className = "fa-solid fa-trash";
      btnDelete.appendChild(iconDelete);
      actionsWrapper.appendChild(btnDelete);

      tr.appendChild(tdActions);
      const roleSel = tr.querySelector('.role');
      const otpCheckbox = tr.querySelector('.otp-enabled');
      tr.querySelector('.save-user').addEventListener('click', async () => {
        // Input validation
        const newRole = roleSel.value;
        const newOtpEnabled = otpCheckbox.checked ? 1 : 0;
        
        // Validate role
        if (!['user', 'admin'].includes(newRole)) {
          showMessage('Invalid role selected. Must be "user" or "admin".', 'error');
          return;
        }
        
        // Check if anything actually changed
        if (newRole === u.role && newOtpEnabled === (u.otp_enabled ? 1 : 0)) {
          showMessage('No changes detected.', 'info');
          return;
        }
        
        const confirmed = await showConfirm(`Are you sure you want to change user "${u.username}"?`);
        if (!confirmed) return;
        
        try {
          const response = await fetch(`/api/users/${u.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole, otp_enabled: newOtpEnabled })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update user');
          }
          
          // Refresh the users list to show updated data
          refreshUsers();
          showMessage(`User "${u.username}" updated successfully.`, 'success');
        } catch (err) {
          showMessage('Failed to update user: ' + (err.message || err), 'error');
        }
      });
      tr.querySelector('.delete-user').addEventListener('click', async () => {
        const confirmed = await showConfirm(`Are you sure you want to delete user "${u.username}"?`);
        if (!confirmed) return;
        await api.deleteUser(u.id); 
        refreshUsers();
      });
      tr.querySelector('.reset-password-user').addEventListener('click', async () => {
        const confirmed = await showConfirm(`Reset password for user "${u.username}"?\nThis will require them to use a new password.`);
        if (!confirmed) return;
        
        resetUserId = u.id;
        resetUsername = u.username;
        resetPasswordLightbox.style.display = 'flex';
        resetPasswordLightbox.style.alignItems = 'center';
        resetPasswordInput.focus();
      });
      body.appendChild(tr);
    }
  }
// users add
  const showAddUserBtn = document.getElementById('show-add-user');
  const addUserLightbox = document.getElementById('add-user-lightbox');
  const addUserForm = document.getElementById('add-user-form');
  const cancelAddUserBtn = document.getElementById('cancel-add-user');

  showAddUserBtn.addEventListener('click', () => {
    addUserLightbox.style.display = 'flex';
    addUserForm.reset();
    document.getElementById('add-user-username').focus();
  });

  cancelAddUserBtn.addEventListener('click', () => {
    addUserLightbox.style.display = 'none';
  });

  addUserLightbox.addEventListener('click', (e) => {
    if (e.target === addUserLightbox) addUserLightbox.style.display = 'none';
  });

  addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('add-user-username').value.trim();
    const password = document.getElementById('add-user-password').value;
    const passwordConfirm = document.getElementById('add-user-password-confirm').value;
    const role = document.getElementById('add-user-role').value;
    
    if (!username || !password || !passwordConfirm || !role) return;
    
    if (password !== passwordConfirm) {
      showMessage('Passwords do not match. Please ensure both password fields are identical.', 'error');
      return;
    }
    
    try {
      await api.createUser({ username, password, role });
      addUserForm.reset();
      addUserLightbox.style.display = 'none';
      refreshUsers();
    } catch (err) {
      showMessage('Failed to add user: ' + (err.message || err), 'error');
    }
  });

  // users reset password
  const resetPasswordLightbox = document.getElementById('reset-password-lightbox');
  const resetPasswordForm = document.getElementById('reset-password-form');
  const resetPasswordInput = document.getElementById('reset-password');
  const resetPasswordConfirmInput = document.getElementById('reset-password-confirm');
  const cancelResetPasswordBtn = document.getElementById('cancel-reset-password');

  cancelResetPasswordBtn.addEventListener('click', () => {
    resetPasswordLightbox.style.display = 'none';
  });
  
  resetPasswordLightbox.addEventListener('click', (e) => {
    if (e.target === resetPasswordLightbox) resetPasswordLightbox.style.display = 'none';
  });
  
  resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = resetPasswordInput.value;
    const confirm = resetPasswordConfirmInput.value;
    if (!password || !confirm) return;
    if (password !== confirm) {
      showMessage('Passwords do not match.', 'error');
      return;
    }
    try {
      const response = await fetch(`/api/users/${resetUserId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      
      resetPasswordLightbox.style.display = 'none';
      resetPasswordForm.reset();
    } catch (err) {
      showMessage('Failed to reset password: ' + (err.message || err), 'error');
    }
  });

  // users edit
  editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('edit-user-username').value.trim();
    const password = document.getElementById('edit-user-password').value;
    const role = document.getElementById('edit-user-role').value;
    if (!username || !role) return;
    const confirmed = await showConfirm(`Are you sure you want to change user "${username}"?`);
    if (!confirmed) return;
    try {
      await api.updateUser({ username, password, role });
      editUserForm.reset();
      editUserLightbox.style.display = 'none';
      refreshUsers();
    } catch (err) {
      showMessage('Failed to update user: ' + (err.message || err), 'error');
    }
  });

// tokens
  async function loadTokens() {
    const res = await fetch('/api/tokens');
    const tokens = await res.json();
    const tokensbody = document.getElementById('tokens-body');
    while (tokensbody.firstChild) {
      tokensbody.removeChild(tokensbody.firstChild);
    }
    
    for (const t of tokens) {
      const tr = document.createElement('tr');

      // username
      const tdUser = document.createElement("td");
      tdUser.textContent = t.username;
      tr.appendChild(tdUser);

      // token cell
      const tdToken = document.createElement("td");

      const inputToken = document.createElement("input");
      inputToken.type = "text";
      inputToken.readOnly = true;
      inputToken.className = "w-220";
      // Mask token for security - show only first 8 and last 4 characters
      const token = t.token || "";
      const maskedToken = token.length > 12 
        ? token.substring(0, 8) + "..." + token.substring(token.length - 4)
        : token;
      inputToken.value = maskedToken;
      inputToken.dataset.fullToken = token; // Store full token securely

      const btnCopy = document.createElement("button");
      btnCopy.className = "icon-btn btn-secondary copy-token";
      btnCopy.title = "Copy Token";
      btnCopy.setAttribute("aria-label", "Copy Token");

      const iconCopy = document.createElement("i");
      iconCopy.className = "fa-solid fa-copy";
      btnCopy.appendChild(iconCopy);

      tdToken.appendChild(inputToken);
      tdToken.appendChild(btnCopy);
      tr.appendChild(tdToken);

      // actions cell
      const tdActions = document.createElement("td");

      const actionsWrapper = document.createElement("div");
      actionsWrapper.style.display = "flex";
      actionsWrapper.style.gap = "0.5rem";
      actionsWrapper.style.alignItems = "center";

      // regenerate button
      const btnRegen = document.createElement("button");
      btnRegen.className = "icon-btn regen-token";
      btnRegen.title = "Regenerate Token";
      btnRegen.setAttribute("aria-label", "Regenerate Token");

      const iconRegen = document.createElement("i");
      iconRegen.className = "fa-solid fa-arrows-rotate";
      btnRegen.appendChild(iconRegen);
      actionsWrapper.appendChild(btnRegen);

      // delete button
      const btnDelete = document.createElement("button");
      btnDelete.className = "icon-btn btn-red delete-token";
      btnDelete.title = "Delete Token";
      btnDelete.setAttribute("aria-label", "Delete Token");

      const iconDelete = document.createElement("i");
      iconDelete.className = "fa-solid fa-trash";
      btnDelete.appendChild(iconDelete);
      actionsWrapper.appendChild(btnDelete);

      tdActions.appendChild(actionsWrapper);
      tr.appendChild(tdActions);
      tr.querySelector('.copy-token').addEventListener('click', () => {
        const fullToken = tr.querySelector('input').dataset.fullToken;
        navigator.clipboard.writeText(fullToken);
      });
      tr.querySelector('.delete-token').addEventListener('click', async () => {
        const confirmed = await showConfirm(`Are you sure you want to delete token user "${t.username}"?`);
        if (!confirmed) return;
        await fetch(`/api/tokens/${encodeURIComponent(t.username)}`, { method: 'DELETE' });
        loadTokens();
      });
      tr.querySelector('.regen-token').addEventListener('click', async () => {
        const confirmed = await showConfirm(`Are you sure you want to refresh the token for user "${t.username}"?`);
        if (!confirmed) return;
        await fetch(`/api/tokens/${encodeURIComponent(t.username)}/regenerate`, { method: 'POST' });
        loadTokens();
      });
      tokensbody.appendChild(tr);
    }
  }
  function initTokenUI() {
    const showAddTokenBtn = document.getElementById('show-add-token');
    if (!showAddTokenBtn) return;
  
    const addTokenLightbox = document.getElementById('add-token-lightbox');
    const addTokenForm = document.getElementById('add-token-form');
    const cancelAddTokenBtn = document.getElementById('cancel-add-token');
  
    showAddTokenBtn.addEventListener('click', () => {
      addTokenLightbox.style.display = 'flex';
      addTokenForm.reset();
      document.getElementById('add-token-username').focus();
    });
  
    cancelAddTokenBtn.addEventListener('click', () => {
      addTokenLightbox.style.display = 'none';
    });
  
    addTokenLightbox.addEventListener('click', (e) => {
      if (e.target === addTokenLightbox) addTokenLightbox.style.display = 'none';
    });
  
    addTokenForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('add-token-username').value.trim();
      if (!username) return;
      await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      addTokenForm.reset();
      addTokenLightbox.style.display = 'none';
      loadTokens();
    });
  }
  // confirm lightbox
  function showConfirm(message) {
    return new Promise((resolve) => {
      const lightbox = document.getElementById('confirm-lightbox');
      const msg = document.getElementById('confirm-message');
      const okBtn = document.getElementById('confirm-ok');
      const cancelBtn = document.getElementById('confirm-cancel');
      msg.textContent = message;
      lightbox.style.display = 'flex';

      function cleanup(result) {
        lightbox.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        lightbox.removeEventListener('click', onBg);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onBg(e) { if (e.target === lightbox) cleanup(false); }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      lightbox.addEventListener('click', onBg);
    });
  }

  // message lightbox
  function showMessage(message, type = 'info') {
    return new Promise((resolve) => {
      const lightbox = document.getElementById('message-lightbox');
      const msgText = document.getElementById('message-text');
      const msgIcon = document.getElementById('message-icon');
      const okBtn = document.getElementById('message-ok');
      
      msgText.textContent = message;
      
      // Set icon based on message type
      let iconClass = 'fa-solid fa-info-circle';
      let iconColor = 'var(--text-primary)';
      
      switch (type) {
        case 'success':
          iconClass = 'fa-solid fa-check-circle';
          iconColor = 'var(--success-color, #28a745)';
          break;
        case 'error':
          iconClass = 'fa-solid fa-exclamation-triangle';
          iconColor = 'var(--error-color, #dc3545)';
          break;
        case 'warning':
          iconClass = 'fa-solid fa-exclamation-circle';
          iconColor = 'var(--warning-color, #ffc107)';
          break;
        default:
          iconClass = 'fa-solid fa-info-circle';
          iconColor = 'var(--info-color, #17a2b8)';
      }
      
      msgIcon.innerHTML = `<i class="${iconClass}" style="color: ${iconColor};"></i>`;
      lightbox.style.display = 'flex';

      function cleanup() {
        lightbox.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        lightbox.removeEventListener('click', onBg);
        resolve();
      }
      function onOk() { cleanup(); }
      function onBg(e) { if (e.target === lightbox) cleanup(); }

      okBtn.addEventListener('click', onOk);
      lightbox.addEventListener('click', onBg);
    });
  }

  // roles management
  async function loadRoles() {
    try {
      const roles = await api.getRoles();
      const rolesBody = document.getElementById('roles-body');
      while (rolesBody.firstChild) {
        rolesBody.removeChild(rolesBody.firstChild);
      }
      
      for (const role of roles) {
        const tr = document.createElement('tr');
        const permissions = role.permissions || {};
        const routePerms = permissions.routes || {};
        
        const permissionsList = [];
        if (routePerms.view) permissionsList.push('View');
        if (routePerms.add) permissionsList.push('Add');
        if (routePerms.edit) permissionsList.push('Edit');
        if (routePerms.delete) permissionsList.push('Delete');
        
        // role id
        const tdId = document.createElement("td");
        tdId.textContent = role.id;
        tr.appendChild(tdId);

        // role name
        const tdName = document.createElement("td");
        tdName.textContent = role.name;
        tr.appendChild(tdName);

        // administrator flag
        const tdAdmin = document.createElement("td");
        tdAdmin.textContent = permissions.administrator ? "Yes" : "No";
        tr.appendChild(tdAdmin);

        // permissions list
        const tdPerms = document.createElement("td");
        tdPerms.textContent = permissionsList.length > 0 ? permissionsList.join(", ") : "None";
        tr.appendChild(tdPerms);

        // actions cell
        const tdActions = document.createElement("td");
        const actionsWrapper = document.createElement("div");
        actionsWrapper.style.display = "flex";
        actionsWrapper.style.gap = "0.5rem";
        actionsWrapper.style.alignItems = "center";

        // edit button
        const btnEdit = document.createElement("button");
        btnEdit.className = "icon-btn edit-role";
        btnEdit.title = "Edit role";
        btnEdit.setAttribute("aria-label", "Edit role");
        btnEdit.dataset.roleId = role.id;

        const iconEdit = document.createElement("i");
        iconEdit.className = "fa-solid fa-pen-to-square";
        btnEdit.appendChild(iconEdit);
        actionsWrapper.appendChild(btnEdit);

        // delete button
        const btnDelete = document.createElement("button");
        btnDelete.className = "icon-btn btn-red delete-role";
        btnDelete.title = "Delete role";
        btnDelete.setAttribute("aria-label", "Delete role");
        btnDelete.dataset.roleId = role.id;

        const iconDelete = document.createElement("i");
        iconDelete.className = "fa-solid fa-trash";
        btnDelete.appendChild(iconDelete);
        actionsWrapper.appendChild(btnDelete);

        tdActions.appendChild(actionsWrapper);
        tr.appendChild(tdActions);
        
        rolesBody.appendChild(tr);
      }
      
      // Add event listeners for edit and delete buttons
      document.querySelectorAll('.edit-role').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const roleId = e.currentTarget.dataset.roleId;
          const role = roles.find(r => r.id == roleId);
          if (role) showEditRole(role);
        });
      });
      
      document.querySelectorAll('.delete-role').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const roleId = e.currentTarget.dataset.roleId;
          const role = roles.find(r => r.id == roleId);
          if (role) {
            const confirmed = await showConfirm(`Are you sure you want to delete role "${role.name}"?`);
            if (confirmed) {
              try {
                await api.deleteRole(roleId);
                await loadRoles();
              } catch (err) {
                showMessage('Failed to delete role: ' + (err.message || err), 'error');
              }
            }
          }
        });
      });
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  }

  function showEditRole(role) {
    const editLightbox = document.getElementById('edit-role-lightbox');
    const nameInput = document.getElementById('edit-role-name');
    const adminCheckbox = document.getElementById('edit-role-admin');
    const permissionCheckboxes = document.querySelectorAll('.edit-route-permission');
    
    nameInput.value = role.name;
    adminCheckbox.checked = role.permissions?.administrator || false;
    
    const routePerms = role.permissions?.routes || {};
    permissionCheckboxes.forEach(checkbox => {
      checkbox.checked = routePerms[checkbox.value] || false;
    });
    
    editLightbox.style.display = 'flex';
    editLightbox.dataset.roleId = role.id;
  }

  function initRoleUI() {
    const showAddRoleBtn = document.getElementById('show-add-role');
    const addRoleLightbox = document.getElementById('add-role-lightbox');
    const addRoleForm = document.getElementById('add-role-form');
    const cancelAddRoleBtn = document.getElementById('cancel-add-role');
    
    const editRoleLightbox = document.getElementById('edit-role-lightbox');
    const editRoleForm = document.getElementById('edit-role-form');
    const cancelEditRoleBtn = document.getElementById('cancel-edit-role');
    
    if (!showAddRoleBtn) return;
    
    // Add role handlers
    showAddRoleBtn.addEventListener('click', () => {
      addRoleLightbox.style.display = 'flex';
      addRoleForm.reset();
      document.getElementById('add-role-name').focus();
    });
    
    cancelAddRoleBtn.addEventListener('click', () => {
      addRoleLightbox.style.display = 'none';
    });
    
    addRoleLightbox.addEventListener('click', (e) => {
      if (e.target === addRoleLightbox) addRoleLightbox.style.display = 'none';
    });
    
    addRoleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('add-role-name').value.trim();
      const isAdmin = document.getElementById('add-role-admin').checked;
      const routePermissions = {};
      
      document.querySelectorAll('.route-permission').forEach(checkbox => {
        routePermissions[checkbox.value] = checkbox.checked;
      });
      
      if (!name) return;
      
      try {
        const roleData = {
          name,
          permissions: {
            administrator: isAdmin,
            routes: routePermissions
          }
        };
        
        await api.createRole(roleData);
        addRoleForm.reset();
        addRoleLightbox.style.display = 'none';
        await loadRoles();
      } catch (err) {
        showMessage('Failed to create role: ' + (err.message || err), 'error');
      }
    });
    
    // Edit role handlers
    if (cancelEditRoleBtn) {
      cancelEditRoleBtn.addEventListener('click', () => {
        editRoleLightbox.style.display = 'none';
      });
    }
    
    if (editRoleLightbox) {
      editRoleLightbox.addEventListener('click', (e) => {
        if (e.target === editRoleLightbox) editRoleLightbox.style.display = 'none';
      });
    }
    
    if (editRoleForm) {
      editRoleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roleId = editRoleLightbox.dataset.roleId;
        const name = document.getElementById('edit-role-name').value.trim();
        const isAdmin = document.getElementById('edit-role-admin').checked;
        const routePermissions = {};
        
        document.querySelectorAll('.edit-route-permission').forEach(checkbox => {
          routePermissions[checkbox.value] = checkbox.checked;
        });
        
        if (!name || !roleId) return;
        
        try {
          const roleData = {
            name,
            permissions: {
              administrator: isAdmin,
              routes: routePermissions
            }
          };
          
          await api.updateRole(roleId, roleData);
          editRoleLightbox.style.display = 'none';
          await loadRoles();
        } catch (err) {
          showMessage('Failed to update role: ' + (err.message || err), 'error');
        }
      });
    }
  }

  // markdown to html
  function renderMarkdown(md) {
    return marked.parse(md);
  }

  // help load
  async function loadHelp() {
    try {
      const currentLang = window.i18n?.getCurrentLanguage() || 'en';
  
      // Try localized file, then fallback to help.md, then final error
      const filesToTry = [
        `/help.${currentLang}.md`,
        ...(currentLang !== 'en' ? ['/help.md'] : [])
      ];
  
      let content = null;
      for (const file of filesToTry) {
        const res = await fetch(file);
        if (res.ok) {
          content = await res.text();
          break;
        }
      }
  
      helpContent.innerHTML = content 
        ? renderMarkdown(content) 
        : '<p>Help content not available.</p>';
    } catch (error) {
      helpContent.innerHTML = '<p>Error loading help content. Please try again later.</p>';
    }
  }

  // Web Settings functionality
  async function loadWebSettings() {
    try {
      const response = await api.getWebSettings();
      
      // Set access mode dropdown
      const accessModeSelect = document.getElementById('server-access-mode');
      if (accessModeSelect && response.access_mode) {
        accessModeSelect.value = response.access_mode;
      }
      
      // Display certificate info if available
      if (response.certificate_info) {
        const certInfo = response.certificate_info;
        document.getElementById('certificate-status').style.display = 'block';
        document.getElementById('cert-issuer').textContent = certInfo.issuer || '-';
        document.getElementById('cert-subject').textContent = certInfo.subject || '-';
        document.getElementById('cert-valid-from').textContent = certInfo.validFrom || '-';
        document.getElementById('cert-valid-to').textContent = certInfo.validTo || '-';
        
        const statusBadge = document.getElementById('cert-status-text');
        statusBadge.textContent = certInfo.status || '-';
        statusBadge.className = `status-badge ${certInfo.status || ''}`;
      } else {
        document.getElementById('certificate-status').style.display = 'none';
      }
      
      // Attach event listeners after DOM elements are loaded
      attachWebSettingsEventListeners();
      
    } catch (error) {
      console.error('Error loading web settings:', error);
      showWebSettingsMessage('Failed to load settings: ' + error.message, 'error');
    }
  }

  function attachWebSettingsEventListeners() {
    // Remove existing listeners to prevent duplicates
    const form = document.getElementById('web-settings-form');
    const refreshBtn = document.getElementById('load-web-settings');
    
    if (!form || !refreshBtn) {
      console.error('Web settings form elements not found');
      return;
    }

    // Clone and replace form to remove existing event listeners
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // Clone and replace refresh button
    const newRefreshBtn = refreshBtn.cloneNode(true);
    refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);

    console.log('Attaching Web Settings event listeners');

    // Form submission handler
    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Web settings form submitted');
      
      const formData = new FormData(e.target);
      const accessMode = formData.get('accessMode');
      const privateKeyFile = formData.get('privateKeyFile');
      const certificateFile = formData.get('certificateFile');
      const privateKeyPassphrase = formData.get('privateKeyPassphrase');

      console.log('Form data:', {
        accessMode,
        privateKeyFile: privateKeyFile ? `${privateKeyFile.name} (${privateKeyFile.size} bytes)` : 'none',
        certificateFile: certificateFile ? `${certificateFile.name} (${certificateFile.size} bytes)` : 'none',
        hasPassphrase: !!privateKeyPassphrase
      });

      try {
        showWebSettingsMessage('Updating settings...', 'info');
        
        // Update access mode
        await api.updateWebSettings({ access_mode: accessMode });
        console.log('Access mode updated successfully');
        
        // Upload certificate if files are provided
        if (privateKeyFile && certificateFile && privateKeyFile.size > 0 && certificateFile.size > 0) {
          console.log('Validating private key...');
          
          // Validate private key and passphrase before upload
          const keyValidation = await validatePrivateKey(privateKeyFile, privateKeyPassphrase);
          if (!keyValidation.valid) {
            showWebSettingsMessage(keyValidation.error, 'error');
            return;
          }
          
          console.log('Private key validation passed, uploading certificate files...');
          const certFormData = new FormData();
          certFormData.append('privateKeyFile', privateKeyFile);
          certFormData.append('certificateFile', certificateFile);
          if (privateKeyPassphrase) {
            certFormData.append('privateKeyPassphrase', privateKeyPassphrase);
          }
          
          const result = await api.uploadCertificate(certFormData);
          console.log('Certificate upload result:', result);
          showWebSettingsMessage('Settings and certificate updated successfully', 'success');
          
          // Update certificate status display
          if (result.certificateInfo) {
            const certInfo = result.certificateInfo;
            document.getElementById('certificate-status').style.display = 'block';
            document.getElementById('cert-issuer').textContent = certInfo.issuer || '-';
            document.getElementById('cert-subject').textContent = certInfo.subject || '-';
            document.getElementById('cert-valid-from').textContent = certInfo.validFrom || '-';
            document.getElementById('cert-valid-to').textContent = certInfo.validTo || '-';
            
            const statusBadge = document.getElementById('cert-status-text');
            statusBadge.textContent = certInfo.status || '-';
            statusBadge.className = `status-badge ${certInfo.status || ''}`;
          }
        } else {
          console.log('No certificate files to upload');
          showWebSettingsMessage('Access mode updated successfully', 'success');
        }
        
        // Clear file inputs
        document.getElementById('private-key-file').value = '';
        document.getElementById('certificate-file').value = '';
        document.getElementById('private-key-passphrase').value = '';
        
      } catch (error) {
        console.error('Error updating web settings:', error);
        showWebSettingsMessage('Failed to update settings: ' + error.message, 'error');
      }
    });

    // Refresh button handler
    newRefreshBtn.addEventListener('click', () => {
      console.log('Refresh button clicked');
      loadWebSettings();
    });

    console.log('Web Settings event listeners attached successfully');
  }

  // Private key validation function
  async function validatePrivateKey(privateKeyFile, passphrase) {
    try {
      // First do basic client-side validation
      const keyContent = await readFileAsText(privateKeyFile);
      
      if (!keyContent.includes('BEGIN') || !keyContent.includes('PRIVATE KEY')) {
        return {
          valid: false,
          error: 'Invalid private key format. Please upload a valid PEM-formatted private key file.'
        };
      }
      
      // Server-side validation with actual crypto validation
      const validationFormData = new FormData();
      validationFormData.append('privateKeyFile', privateKeyFile);
      if (passphrase) {
        validationFormData.append('privateKeyPassphrase', passphrase);
      }
      
      try {
        const result = await api.validatePrivateKey(validationFormData);
        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          error: error.message
        };
      }
      
    } catch (error) {
      return {
        valid: false,
        error: 'Failed to validate private key: ' + error.message
      };
    }
  }

  // Helper function to read file as text
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  function showWebSettingsMessage(message, type) {
    const messageEl = document.getElementById('web-settings-message');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    // ... (rest of the code remains the same)
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 5000);
  }

  // Web Settings form handlers - moved to loadWebSettings function