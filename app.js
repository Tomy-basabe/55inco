/* ═══════════════════════════════════════
   5inco Store – App Logic
   ═══════════════════════════════════════ */

const APP_VERSION = '1.4.0';

// ─── Init ─────────────────────────────────────────────────
// Supabase y seed se inicializan asíncronamente al final en startApp()

let currentUser = null;
let cart = [];        // [{ product, qty, discount }]
let salePayType = 'efectivo';
let saleDebtorId = null;
let dashStartDate = null;
let dashEndDate = null;

// ─── Helpers ──────────────────────────────────────────────
function fmt(n) {
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}
function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
}
function el(id) { return document.getElementById(id); }
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  el(id).classList.add('active');
}
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const v = el(id);
  if (v) v.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`[data-view="${id}"]`).forEach(n => n.classList.add('active'));
}
function toast(msg, type = 'info') {
  const tc = el('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  tc.appendChild(div);
  setTimeout(() => div.style.opacity = '0', 2700);
  setTimeout(() => div.remove(), 3000);
}

// ─── Searchable Select Helper ──────────────────────────────
function sortByName(arr, key = 'name') {
  return [...arr].sort((a, b) => a[key].localeCompare(b[key], 'es'));
}

/**
 * Converts a <select id="selectId"> inside a .form-group into a searchable combobox.
 * Call after the modal DOM is rendered.
 * @param {string} selectId - id of the original <select>
 * @param {Function} [onChangeCb] - optional callback(value, label) on selection
 */
function makeSearchableSelect(selectId, onChangeCb) {
  setTimeout(() => {
    const sel = document.getElementById(selectId);
    if (!sel || sel.dataset.searchable) return;
    sel.dataset.searchable = '1';
    sel.style.display = 'none';

    const options = Array.from(sel.options).map(o => ({ value: o.value, label: o.text }));
    const wrapper = document.createElement('div');
    wrapper.className = 'ss-wrapper';
    wrapper.style.cssText = 'position:relative;';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'ss-search';
    searchInput.placeholder = '🔍 Buscar...';
    searchInput.autocomplete = 'off';
    searchInput.style.cssText = 'width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg3);color:var(--text);font-size:13px;font-family:inherit;outline:none;cursor:pointer;box-sizing:border-box;';

    const dropdown = document.createElement('div');
    dropdown.className = 'ss-dropdown';
    dropdown.style.cssText = 'display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r-sm);z-index:9999;max-height:200px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.4);';

    function renderOptions(filter = '') {
      const q = filter.toLowerCase();
      dropdown.innerHTML = '';
      options.filter(o => o.label.toLowerCase().includes(q)).forEach(o => {
        const item = document.createElement('div');
        item.className = 'ss-option';
        item.style.cssText = 'padding:9px 14px;cursor:pointer;font-size:13px;transition:background .15s;';
        item.textContent = o.label;
        item.dataset.value = o.value;
        item.addEventListener('mouseenter', () => item.style.background = 'var(--bg3)');
        item.addEventListener('mouseleave', () => item.style.background = '');
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          sel.value = o.value;
          searchInput.value = o.value && o.value !== '' ? o.label : '';
          searchInput.style.borderColor = 'var(--border)';
          dropdown.style.display = 'none';
          sel.dispatchEvent(new Event('change'));
          if (onChangeCb) onChangeCb(o.value, o.label);
        });
        dropdown.appendChild(item);
      });
      if (dropdown.children.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'Sin resultados';
        empty.style.cssText = 'padding:10px 14px;font-size:12px;color:var(--text-3);';
        dropdown.appendChild(empty);
      }
    }

    // Show selected value if pre-selected
    const preSelected = options.find(o => o.value === sel.value);
    if (preSelected && preSelected.value) searchInput.value = preSelected.label;

    searchInput.addEventListener('focus', () => {
      searchInput.select();
      renderOptions(searchInput.value === (options.find(o=>o.value===sel.value)?.label||'') ? '' : searchInput.value);
      dropdown.style.display = 'block';
      searchInput.style.borderColor = 'var(--accent)';
      searchInput.style.boxShadow = '0 0 0 3px rgba(124,110,248,.2)';
    });
    searchInput.addEventListener('input', () => {
      renderOptions(searchInput.value);
      dropdown.style.display = 'block';
    });
    searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.style.display = 'none';
        searchInput.style.borderColor = 'var(--border)';
        searchInput.style.boxShadow = '';
        // Restore label if value still selected
        const cur = options.find(o => o.value === sel.value);
        if (cur && cur.value) searchInput.value = cur.label;
        else if (!sel.value) searchInput.value = '';
      }, 150);
    });

    wrapper.appendChild(searchInput);
    wrapper.appendChild(dropdown);
    sel.parentNode.insertBefore(wrapper, sel.nextSibling);
  }, 30);
}

// ─── Modal ────────────────────────────────────────────────
function openModal(title, bodyHtml, footerHtml = '') {
  el('modal-title').textContent = title;
  el('modal-body').innerHTML = bodyHtml;
  el('modal-footer').innerHTML = footerHtml;
  el('modal-overlay').style.display = 'flex';
}
function closeModal() {
  el('modal-overlay').style.display = 'none';
}
el('modal-close').addEventListener('click', closeModal);
el('modal-overlay').addEventListener('click', e => { if (e.target === el('modal-overlay')) closeModal(); });

// ─── Theme Toggle ──────────────────────────────────────────
(function() {
  const toggleBtn = el('theme-toggle');
  if (!toggleBtn) return;
  
  const updateIcon = (theme) => {
    const iconSpan = toggleBtn.querySelector('.theme-icon');
    if (iconSpan) {
      iconSpan.textContent = theme === 'light' ? '☀️' : '🌙';
    }
  };

  const currentTheme = localStorage.getItem('theme') || 'dark';
  updateIcon(currentTheme);

  toggleBtn.addEventListener('click', () => {
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateIcon(newTheme);
    toast(`Tema ${newTheme === 'light' ? 'claro' : 'oscuro'} activado`, 'info');
  });
})();

// ─── Netflix Login & PIN Controls ──────────────────────────
let selectedProfileUser = null;

function renderNetflixProfiles() {
  const container = el('netflix-profiles-list');
  if (!container) return;
  
  const users = DB.getUsers();
  container.innerHTML = users.map(u => `
    <div class="netflix-profile" onclick="selectNetflixProfile('${u.id}')">
      <div class="netflix-avatar">${initials(u.name)}</div>
      <div class="netflix-profile-name">${u.name}</div>
    </div>
  `).join('');
}

function selectNetflixProfile(userId) {
  const user = DB.getUsers().find(u=>u.id===userId);
  if (!user) return;
  selectedProfileUser = user;
  
  el('pin-user-name').textContent = user.name;
  el('pin-avatar-display').textContent = initials(user.name);
  el('login-pin-input').value = '';
  el('login-pin-error').style.display = 'none';
  el('netflix-pin-overlay').style.display = 'flex';
  
  setTimeout(() => el('login-pin-input').focus(), 150);
}

el('btn-pin-back').addEventListener('click', () => {
  el('netflix-pin-overlay').style.display = 'none';
  selectedProfileUser = null;
});

el('netflix-pin-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!selectedProfileUser) return;
  
  const pinEntered = el('login-pin-input').value.trim();
  if (selectedProfileUser.password === pinEntered) {
    el('login-pin-error').style.display = 'none';
    el('netflix-pin-overlay').style.display = 'none';
    currentUser = selectedProfileUser;
    DB.setSession(selectedProfileUser);
    
    const dateStr = today();
    const hoursData = DB.getHours();
    const needsHours = (!hoursData[currentUser.id] || hoursData[currentUser.id][dateStr] === undefined);
    const cashSess = DB.getCashSession(dateStr);
    const needsCash = !cashSess;

    if (needsHours && needsCash) {
      promptOpeningCashAndHours(dateStr);
    } else if (needsHours) {
      promptOpeningHours(dateStr);
    } else if (needsCash) {
      promptOpeningCashBox(dateStr);
    } else {
      initApp();
    }
  } else {
    el('login-pin-error').textContent = 'PIN incorrecto.';
    el('login-pin-error').style.display = 'block';
    el('login-pin-input').value = '';
    el('login-pin-input').focus();
  }
});

function promptOpeningCashBox(dateStr) {
  openModal('📥 Apertura de Caja Diaria', `
    <p class="text-muted mb-2">Hola <strong>${currentUser.name}</strong>. Antes de realizar la primera venta del día, por favor ingresá el efectivo inicial que hay en caja chica:</p>
    <div class="form-group" style="margin-top: 15px;">
      <label>Efectivo Inicial en Caja ($)</label>
      <input type="number" id="opening-cash-input" value="0" min="0" style="font-size:24px; font-weight:800; text-align:center;" required autofocus/>
    </div>
  `, `
    <button class="btn btn-primary btn-full" onclick="saveOpeningCashBox('${dateStr}')">Iniciar Jornada y Abrir Caja ➔</button>
  `);
  // Prevent closing opening cashbox modal with clicks outside or close button
  el('modal-close').style.display = 'none';
  el('modal-overlay').onclick = null;
}

function saveOpeningCashBox(dateStr) {
  const openingAmt = parseFloat(el('opening-cash-input').value)||0;
  if (openingAmt < 0) { toast('Monto inválido','error'); return; }
  
  DB.setCashSession(dateStr, {
    openingCash: openingAmt,
    active: true,
    openedBy: currentUser.name,
    openedAt: new Date().toISOString()
  });
  
  el('modal-close').style.display = 'block';
  el('modal-overlay').onclick = e => { if (e.target === el('modal-overlay')) closeModal(); };
  closeModal();
  toast(`Caja abierta con un efectivo inicial de ${fmt(openingAmt)}`, 'success');
  initApp();
}

function promptOpeningCashAndHours(dateStr) {
  const defaultHours = currentUser.defaultHours || 3.5;
  openModal('📥 Apertura de Caja y Jornada', `
    <p class="text-muted mb-2">Hola <strong>${currentUser.name}</strong>. Por favor ingresá el efectivo inicial y tus horas a trabajar hoy:</p>
    <div class="form-group" style="margin-top: 15px;">
      <label>Efectivo Inicial en Caja ($)</label>
      <input type="number" id="opening-cash-input" value="0" min="0" style="font-size:24px; font-weight:800; text-align:center;" required autofocus/>
    </div>
    <div class="form-group" style="margin-top: 15px;">
      <label>Horas a trabajar hoy</label>
      <input type="number" id="opening-hours-input" value="${defaultHours}" min="1" max="24" style="font-size:24px; font-weight:800; text-align:center;" required />
    </div>
  `, `
    <button class="btn btn-primary btn-full" onclick="saveOpeningCashAndHours('${dateStr}')">Iniciar Jornada y Abrir Caja ➔</button>
  `);
  el('modal-close').style.display = 'none';
  el('modal-overlay').onclick = null;
}

function saveOpeningCashAndHours(dateStr) {
  const openingAmt = parseFloat(el('opening-cash-input').value)||0;
  const hours = parseFloat(el('opening-hours-input').value)||3.5;
  if (openingAmt < 0 || hours <= 0) { toast('Valores inválidos','error'); return; }
  
  DB.setCashSession(dateStr, {
    openingCash: openingAmt,
    active: true,
    openedBy: currentUser.name,
    openedAt: new Date().toISOString()
  });
  DB.setHoursForDay(currentUser.id, dateStr, hours);
  
  el('modal-close').style.display = 'block';
  el('modal-overlay').onclick = e => { if (e.target === el('modal-overlay')) closeModal(); };
  closeModal();
  toast(`Caja abierta y jornada de ${hours} hs registrada`, 'success');
  initApp();
}

function promptOpeningHours(dateStr) {
  const defaultHours = currentUser.defaultHours || 3.5;
  openModal('🕒 Inicio de Jornada', `
    <p class="text-muted mb-2">Hola <strong>${currentUser.name}</strong>. ¿Cuántas horas vas a trabajar hoy?</p>
    <div class="form-group" style="margin-top: 15px;">
      <label>Horas a trabajar hoy</label>
      <input type="number" id="opening-hours-input" value="${defaultHours}" min="1" max="24" style="font-size:24px; font-weight:800; text-align:center;" required autofocus/>
    </div>
  `, `
    <button class="btn btn-primary btn-full" onclick="saveOpeningHours('${dateStr}')">Iniciar Jornada ➔</button>
  `);
  el('modal-close').style.display = 'none';
  el('modal-overlay').onclick = null;
}

function saveOpeningHours(dateStr) {
  const hours = parseFloat(el('opening-hours-input').value)||3.5;
  if (hours <= 0) { toast('Horas inválidas','error'); return; }
  
  DB.setHoursForDay(currentUser.id, dateStr, hours);
  
  el('modal-close').style.display = 'block';
  el('modal-overlay').onclick = e => { if (e.target === el('modal-overlay')) closeModal(); };
  closeModal();
  toast(`Jornada de ${hours} hs registrada`, 'success');
  initApp();
}

// Change PIN Modal directly from selection screen
el('btn-change-pin-init').addEventListener('click', () => {
  const users = DB.getUsers();
  openModal('Cambiar PIN / Contraseña', `
    <div class="form-group">
      <label>Seleccionar Usuario</label>
      <select id="pin-change-user">
        ${users.map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>PIN Actual</label>
      <input type="password" id="pin-change-current" placeholder="••••"/>
    </div>
    <div class="form-group">
      <label>Nuevo PIN</label>
      <input type="password" id="pin-change-new" placeholder="Nuevo PIN" maxlength="8"/>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="processPinChange()">Cambiar PIN</button>
  `);
});

function processPinChange() {
  const userId = el('pin-change-user').value;
  const currentPin = el('pin-change-current').value.trim();
  const newPin = el('pin-change-new').value.trim();
  
  if (!currentPin || !newPin) {
    toast('Todos los campos son requeridos','error'); return;
  }
  
  const users = DB.getUsers();
  const idx = users.findIndex(u=>u.id===userId);
  if (idx<0) return;
  
  if (users[idx].password !== currentPin) {
    toast('El PIN actual es incorrecto','error'); return;
  }
  
  users[idx].password = newPin;
  DB.saveUsers(users);
  closeModal();
  toast('Contraseña/PIN actualizado con éxito','success');
  renderNetflixProfiles();
}

el('btn-logout').addEventListener('click', () => {
  DB.clearSession();
  currentUser = null;
  cart = [];
  selectedProfileUser = null;
  renderNetflixProfiles();
  showPage('page-login');
});

// ─── App Init ─────────────────────────────────────────────
function initApp() {
  showPage('page-app');
  renderSidebar();
  renderMobileNav();
  setupMobileControls();
  const defaultView = currentUser.role === 'jefe' ? 'view-dashboard' : 'view-venta';
  renderMainContent();
  showView(defaultView);
  updateMobileNavActive(defaultView);

  // Set mobile header user name
  const mobileUserName = el('mobile-user-name');
  if (mobileUserName) mobileUserName.textContent = currentUser.name;
}

function renderSidebar() {
  // User info
  el('sidebar-user-info').innerHTML = `
    <div class="user-info">
      <div class="user-avatar">${initials(currentUser.name)}</div>
      <div>
        <div class="user-name">${currentUser.name}</div>
        <span class="role-badge ${currentUser.role}">${currentUser.role === 'jefe' ? '👑 Jefe' : '💼 Cajero'}</span>
      </div>
    </div>`;

  const nav = el('sidebar-nav');
  const jefe = currentUser.role === 'jefe';

  let html = '';
  if (jefe) {
    html += navSection('Principal', [
      { view: 'view-dashboard', icon: '📊', label: 'Dashboard' },
    ]);
    html += navSection('Gestión', [
      { view: 'view-empleados', icon: '👥', label: 'Empleados' },
      { view: 'view-stock',     icon: '👗', label: 'Stock' },
      { view: 'view-categorias',icon: '🏷️',  label: 'Categorías' },
      { view: 'view-gastos',    icon: '💸',  label: 'Gastos y Caja' },
    ]);
    html += navSection('Reportes', [
      { view: 'view-historico-admin', icon: '🕵️', label: 'Historial Completo' },
    ]);
  }
  
  const ventasItems = [
    { view: 'view-venta',  icon: '🛒', label: 'Nueva Venta' },
    { view: 'view-historial', icon: '📋', label: 'Historial' },
  ];
  if (!jefe) {
    ventasItems.push({ view: 'view-gastos', icon: '💸', label: 'Caja y Retiros' });
    ventasItems.push({ view: 'view-mis-ganancias', icon: '💰', label: 'Mis Ganancias' });
    ventasItems.push({ view: 'view-stock', icon: '👗', label: 'Stock' });
  }
  html += navSection('Ventas', ventasItems);
  html += navSection('Deudores', [
    { view: 'view-deudores', icon: '💳', label: 'Lista Deudores' },
  ]);

  nav.innerHTML = html;
  nav.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const v = item.dataset.view;
      showView(v);
      renderView(v);
      // Close mobile sidebar on nav click
      closeMobileSidebar();
      updateMobileNavActive(v);
    });
  });
}

function navSection(label, items) {
  return `<div class="nav-section">
    <div class="nav-label">${label}</div>
    ${items.map(i => `<div class="nav-item" data-view="${i.view}">
      <span class="nav-icon">${i.icon}</span>${i.label}
    </div>`).join('')}
  </div>`;
}

// ─── Mobile Navigation ────────────────────────────────────
function getMobileNavItems() {
  const jefe = currentUser.role === 'jefe';
  const items = [];
  if (jefe) {
    items.push({ view: 'view-dashboard', icon: '📊', label: 'Dashboard' });
  }
  items.push({ view: 'view-venta',    icon: '🛒', label: 'Venta' });
  items.push({ view: 'view-historial',icon: '📋', label: 'Historial' });
  items.push({ view: 'view-deudores', icon: '💳', label: 'Deudores' });
  if (jefe) {
    items.push({ view: 'view-stock', icon: '👗', label: 'Stock' });
  } else {
    items.push({ view: 'view-gastos', icon: '💸', label: 'Caja' });
    items.push({ view: 'view-mis-ganancias', icon: '💰', label: 'Ganancias' });
    items.push({ view: 'view-stock', icon: '👗', label: 'Stock' });
  }
  return items;
}

function renderMobileNav() {
  const container = el('mobile-nav-items');
  if (!container) return;
  const items = getMobileNavItems();
  container.innerHTML = items.map(i => `
    <button class="mobile-nav-btn" data-view="${i.view}">
      <span class="mobile-nav-icon">${i.icon}</span>
      ${i.label}
    </button>
  `).join('');

  container.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      showView(v);
      renderView(v);
      updateMobileNavActive(v);
    });
  });
}

function updateMobileNavActive(viewId) {
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });
}

function setupMobileControls() {
  // Hamburger menu
  const menuBtn = el('mobile-menu-btn');
  const overlay = el('sidebar-overlay');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      el('sidebar').classList.toggle('open');
      overlay.classList.toggle('active');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', closeMobileSidebar);
  }
}

function closeMobileSidebar() {
  const sidebar = el('sidebar');
  const overlay = el('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}


function renderMainContent() {
  el('main-content').innerHTML = `
    ${currentUser.role === 'jefe' ? `
    <div class="view" id="view-dashboard"></div>
    <div class="view" id="view-empleados"></div>
    <div class="view" id="view-categorias"></div>
    <div class="view" id="view-historico-admin"></div>
    ` : ''}
    <div class="view" id="view-stock"></div>
    <div class="view" id="view-gastos"></div>
    <div class="view" id="view-venta"></div>
    <div class="view" id="view-historial"></div>
    <div class="view" id="view-deudores"></div>
    <div class="view" id="view-mis-ganancias"></div>
  `;
  // Render all views
  const views = ['view-venta','view-historial','view-deudores', 'view-gastos', 'view-mis-ganancias', 'view-stock'];
  if (currentUser.role === 'jefe') views.push('view-dashboard','view-empleados','view-categorias','view-historico-admin');
  views.forEach(v => renderView(v));

  // Version badge (bottom-right corner)
  let vBadge = document.getElementById('app-version-badge');
  if (!vBadge) {
    vBadge = document.createElement('div');
    vBadge.id = 'app-version-badge';
    vBadge.style.cssText = 'position:fixed;bottom:10px;right:14px;font-size:10px;color:var(--text-3);background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:2px 8px;z-index:9999;pointer-events:none;font-family:monospace;';
    document.body.appendChild(vBadge);
  }
  vBadge.textContent = `v${APP_VERSION}`;
}

function renderView(v) {
  const el2 = el(v);
  if (!el2) return;
  switch(v) {
    case 'view-dashboard':        el2.innerHTML = buildDashboard(); bindDashboard(); break;
    case 'view-empleados':         el2.innerHTML = buildEmpleados(); bindEmpleados(); break;
    case 'view-stock':             el2.innerHTML = buildStock(); bindStock(); break;
    case 'view-categorias':        el2.innerHTML = buildCategorias(); bindCategorias(); break;
    case 'view-venta':             el2.innerHTML = buildVenta(); bindVenta(); break;
    case 'view-historial':         el2.innerHTML = buildHistorial(); break;
    case 'view-deudores':          el2.innerHTML = buildDeudores(); bindDeudores(); break;
    case 'view-gastos':            el2.innerHTML = buildGastos(); bindGastos(); break;
    case 'view-mis-ganancias':     el2.innerHTML = buildMisGanancias(); bindMisGanancias(); break;
    case 'view-historico-admin':   el2.innerHTML = buildHistoricoAdmin(); bindHistoricoAdmin(); break;
  }
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════
function buildDashboard() {
  if (!dashStartDate) {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    dashStartDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  if (!dashEndDate) dashEndDate = today();

  const sales = DB.getSales();
  const today_str = today();
  const todaySales = sales.filter(s => s.date.startsWith(today_str) && !s.returned);
  
  const intervalSales = sales.filter(s => {
    if (s.returned) return false;
    const d = s.date.slice(0,10);
    return d >= dashStartDate && d <= dashEndDate;
  });

  const totalVendido = intervalSales.reduce((a, s) => a + s.totalFinal, 0);
  const ventasEfectivoInt = intervalSales.reduce((sum, s) => {
    if (s.payType === 'efectivo') return sum + s.totalFinal;
    if (s.payType === 'multi' && s.splitDetails) return sum + (s.splitDetails.cash || 0);
    return sum;
  }, 0);
  const ventasTransfInt = intervalSales.reduce((sum, s) => {
    if (s.payType === 'debito') return sum + s.totalFinal;
    if (s.payType === 'multi' && s.splitDetails) return sum + (s.splitDetails.card || 0);
    return sum;
  }, 0);
  const ventasDeudorInt = intervalSales.reduce((sum, s) => {
    if (s.payType === 'deudor') return sum + s.totalFinal;
    if (s.payType === 'multi' && s.splitDetails) return sum + (s.splitDetails.debt || 0);
    return sum;
  }, 0);

  // Calculate cash sales total
  const cashSalesToday = todaySales.reduce((sum, s) => {
    if (s.payType === 'efectivo') return sum + s.totalFinal;
    if (s.payType === 'multi' && s.splitDetails) return sum + (s.splitDetails.cash || 0);
    return sum;
  }, 0);

  const expenses = DB.getExpenses().filter(e => e.date.startsWith(today_str));
  const expensesToday = expenses.reduce((sum, e) => sum + e.amount, 0);

  const cashSess = DB.getCashSession(today_str);
  const openingCash = cashSess ? cashSess.openingCash : 0;
  const expectedCashInDrawer = openingCash + cashSalesToday - expensesToday;

  const products = DB.getProducts();
  const lowStock = products.filter(p => p.stock <= 2);
  const debtors = DB.getDebtors();
  const totalDebt = debtors.reduce((sum, d) => sum + DB.getDebtorBalance(d.id), 0);

  const last7 = [...Array(7)].map((_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (6-i));
    const ds = d.toISOString().slice(0,10);
    const label = d.toLocaleDateString('es-AR',{weekday:'short'});
    const amt = sales.filter(s=>s.date.startsWith(ds) && !s.returned).reduce((a,s)=>a+s.totalFinal,0);
    return { label, amt };
  });
  const maxAmt = Math.max(...last7.map(d=>d.amt), 1);

  return `
  <div class="view-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
    <div>
      <h2>📊 Dashboard</h2>
      <p>Resumen del negocio – ${new Date().toLocaleDateString('es-AR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
    </div>
    <div style="display:flex; gap: 10px; align-items: center; background: var(--bg2); padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
      <div style="display:flex; flex-direction: column; gap: 4px;">
        <label style="font-size: 11px; color: var(--text-3);">Desde</label>
        <input type="date" id="dash-start" class="form-control" style="padding: 4px 8px; font-size: 13px;" value="${dashStartDate}">
      </div>
      <div style="display:flex; flex-direction: column; gap: 4px;">
        <label style="font-size: 11px; color: var(--text-3);">Hasta</label>
        <input type="date" id="dash-end" class="form-control" style="padding: 4px 8px; font-size: 13px;" value="${dashEndDate}">
      </div>
    </div>
  </div>

  <div class="stats-grid" style="margin-bottom: 16px;">
    <div class="stat-card" style="border-left: 4px solid var(--purple); cursor: pointer; transition: all 0.2s;" id="card-total-vendido">
      <div class="stat-icon">📈</div>
      <div class="stat-label" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Total Vendido (Período)</span>
        <span style="font-size: 11px; color: var(--text-3); background: var(--bg3); padding: 2px 6px; border-radius: 4px;">Ver Desglose ▾</span>
      </div>
      <div class="stat-value text-purple" style="font-size:26px;">${fmt(totalVendido)}</div>
      <div style="font-size: 12px; color: var(--text-3); margin-top: 6px;">${intervalSales.length} ventas en el período</div>
    </div>
  </div>

  <div id="dash-breakdown" style="display: none; background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 16px; animation: fadeIn 0.2s ease;">
    <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; color: var(--text-2);">Desglose del período</h4>
    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 120px; background: var(--bg3); padding: 12px; border-radius: 8px;">
        <div style="font-size: 12px; color: var(--text-3); margin-bottom: 4px;">💵 Efectivo</div>
        <div style="font-size: 18px; font-weight: 600; color: var(--green);">${fmt(ventasEfectivoInt)}</div>
      </div>
      <div style="flex: 1; min-width: 120px; background: var(--bg3); padding: 12px; border-radius: 8px;">
        <div style="font-size: 12px; color: var(--text-3); margin-bottom: 4px;">🏦 Transferencia</div>
        <div style="font-size: 18px; font-weight: 600; color: var(--accent);">${fmt(ventasTransfInt)}</div>
      </div>
      <div style="flex: 1; min-width: 120px; background: var(--bg3); padding: 12px; border-radius: 8px;">
        <div style="font-size: 12px; color: var(--text-3); margin-bottom: 4px;">💳 Deudores</div>
        <div style="font-size: 18px; font-weight: 600; color: var(--red);">${fmt(ventasDeudorInt)}</div>
      </div>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card" style="border-left: 4px solid var(--accent);"><div class="stat-icon">📥</div><div class="stat-label">Caja Inicial Hoy</div><div class="stat-value text-accent">${fmt(openingCash)}</div></div>
    <div class="stat-card" style="border-left: 4px solid var(--green);"><div class="stat-icon">💵</div><div class="stat-label">Ventas Efectivo Hoy</div><div class="stat-value text-green">${fmt(cashSalesToday)}</div></div>
    <div class="stat-card" style="border-left: 4px solid var(--red);"><div class="stat-icon">💸</div><div class="stat-label">Gastos/Caja Hoy</div><div class="stat-value text-red">-${fmt(expensesToday)}</div></div>
    <div class="stat-card" style="border-left: 4px solid var(--purple);"><div class="stat-icon">💰</div><div class="stat-label">Caja Esperada (Efectivo)</div><div class="stat-value text-purple" style="font-size:26px;">${fmt(expectedCashInDrawer)}</div></div>
  </div>

  <div class="stats-grid" style="margin-top: 16px;">
    <div class="stat-card"><div class="stat-icon">🛒</div><div class="stat-label">Ventas Totales Hoy</div><div class="stat-value">${todaySales.length}</div></div>
    <div class="stat-card"><div class="stat-icon">👗</div><div class="stat-label">Productos</div><div class="stat-value">${products.length}</div></div>
    <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-label">Stock bajo</div><div class="stat-value text-yellow">${lowStock.length}</div></div>
    <div class="stat-card"><div class="stat-icon">💳</div><div class="stat-label">Deuda total</div><div class="stat-value text-red">${fmt(totalDebt)}</div></div>
  </div>

  <div class="section">
    <div class="section-header"><span class="section-title">Ventas últimos 7 días</span></div>
    <div class="card" style="padding:24px 20px">
      <div style="display:flex;align-items:flex-end;gap:10px;height:120px">
        ${last7.map(d=>`
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">
            <div style="font-size:10px;color:var(--text-3)">${fmt(d.amt)}</div>
            <div style="width:100%;background:var(--accent-g);border-radius:4px 4px 0 0;height:${Math.round((d.amt/maxAmt)*90)||4}px;opacity:.85;transition:height .4s ease"></div>
            <div style="font-size:11px;color:var(--text-2)">${d.label}</div>
          </div>`).join('')}
      </div>
    </div>
  </div>

  ${lowStock.length ? `
  <div class="section">
    <div class="section-header"><span class="section-title">⚠️ Stock bajo</span></div>
    <div class="table-wrap">
      <table><thead><tr><th>Producto</th><th>Categoría</th><th>Talle</th><th>Stock</th></tr></thead><tbody>
        ${lowStock.map(p=>{
          const cat = DB.getCategories().find(c=>c.id===p.categoryId);
          return `<tr><td>${p.name}</td><td>${cat?.name||'-'}</td><td>${p.talle||'-'}</td><td><span class="badge badge-red">${p.stock}</span></td></tr>`;
        }).join('')}
      </tbody></table>
    </div>
  </div>` : ''}
  `;
}
function bindDashboard() {
  const ds = document.getElementById('dash-start');
  const de = document.getElementById('dash-end');
  
  const updateDash = () => {
    dashStartDate = ds.value;
    dashEndDate = de.value;
    const mc = document.getElementById('main-content');
    if (mc) {
      mc.innerHTML = buildDashboard();
      bindDashboard();
    }
  };

  if (ds && de) {
    ds.addEventListener('change', updateDash);
    de.addEventListener('change', updateDash);
  }

  const cardTotal = document.getElementById('card-total-vendido');
  const breakdown = document.getElementById('dash-breakdown');
  if (cardTotal && breakdown) {
    cardTotal.addEventListener('click', () => {
      if (breakdown.style.display === 'none') {
        breakdown.style.display = 'block';
      } else {
        breakdown.style.display = 'none';
      }
    });
  }
}

// ══════════════════════════════════════════════════════════
//  EMPLEADOS
// ══════════════════════════════════════════════════════════
function buildMisGanancias() {
  const u = currentUser;
  
  if (!window._gananciasFromDate || !window._gananciasToDate) {
    const range = getWeekRange();
    window._gananciasFromDate = range.from;
    window._gananciasToDate = range.to;
  }
  const fromD = window._gananciasFromDate;
  const toD = window._gananciasToDate;

  const sales = DB.getSales().filter(s => {
    if (s.returned) return false;
    if (s.userId !== u.id && s.cashier !== u.name) return false;
    const d = s.date.slice(0,10);
    return d >= fromD && d <= toD;
  });

  const hoursDataObj = DB.getHours();
  let totalHours = 0;
  if (hoursDataObj[u.id]) {
    Object.entries(hoursDataObj[u.id]).forEach(([d, hs]) => {
      if (d >= fromD && d <= toD) totalHours += hs;
    });
  }

  const baseSalary = totalHours * (u.salaryHour || 0);
  const totalSalesAmount = sales.reduce((sum, s) => sum + s.totalFinal, 0);
  const commissionPct = u.commissionPct || 0;
  const commissionAmt = totalSalesAmount * (commissionPct / 100);
  const totalToPay = baseSalary + commissionAmt;

  return `
  <div class="view-header">
    <h2>💰 Mis Ganancias</h2>
    <p>Resumen de tus horas y comisiones</p>
    <div class="view-actions">
      <div class="search-box" style="flex:unset; width:auto; padding: 4px 10px;">
        <span style="font-size:12px; color:var(--text-3); font-weight:600;">SEMANA:</span>
        <input type="date" id="mg-filter-from" value="${fromD}" style="width:130px; font-size:12px; padding:4px; margin-left:8px; border:none; outline:none; background:transparent; color:var(--text);" />
        <span style="color:var(--text-3)">-</span>
        <input type="date" id="mg-filter-to" value="${toD}" style="width:130px; font-size:12px; padding:4px; border:none; outline:none; background:transparent; color:var(--text);" />
      </div>
      <button class="btn btn-secondary" onclick="openHorasEmpleado('${u.id}')">🕐 Editar mis horas</button>
    </div>
  </div>
  
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px;">
    <div class="stat-card">
      <div class="stat-icon">🕐</div>
      <div class="stat-label">Horas Trabajadas</div>
      <div class="stat-value">${totalHours}h <span style="font-size:14px;color:var(--text-3);font-weight:500;">(${fmt(u.salaryHour||0)}/h)</span></div>
      <div style="margin-top:8px;font-size:14px;color:var(--text-2);">Sueldo base: <strong>${fmt(baseSalary)}</strong></div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">🛍️</div>
      <div class="stat-label">Ventas Generadas</div>
      <div class="stat-value">${fmt(totalSalesAmount)}</div>
      <div style="margin-top:8px;font-size:14px;color:var(--text-2);">Comisión (${commissionPct}%): <strong class="text-accent">${fmt(commissionAmt)}</strong></div>
    </div>
  </div>
  
  <div style="background:var(--bg2); border:1px solid var(--border); border-radius:var(--r-md); padding:24px; text-align:center;">
    <div style="font-size:14px; color:var(--text-2); text-transform:uppercase; font-weight:700; letter-spacing:1px; margin-bottom:8px;">Total a Cobrar</div>
    <div style="font-size:36px; font-weight:800; color:var(--green);">${fmt(totalToPay)}</div>
    <div style="font-size:13px; color:var(--text-3); margin-top:8px;">(Sueldo base + Comisión)</div>
  </div>
  `;
}

function bindMisGanancias() {
  const fromEl = el('mg-filter-from');
  const toEl = el('mg-filter-to');
  if (fromEl) fromEl.addEventListener('change', (e) => { window._gananciasFromDate = e.target.value; renderView('view-mis-ganancias'); });
  if (toEl) toEl.addEventListener('change', (e) => { window._gananciasToDate = e.target.value; renderView('view-mis-ganancias'); });
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const toLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return {
    from: toLocalISO(start),
    to: toLocalISO(end)
  };
}

function buildEmpleados() {
  const users = DB.getUsers(); // Show both empleados and jefes
  
  if (!window._empleadosFromDate || !window._empleadosToDate) {
    const range = getWeekRange();
    window._empleadosFromDate = range.from;
    window._empleadosToDate = range.to;
  }
  const fromD = window._empleadosFromDate;
  const toD = window._empleadosToDate;

  const sales = DB.getSales().filter(s => {
    if (s.returned) return false;
    const d = s.date.slice(0,10);
    return d >= fromD && d <= toD;
  });

  const hoursDataObj = DB.getHours(); // { userId: { 'YYYY-MM-DD': hs } }

  let rows = users.map(u => {
    // 1. Horas en el periodo
    let totalHours = 0;
    if (hoursDataObj[u.id]) {
      Object.entries(hoursDataObj[u.id]).forEach(([d, hs]) => {
        if (d >= fromD && d <= toD) totalHours += hs;
      });
    }
    const baseSalary = totalHours * (u.salaryHour || 0);

    // 2. Ventas y Comisión
    const userSales = sales.filter(s => s.userId === u.id || (!s.userId && s.cashier === u.name));
    const totalSalesAmount = userSales.reduce((sum, s) => sum + s.totalFinal, 0);
    const commissionPct = u.commissionPct || 0;
    const commissionAmt = totalSalesAmount * (commissionPct / 100);

    const totalToPay = baseSalary + commissionAmt;

    return `
    <tr>
      <td><div class="flex-row"><div class="user-avatar" style="width:34px;height:34px;font-size:12px">${initials(u.name)}</div>${u.name}</div></td>
      <td>${totalHours}h <span style="font-size:10px;color:var(--text-3)">(${fmt(u.salaryHour||0)}/h)</span></td>
      <td>${fmt(baseSalary)}</td>
      <td>${fmt(totalSalesAmount)}</td>
      <td>${fmt(commissionAmt)} <span style="font-size:10px;color:var(--accent)">(${commissionPct}%)</span></td>
      <td class="text-green" style="font-weight:700;">${fmt(totalToPay)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openEmpleadoEdit('${u.id}')">✏️ Editar</button>
        <button class="btn btn-secondary btn-sm" onclick="openHorasEmpleado('${u.id}')">🕐 Horas</button>
        <button class="btn btn-primary btn-sm" onclick="openEmployeeSales('${u.id}', '${fromD}', '${toD}')">🛍️ Ventas</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="view-header">
    <h2>👥 Empleados</h2>
    <p>Gestión de sueldos y comisiones</p>
    <div class="view-actions">
      <div class="search-box" style="flex:unset; width:auto; padding: 4px 10px;">
        <span style="font-size:12px; color:var(--text-3); font-weight:600;">PERÍODO:</span>
        <input type="date" id="emp-filter-from" value="${fromD}" style="width:130px; font-size:12px; padding:4px; margin-left:8px; border:none; outline:none; background:transparent; color:var(--text);" />
        <span style="color:var(--text-3)">-</span>
        <input type="date" id="emp-filter-to" value="${toD}" style="width:130px; font-size:12px; padding:4px; border:none; outline:none; background:transparent; color:var(--text);" />
      </div>
      <button class="btn btn-primary" onclick="openNuevoEmpleado()">➕ Nuevo empleado</button>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Nombre</th><th>Horas</th><th>Sueldo Base</th><th>Ventas Generadas</th><th>Comisión</th><th>Total a Pagar</th><th>Acciones</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:var(--text-3)">Sin empleados</td></tr>'}</tbody>
    </table>
  </div>`;
}

function openEmployeeSales(userId, fromD, toD) {
  const u = DB.getUsers().find(x => x.id === userId);
  if (!u) return;

  const sales = DB.getSales().filter(s => {
    if (s.returned) return false;
    if (s.userId !== u.id && s.cashier !== u.name) return false;
    const d = s.date.slice(0, 10);
    return d >= fromD && d <= toD;
  });

  if (sales.length === 0) {
    toast(`No hay ventas registradas para ${u.name} en este período.`, 'info');
    return;
  }

  const rows = sales.map(s => {
    return `
      <tr>
        <td style="font-size:12px;">${fmtDate(s.date)}</td>
        <td style="font-size:12px;">${(s.items||[]).map(i => `${i.name} x${i.qty}`).join(', ')}</td>
        <td class="text-accent" style="font-weight:700;">${fmt(s.totalFinal)}</td>
      </tr>
    `;
  }).join('');

  openModal(`🛍️ Ventas de ${u.name}`, `
    <div style="font-size:13px; color:var(--text-2); margin-bottom:12px;">
      Mostrando <strong>${sales.length}</strong> ventas del período seleccionado.
    </div>
    <div class="table-wrap" style="max-height:300px; overflow-y:auto;">
      <table>
        <thead><tr><th>Fecha y Hora</th><th>Productos</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `, '');
}

function bindEmpleados() {
  const fromEl = document.getElementById('emp-filter-from');
  const toEl = document.getElementById('emp-filter-to');
  if (fromEl) fromEl.addEventListener('change', (e) => { window._empleadosFromDate = e.target.value; renderView('view-empleados'); });
  if (toEl) toEl.addEventListener('change', (e) => { window._empleadosToDate = e.target.value; renderView('view-empleados'); });
}

function openNuevoEmpleado() {
  openModal('Nuevo Empleado', `
    <div class="form-group"><label>Nombre completo</label><input id="emp-name" type="text" placeholder="Nombre apellido"/></div>
    <div class="form-group"><label>Usuario</label><input id="emp-user" type="text" placeholder="usuario"/></div>
    <div class="form-group"><label>Contraseña</label><input id="emp-pass" type="password" placeholder="••••••"/></div>
    <div class="form-row cols-2">
      <div class="form-group"><label>Sueldo por hora ($)</label><input id="emp-salary" type="number" placeholder="0"/></div>
      <div class="form-group"><label>Horas por día</label><input id="emp-hours" type="number" placeholder="3.5"/></div>
    </div>
    <div class="form-group"><label>Comisión por ventas (%)</label><input id="emp-comm" type="number" step="0.1" placeholder="Ej: 5"/></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveNuevoEmpleado()">Guardar</button>
  `);
}

function saveNuevoEmpleado() {
  const name = el('emp-name').value.trim();
  const username = el('emp-user').value.trim();
  const password = el('emp-pass').value.trim();
  const salaryHour = parseFloat(el('emp-salary').value)||0;
  const defaultHours = parseFloat(el('emp-hours').value)||3.5;
  const commissionPct = parseFloat(el('emp-comm').value)||0;
  if (!name || !username || !password) { toast('Completa todos los campos requeridos.','error'); return; }
  const users = DB.getUsers();
  if (users.find(u=>u.username===username)) { toast('Ya existe ese usuario.','error'); return; }
  const newUser = { id: DB.id(), name, username, password, role: 'cajero', salaryHour, defaultHours, commissionPct };
  users.push(newUser); DB.saveUsersWithAudit(users, `Empleado creado: "${name}"`);
  closeModal(); toast('Empleado creado.','success');
  renderView('view-empleados');
}

function openEmpleadoEdit(id) {
  const u = DB.getUsers().find(x=>x.id===id);
  if (!u) return;
  openModal(`Editar – ${u.name}`, `
    <div class="form-group"><label>Nombre</label><input id="ee-name" type="text" value="${u.name}"/></div>
    <div class="form-group"><label>Contraseña</label><input id="ee-pass" type="password" placeholder="Dejar vacío para no cambiar"/></div>
    <div class="form-row cols-2">
      <div class="form-group"><label>Sueldo/hora ($)</label><input id="ee-salary" type="number" value="${u.salaryHour||0}"/></div>
      <div class="form-group"><label>Horas por día</label><input id="ee-hours" type="number" value="${u.defaultHours||3.5}"/></div>
    </div>
    <div class="form-group"><label>Comisión por ventas (%)</label><input id="ee-comm" type="number" step="0.1" value="${u.commissionPct||0}"/></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveEmpleadoEdit('${id}')">Guardar</button>
  `);
}

function saveEmpleadoEdit(id) {
  const users = DB.getUsers();
  const idx = users.findIndex(u=>u.id===id);
  if (idx<0) return;
  const name = el('ee-name').value.trim();
  const pass = el('ee-pass').value.trim();
  const salaryHour = parseFloat(el('ee-salary').value)||0;
  const defaultHours = parseFloat(el('ee-hours').value)||3.5;
  const commissionPct = parseFloat(el('ee-comm').value)||0;
  if (!name) { toast('El nombre es requerido.','error'); return; }
  users[idx] = { ...users[idx], name, salaryHour, defaultHours, commissionPct };
  if (pass) users[idx].password = pass;
  DB.saveUsersWithAudit(users, `Empleado editado: "${name}"`);
  closeModal(); toast('Empleado actualizado.','success');
  renderView('view-empleados');
}

function getMonthDays(year, month) {
  return new Date(year, month, 0).getDate();
}

function openHorasEmpleado(userId) {
  const u = DB.getUsers().find(x=>x.id===userId);
  if (!u) return;
  const now = new Date();
  const year = now.getFullYear(); const month = now.getMonth()+1;
  renderHorasModal(userId, year, month);
}

function renderHorasModal(userId, year, month) {
  const u = DB.getUsers().find(x=>x.id===userId);
  const monthDays = getMonthDays(year, month);
  const hoursData = DB.getHoursForMonth(userId, year, month);
  const defaultH = u.defaultHours || 3.5;
  const monthName = new Date(year,month-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
  const todayStr = today();

  let totalRecordedHours = 0;
  let daysHtml = '';
  for (let d = 1; d <= monthDays; d++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;
    const dow = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR',{weekday:'short'});
    // Only show ACTUALLY recorded hours. If no record, show '--' (unregistered)
    const hasRecord = hoursData[dateStr] !== undefined;
    const hrs = hasRecord ? hoursData[dateStr] : (isFuture ? null : null);
    if (hasRecord) totalRecordedHours += hrs;
    
    const displayHrs = hasRecord ? hrs : (isFuture ? '—' : '?');
    const hrsColor = !hasRecord && !isFuture ? 'color:var(--red); opacity:0.7;' : hasRecord && hrs === 0 ? 'color:var(--text-3);' : '';
    daysHtml += `
    <div class="day-box ${isToday?'today':''}" onclick="${isFuture?'':"editDayHours('" + userId + "','" + dateStr + "'," + (hrs||0) + "," + defaultH + ")"}"
      style="${isFuture ? 'opacity:0.4; cursor:not-allowed;' : 'cursor:pointer;'}">
      <div class="day-name">${dow} ${d}</div>
      <div class="day-hours" style="${hrsColor}">${displayHrs}${hasRecord ? 'h' : ''}</div>
    </div>`;
  }

  const salary = totalRecordedHours * (u.salaryHour || 0);

  const prevMonth = month===1 ? [year-1,12] : [year,month-1];
  const nextMonth = month===12? [year+1,1]  : [year,month+1];

  openModal(`🕐 Horas – ${u.name}`, `
    <div class="flex-row mb-2">
      <button class="btn btn-ghost btn-sm" onclick="renderHorasModal('${userId}',${prevMonth[0]},${prevMonth[1]})">◀</button>
      <span style="flex:1;text-align:center;font-weight:700">${monthName}</span>
      <button class="btn btn-ghost btn-sm" onclick="renderHorasModal('${userId}',${nextMonth[0]},${nextMonth[1]})">▶</button>
    </div>
    <div style="font-size:11px; color:var(--text-3); margin-bottom:8px; display:flex; gap:14px;">
      <span style="color:var(--text-1);">Horas registradas</span>
      <span>— = futuro</span>
      <span style="color:var(--red);">? = sin registrar</span>
    </div>
    <div class="hours-grid">${daysHtml}</div>
    <div class="divider"></div>
    <div class="flex-row">
      <div><span class="text-muted">Total hs. registradas:</span> <strong>${totalRecordedHours}h</strong></div>
      <div class="ml-auto"><span class="text-muted">Sueldo estimado:</span> <strong class="text-green">${fmt(salary)}</strong></div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`);
}

function editDayHours(userId, dateStr, currentHours, defaultHours) {
  const day = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  openModal(`Editar horas – ${day}`, `
    <p class="text-muted mb-2">Ingresá cuántas horas trabajó este día:</p>
    <div class="form-group">
      <label>Horas trabajadas</label>
      <input id="day-hours-input" type="number" min="0" max="24" step="0.5" value="${currentHours}" style="font-size:24px;font-weight:700;text-align:center"/>
    </div>
    <div class="flex-row" style="gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="el('day-hours-input').value=0">0 hs</button>
      <button class="btn btn-ghost btn-sm" onclick="el('day-hours-input').value=${defaultHours}">${defaultHours} hs (def.)</button>
      <button class="btn btn-ghost btn-sm" onclick="el('day-hours-input').value=4">4 hs</button>
      <button class="btn btn-ghost btn-sm" onclick="el('day-hours-input').value=6">6 hs</button>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="reopenHorasModal('${userId}','${dateStr}')">← Volver</button>
    <button class="btn btn-primary" onclick="saveDayHours('${userId}','${dateStr}')">Guardar</button>
  `);
}

function saveDayHours(userId, dateStr) {
  const h = parseFloat(el('day-hours-input').value);
  if (isNaN(h) || h < 0) { toast('Valor inválido','error'); return; }
  DB.setHoursForDay(userId, dateStr, h);
  toast('Horas guardadas.','success');
  const d = new Date(dateStr);
  reopenHorasModal(userId, dateStr, d.getFullYear(), d.getMonth()+1);
}

function reopenHorasModal(userId, dateStr, year, month) {
  if (!year) { const d = new Date(dateStr); year = d.getFullYear(); month = d.getMonth()+1; }
  renderHorasModal(userId, year, month);
}

// ══════════════════════════════════════════════════════════
//  CATEGORÍAS
// ══════════════════════════════════════════════════════════
function buildCategorias() {
  const cats = DB.getCategories();
  const prods = DB.getProducts();
  const rows = cats.map(c => {
    const count = prods.filter(p=>p.categoryId===c.id).length;
    return `<tr>
      <td><span class="badge badge-purple">🏷️</span> ${c.name}</td>
      <td>${count} prenda(s)</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openEditCat('${c.id}','${c.name.replace(/'/g,"\\'")}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCat('${c.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
  return `
  <div class="view-header">
    <h2>🏷️ Categorías</h2>
    <p>Organizá tus prendas por categoría</p>
    <div class="view-actions">
      <button class="btn btn-primary" onclick="openNewCat()">➕ Nueva categoría</button>
    </div>
  </div>
  <div class="table-wrap">
    <table><thead><tr><th>Nombre</th><th>Prendas</th><th>Acciones</th></tr></thead>
    <tbody>${rows||'<tr><td colspan="3" style="text-align:center;color:var(--text-3)">Sin categorías</td></tr>'}</tbody>
    </table>
  </div>`;
}
function bindCategorias() {}

function openNewCat() {
  openModal('Nueva Categoría', `
    <div class="form-group"><label>Nombre</label><input id="cat-name" type="text" placeholder="Ej: Remeras"/></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveNewCat()">Guardar</button>
  `);
}
function saveNewCat() {
  const name = el('cat-name').value.trim();
  if (!name) { toast('Ingresá un nombre','error'); return; }
  DB.addCategory(name);
  closeModal(); toast('Categoría creada.','success');
  renderView('view-categorias');
}
function openEditCat(id, name) {
  openModal('Editar Categoría', `
    <div class="form-group"><label>Nombre</label><input id="cat-edit-name" type="text" value="${name}"/></div>
  `, `
    <button class="btn btn-danger" style="margin-right: auto;" onclick="deleteCat('${id}'); closeModal();">🗑️ Eliminar</button>
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveEditCat('${id}')">Guardar</button>
  `);
}
function saveEditCat(id) {
  const name = el('cat-edit-name').value.trim();
  if (!name) { toast('Ingresá un nombre','error'); return; }
  DB.updateCategory(id, name);
  closeModal(); toast('Categoría actualizada.','success');
  renderView('view-categorias');
}
function deleteCat(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  DB.deleteCategory(id);
  toast('Categoría eliminada.','success');
  if (el('view-categorias') && el('view-categorias').classList.contains('active')) {
    renderView('view-categorias');
  } else {
    renderView('view-venta');
  }
}

// ══════════════════════════════════════════════════════════
//  STOCK / PRENDAS
// ══════════════════════════════════════════════════════════
function getVariants(p) {
  return (p.variants && p.variants.length) ? p.variants : [{ label: 'Único', price: p.price, stock: p.stock }];
}
function getTotalStock(p) {
  const v = getVariants(p);
  return v.reduce((s,x) => s + (x.stock||0), 0);
}
function getPriceRange(p) {
  const v = getVariants(p);
  const prices = v.map(x => x.price).filter(x => x > 0);
  if (!prices.length) return fmt(p.price || 0);
  const mn = Math.min(...prices), mx = Math.max(...prices);
  return mn === mx ? fmt(mn) : `${fmt(mn)} – ${fmt(mx)}`;
}

function buildStock() {
  const prods = DB.getProducts();
  const cats = DB.getCategories();
  const catMap = Object.fromEntries(cats.map(c=>[c.id,c.name]));

  const filterBar = `
    <div class="cat-filters" id="stock-cat-filters">
      <div class="cat-filter active" data-cat="all">Todas</div>
      ${cats.map(c=>`<div class="cat-filter" data-cat="${c.id}">${c.name}</div>`).join('')}
    </div>`;

  const rows = prods.map(p => {
    const vars = getVariants(p);
    const totalStock = getTotalStock(p);
    const hasMulti = p.variants && p.variants.length > 1;
    const variantRows = hasMulti ? vars.map(v => `
      <div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed var(--border);font-size:12px;">
        <span style="color:var(--text-2);">${v.label}</span>
        <span style="font-weight:600;">${fmt(v.price)}</span>
        <span class="badge ${v.stock<=2?'badge-red':v.stock<=5?'badge-yellow':'badge-green'}" style="font-size:11px;">${v.stock}</span>
      </div>
    `).join('') : '';
    return `
    <tr data-cat="${p.categoryId}">
      <td><strong>${p.name}</strong>${p.talle ? `<br><small style="color:var(--text-3)">Talle: ${p.talle}</small>` : ''}</td>
      <td>${catMap[p.categoryId]||'-'}</td>
      <td>${hasMulti ? `<div style="min-width:160px;">${variantRows}</div>` : fmt(vars[0].price)}</td>
      <td><span class="badge ${totalStock<=2?'badge-red':totalStock<=5?'badge-yellow':'badge-green'}">${hasMulti ? totalStock + ' total' : totalStock}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openEditProduct('${p.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="view-header">
    <h2>👗 Stock</h2>
    <p>Administrá tus prendas disponibles</p>
    <div class="view-actions">
      <button class="btn btn-primary" onclick="openNewProduct()">➕ Nueva prenda</button>
    </div>
  </div>
  ${filterBar}
  <div class="table-wrap">
    <table>
      <thead><tr><th>Prenda</th><th>Categoría</th><th>Precio / Variantes</th><th>Stock</th><th>Acciones</th></tr></thead>
      <tbody id="stock-tbody">${rows||'<tr><td colspan="5" style="text-align:center;color:var(--text-3)">Sin prendas</td></tr>'}</tbody>
    </table>
  </div>`;
}

function bindStock() {
  document.querySelectorAll('#stock-cat-filters .cat-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stock-cat-filters .cat-filter').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      document.querySelectorAll('#stock-tbody tr[data-cat]').forEach(row => {
        row.style.display = (cat==='all' || row.dataset.cat===cat) ? '' : 'none';
      });
    });
  });
}

function variantRowHtml(idx, label, price, stock) {
  return `
  <div class="variant-row" data-idx="${idx}">
    <div class="form-group">
      <label style="font-size:11px;">Etiqueta</label>
      <input class="vr-label" type="text" value="${label}" placeholder="Ej: Mayorista, Minorista" style="font-size:13px;"/>
    </div>
    <div class="form-group">
      <label style="font-size:11px;">Precio ($)</label>
      <input class="vr-price" type="number" value="${price}" min="0" style="font-size:13px;"/>
    </div>
    <div class="form-group">
      <label style="font-size:11px;">Stock</label>
      <input class="vr-stock" type="number" value="${stock}" min="0" style="font-size:13px;"/>
    </div>
    <button class="btn btn-danger btn-sm btn-icon btn-remove-vr" onclick="this.closest('.variant-row').remove()" title="Quitar">✕</button>
  </div>`;
}

function addVariantRow(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const idx = c.querySelectorAll('.variant-row').length;
  c.insertAdjacentHTML('beforeend', variantRowHtml(idx, '', 0, 0));
}

function collectVariants(containerId) {
  const rows = document.querySelectorAll(`#${containerId} .variant-row`);
  const variants = [];
  rows.forEach(row => {
    const label = row.querySelector('.vr-label').value.trim() || `Precio ${variants.length+1}`;
    const price = parseFloat(row.querySelector('.vr-price').value) || 0;
    const stock = parseInt(row.querySelector('.vr-stock').value) || 0;
    variants.push({ label, price, stock });
  });
  return variants;
}

function openNewProduct(prefillCatId) {
  const cats = sortByName(DB.getCategories());
  const catOpts = cats.map(c=>`<option value="${c.id}" ${c.id===prefillCatId?'selected':''}>${c.name}</option>`).join('');
  openModal('Nueva Prenda', `
    <div class="form-group"><label>Nombre</label><input id="np-name" type="text" placeholder="Ej: Remera Básica"/></div>
    <div class="form-row cols-2">
      <div class="form-group"><label>Categoría</label>
        <select id="np-cat">
          <option value="">Seleccionar...</option>
          ${catOpts}
          <option value="__new__">+ Crear nueva categoría</option>
        </select>
      </div>
      <div class="form-group"><label>Talle (opcional)</label><input id="np-talle" type="text" placeholder="S / M / L / 38 …"/></div>
    </div>

    <div style="border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-top:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-weight:700;font-size:14px;">💰 Precios y Stock</span>
        <button class="btn btn-ghost btn-sm" type="button" onclick="addVariantRow('np-variants')">➕ Agregar precio</button>
      </div>
      <div id="np-variants">
        ${variantRowHtml(0, 'Precio único', 0, 0)}
      </div>
      <p style="font-size:11px;color:var(--text-3);margin-top:6px;">Podés agregar varios precios (ej: Mayorista, Minorista) con stock independiente para cada uno.</p>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveNewProduct()">Guardar</button>
  `);

  if (prefillCatId) {
    const cat = cats.find(c => c.id === prefillCatId);
    if (cat) setTimeout(() => { const n = el('np-name'); if (n && !n.value) n.value = cat.name; }, 50);
  }

  makeSearchableSelect('np-cat', (value, label) => {
    const nameInput = el('np-name');
    if (value && value !== '__new__' && nameInput && !nameInput.value.trim()) {
      nameInput.value = label;
    }
    if (value === '__new__') {
      const name = prompt('Nombre de la nueva categoría:');
      if (name && name.trim()) {
        const cat = DB.addCategory(name.trim());
        const selEl = el('np-cat');
        if (selEl) {
          selEl.innerHTML += `<option value="${cat.id}" selected>${cat.name}</option>`;
          selEl.value = cat.id;
        }
        toast('Categoría creada.','success');
      }
    }
  });
}

function saveNewProduct() {
  const name = el('np-name').value.trim();
  const categoryId = el('np-cat').value;
  const talle = el('np-talle').value.trim();
  const variants = collectVariants('np-variants');
  if (!name || !categoryId) { toast('Nombre y categoría son requeridos.','error'); return; }
  if (!variants.length) { toast('Agregá al menos un precio.','error'); return; }
  const price = variants[0].price;
  const stock = variants.reduce((s,v) => s + v.stock, 0);
  DB.addProduct({ name, categoryId, talle, price, stock, variants: variants.length > 1 ? variants : [] });
  closeModal(); toast('Prenda agregada.','success');
  renderView('view-stock');
}

function openEditProduct(id) {
  const p = DB.getProducts().find(x=>x.id===id);
  if (!p) return;
  const cats = sortByName(DB.getCategories());
  const catOpts = cats.map(c=>`<option value="${c.id}" ${c.id===p.categoryId?'selected':''}>${c.name}</option>`).join('');
  const vars = getVariants(p);
  const variantRowsHtml = vars.map((v, i) => variantRowHtml(i, v.label, v.price, v.stock)).join('');
  openModal('Editar Prenda', `
    <div class="form-group"><label>Nombre</label><input id="ep-name" type="text" value="${p.name}"/></div>
    <div class="form-row cols-2">
      <div class="form-group"><label>Categoría</label>
        <select id="ep-cat">${catOpts}</select>
      </div>
      <div class="form-group"><label>Talle</label><input id="ep-talle" type="text" value="${p.talle||''}"/></div>
    </div>
    <div style="border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-top:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-weight:700;font-size:14px;">💰 Precios y Stock</span>
        <button class="btn btn-ghost btn-sm" type="button" onclick="addVariantRow('ep-variants')">➕ Agregar precio</button>
      </div>
      <div id="ep-variants">
        ${variantRowsHtml}
      </div>
    </div>
  `, `
    <button class="btn btn-danger" style="margin-right: auto;" onclick="deleteProduct('${id}'); closeModal();">🗑️ Eliminar</button>
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveEditProduct('${id}')">Guardar</button>
  `);
  makeSearchableSelect('ep-cat');
}
function saveEditProduct(id) {
  const name = el('ep-name').value.trim();
  const categoryId = el('ep-cat').value;
  const talle = el('ep-talle').value.trim();
  const variants = collectVariants('ep-variants');
  if (!name) { toast('El nombre es requerido.','error'); return; }
  if (!variants.length) { toast('Agregá al menos un precio.','error'); return; }
  const price = variants[0].price;
  const stock = variants.reduce((s,v) => s + v.stock, 0);
  DB.updateProduct(id, { name, categoryId, talle, price, stock, variants: variants.length > 1 ? variants : [] });
  closeModal(); toast('Prenda actualizada.','success');
  renderView('view-stock');
}
function deleteProduct(id) {
  if (!confirm('¿Eliminar esta prenda?')) return;
  DB.deleteProduct(id);
  toast('Prenda eliminada.','success');
  if (el('view-stock') && el('view-stock').classList.contains('active')) {
    renderView('view-stock');
  } else {
    renderView('view-venta');
  }
}

// ══════════════════════════════════════════════════════════
//  VENTA
// ══════════════════════════════════════════════════════════
function buildVenta() {
  const cats = DB.getCategories();
  const prods = DB.getProducts();

  const catFilters = `
    <div class="cat-filters" id="v-cat-filters">
      <div class="cat-filter active" data-cat="all">Todas</div>
      ${cats.map(c=>`
        <div class="cat-filter" data-cat="${c.id}" style="display: inline-flex; align-items: center; gap: 6px;">
          <span>${c.name}</span>
          <span class="delete-cat-pill" onclick="event.stopPropagation(); deleteCatFromVenta('${c.id}', '${c.name.replace(/'/g, "\\'")}')" style="font-weight: 800; opacity: 0.5; cursor: pointer; padding: 2px; font-size: 11px; margin-left: 2px; transition: color 0.2s;" title="Eliminar categoría">×</span>
        </div>
      `).join('')}
    </div>`;

  const productCards = prods.map(p => {
    const cat = cats.find(c=>c.id===p.categoryId);
    const hasMulti = p.variants && p.variants.length > 1;
    const totalStock = getTotalStock(p);
    const priceDisplay = hasMulti ? getPriceRange(p) : fmt(getVariants(p)[0].price);
    return `
    <div class="product-card" data-id="${p.id}" data-cat="${p.categoryId}" onclick="addToCart('${p.id}')">
      <button class="btn btn-ghost btn-sm btn-icon" onclick="event.stopPropagation(); openEditProductFromVenta('${p.id}')" style="position: absolute; top: 8px; right: 8px; font-size: 11px; z-index: 10; opacity: 0.7;" title="Editar Prenda">✏️</button>
      <div class="product-cat">${cat?.name||'Sin categoría'}</div>
      <div class="product-name" style="padding-right: 20px;">${p.name}</div>
      ${p.talle ? `<div class="product-talle">Talle: ${p.talle}</div>` : ''}
      <div class="product-price">${priceDisplay}</div>
      <div class="product-stock">Stock: ${totalStock}${hasMulti ? ` <span style="font-size:10px;color:var(--accent);">(${p.variants.length} precios)</span>` : ''}</div>
    </div>`;
  }).join('');

  return `
  <div class="view-header">
    <h2>🛒 Nueva Venta</h2>
    <p>Seleccioná las prendas para agregar al carrito</p>
  </div>
  <div class="sale-layout">
    <div class="sale-products">
      <div class="flex-row mb-2">
        <div class="search-box" style="flex:1">
          <span class="search-icon">🔍</span>
          <input type="text" id="v-search" placeholder="Buscar prenda..." oninput="filterVentaProducts()"/>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="openNewProductFromVenta()">➕ Prenda</button>
        <button class="btn btn-ghost btn-sm" onclick="openNewCatFromVenta()">🏷️ Categoría</button>
      </div>
      ${catFilters}
      <div class="product-grid" id="v-product-grid">
        ${productCards || '<div class="empty-state"><div class="empty-icon">👗</div><p>No hay prendas cargadas aún.</p></div>'}
      </div>
    </div>

    <div class="sale-cart">
      <div class="cart-box">
        <div class="cart-header">🛒 Carrito <span id="cart-count" class="badge badge-purple" style="margin-left:8px">0</span></div>
        <div class="cart-items" id="cart-items-list">
          <div class="empty-state" style="padding:24px"><div class="empty-icon">🛍️</div><p>Agregá productos</p></div>
        </div>
        <div class="cart-footer">
          <div class="form-group">
            <label>Descuento (%)</label>
            <input type="number" id="cart-discount" min="0" max="100" value="0" oninput="updateCartTotals()"/>
          </div>
          <div class="cart-total-row"><span>Subtotal</span><span id="ct-sub">$0</span></div>
          <div class="cart-total-row"><span>Descuento</span><span id="ct-disc" class="text-green">-$0</span></div>
          <div class="cart-total-row big"><span>TOTAL</span><span id="ct-total" class="text-accent">$0</span></div>
          <div style="margin-top:14px">
            <!-- Split Pay Details - Always Visible by Default -->
            <div id="multi-pay-details" class="split-pay-grid">
              <div class="split-pay-item">
                <label>💵 Efectivo ($)</label>
                <input type="number" id="v-split-cash" value="0" min="0" oninput="validateSplitAmounts()"/>
              </div>
              <div class="split-pay-item">
                <label>💳 Tarjeta ($)</label>
                <input type="number" id="v-split-card" value="0" min="0" oninput="validateSplitAmounts()"/>
              </div>
              <div class="split-pay-item" style="grid-column: span 2;">
                <label>📋 Deudor ($)</label>
                <input type="number" id="v-split-debt" value="0" min="0" oninput="validateSplitAmounts()"/>
              </div>
            </div>

            <div class="form-group" style="margin-top: 10px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-2); margin-bottom: 0;">
                <input type="checkbox" id="v-card-surcharge-apply" onchange="validateSplitAmounts()"/>
                <span>💳 Aplicar recargo a Tarjeta</span>
              </label>
              <div style="display: flex; align-items: center; gap: 4px;">
                <input type="number" id="v-card-surcharge-pct" value="10" min="0" max="100" style="width: 55px; padding: 2px 6px; font-size: 12px; height: 26px; text-align: center; border-radius: var(--r-sm); border: 1px solid var(--border); background: var(--bg2); color: var(--text-1);" oninput="validateSplitAmounts()"/>
                <span style="font-size: 12px; color: var(--text-2);">%</span>
              </div>
            </div>

            <div id="debtor-selector" style="margin-top: 6px;">
              <div class="form-group" style="margin-bottom: 8px;">
                <label>Seleccionar Deudor (si carga en deudor)</label>
                <select id="v-debtor-select">
                  <option value="">Elegir deudor...</option>
                  ${sortByName(DB.getDebtors()).map(d=>`<option value="${d.id}">${d.name} (+${d.surcharge}%)</option>`).join('')}
                  <option value="__new__">+ Crear nuevo deudor</option>
                </select>
              </div>
              <div id="v-debtor-surcharge-container" style="display: none; margin-bottom: 8px; align-items: center; gap: 8px; flex-direction: row;">
                <label style="margin-bottom: 0; font-size: 12px; color: var(--text-2);">Recargo Deudor:</label>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <input type="number" id="v-debtor-surcharge-pct" value="0" min="0" max="100" style="width: 55px; padding: 2px 6px; font-size: 12px; height: 26px; text-align: center; border-radius: var(--r-sm); border: 1px solid var(--border); background: var(--bg2); color: var(--text-1);" oninput="validateSplitAmounts()"/>
                  <span style="font-size: 12px; color: var(--text-2);">%</span>
                </div>
              </div>
            </div>

            <!-- Caja Pago Efectivo Directo y Vuelto - Auto calculable -->
            <div id="cash-received-container" style="margin-top: 10px; background: var(--bg3); padding: 12px; border-radius: var(--r-sm); border: 1px solid var(--border);">
              <div class="cart-total-row" style="font-size: 13px; font-weight:700;">
                <span>Total a Cobrar:</span>
                <span id="v-split-total-target" class="text-accent">$0</span>
              </div>
              <div class="cart-total-row" style="font-size: 13px; font-weight:700; margin-top: 4px;">
                <span>Total Ingresado:</span>
                <span id="v-split-total-entered" class="text-muted">$0</span>
              </div>
              <div class="cart-total-row text-green" style="font-size: 14px; font-weight:800; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border);">
                <span>Vuelto a entregar:</span>
                <span id="v-cash-change">$0</span>
              </div>
            </div>

            <button class="btn btn-primary btn-full" id="btn-confirm-sale" onclick="confirmSale()" style="margin-top:12px">
              ✅ Confirmar Venta
            </button>
            <button class="btn btn-ghost btn-full" onclick="clearCart()" style="margin-top:6px">🗑️ Limpiar carrito</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function bindVenta() {
  // Category filters
  document.querySelectorAll('#v-cat-filters .cat-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#v-cat-filters .cat-filter').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      filterVentaProducts();
    });
  });
  // Debtor select change
  const dsel = el('v-debtor-select');
  if (dsel) {
    dsel.addEventListener('change', function() {
      const surchargeContainer = el('v-debtor-surcharge-container');
      const surchargeInput = el('v-debtor-surcharge-pct');
      
      if (this.value === '__new__') {
        openNewDebtorFromVenta(dsel);
        if (surchargeContainer) surchargeContainer.style.display = 'none';
      } else if (this.value) {
        saleDebtorId = this.value;
        const debtor = DB.getDebtors().find(d => d.id === this.value);
        if (debtor) {
          if (surchargeInput) surchargeInput.value = debtor.surcharge;
          if (surchargeContainer) surchargeContainer.style.display = 'flex';
        }
      } else {
        saleDebtorId = null;
        if (surchargeContainer) surchargeContainer.style.display = 'none';
      }
      validateSplitAmounts();
    });
  }
  salePayType = 'efectivo';
  saleDebtorId = null;
  renderCartItems();
  makeSearchableSelect('v-debtor-select');
}

function deleteCatFromVenta(id, name) {
  if (!confirm(`¿Estás seguro de que querés eliminar la categoría "${name}"? Las prendas de esta categoría no se eliminarán.`)) return;
  DB.deleteCategory(id);
  toast(`Categoría "${name}" eliminada.`, 'success');
  renderView('view-venta');
}

function filterVentaProducts() {
  const searchTerm = (el('v-search')?.value||'').toLowerCase();
  const activeCat = document.querySelector('#v-cat-filters .cat-filter.active')?.dataset.cat || 'all';
  document.querySelectorAll('#v-product-grid .product-card').forEach(card => {
    const matchCat = activeCat==='all' || card.dataset.cat===activeCat;
    const matchSearch = !searchTerm || card.querySelector('.product-name').textContent.toLowerCase().includes(searchTerm);
    card.style.display = (matchCat && matchSearch) ? '' : 'none';
  });
}

function addToCart(productId, variantIdx) {
  const p = DB.getProducts().find(x=>x.id===productId);
  if (!p) return;
  const hasMulti = p.variants && p.variants.length > 1;

  // If product has multiple variants and no variant was selected, show picker
  if (hasMulti && variantIdx === undefined) {
    openVariantPicker(p);
    return;
  }

  // Determine price and stock based on variant
  let selectedPrice, maxStock, variantLabel;
  if (hasMulti && variantIdx !== undefined) {
    const v = p.variants[variantIdx];
    selectedPrice = v.price;
    maxStock = v.stock;
    variantLabel = v.label;
  } else {
    const v = getVariants(p);
    selectedPrice = v[0].price;
    maxStock = v[0].stock;
    variantLabel = null;
  }

  if (maxStock <= 0) { toast('Sin stock disponible.','error'); return; }

  // Cart key includes variant to keep them separate
  const cartKey = hasMulti ? `${productId}__v${variantIdx}` : productId;
  const existing = cart.find(c => c.cartKey === cartKey);
  if (existing) {
    if (existing.qty >= maxStock) { toast('Stock máximo alcanzado.','error'); return; }
    existing.qty++;
  } else {
    cart.push({ productId, cartKey, qty: 1, customPrice: selectedPrice, variantIdx: hasMulti ? variantIdx : undefined, variantLabel });
  }
  renderCartItems();
  const card = document.querySelector(`.product-card[data-id="${productId}"]`);
  if (card) { card.classList.add('selected'); setTimeout(()=>card.classList.remove('selected'),600); }
  toast(`${p.name}${variantLabel ? ' ('+variantLabel+')' : ''} agregado al carrito.`, 'success');
}

function openVariantPicker(p) {
  // Sort variants by price descending (mayor a menor) but keep original indices for addToCart
  const sorted = p.variants.map((v, i) => ({ ...v, origIdx: i })).sort((a, b) => b.price - a.price);
  const btns = sorted.map(v => `
    <button class="btn btn-secondary" style="display:flex;justify-content:space-between;width:100%;padding:12px 16px;margin-bottom:6px;" onclick="closeModal(); addToCart('${p.id}', ${v.origIdx})">
      <span style="font-weight:700;">${v.label}</span>
      <span style="display:flex;gap:12px;align-items:center;">
        <span style="font-weight:800;color:var(--accent);">${fmt(v.price)}</span>
        <span class="badge ${v.stock<=2?'badge-red':v.stock<=5?'badge-yellow':'badge-green'}" style="font-size:11px;">Stock: ${v.stock}</span>
      </span>
    </button>
  `).join('');
  openModal(`💰 ${p.name} – Elegí el precio`, `
    <p class="text-muted" style="font-size:13px;margin-bottom:12px;">Este producto tiene varios precios. Seleccioná cuál agregar al carrito:</p>
    ${btns}
  `, '');
}

function removeFromCart(cartKey) {
  cart = cart.filter(c => (c.cartKey || c.productId) !== cartKey);
  renderCartItems();
}

function clearCart() {
  cart = [];
  renderCartItems();
}

function renderCartItems() {
  const list = el('cart-items-list');
  const count = el('cart-count');
  if (!list) return;
  if (cart.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-icon">🛍️</div><p>Agregá productos</p></div>';
    if (count) count.textContent = '0';
    updateCartTotals();
    return;
  }
  const prods = DB.getProducts();
  list.innerHTML = cart.map(c => {
    const p = prods.find(x=>x.id===c.productId);
    if (!p) return '';
    const ck = c.cartKey || c.productId;
    const maxStock = (c.variantIdx !== undefined && p.variants && p.variants[c.variantIdx]) ? p.variants[c.variantIdx].stock : (p.stock || 99);
    return `
    <div class="cart-item">
      <div style="flex:1">
        <div class="cart-item-name">${p.name}</div>
        <div style="font-size:11px;color:var(--text-3)">${c.variantLabel ? `<span class="badge badge-purple" style="font-size:10px;">${c.variantLabel}</span> ` : ''}${p.talle||''}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="changeQty('${ck}',-1)">−</button>
          <span style="font-size:13px;font-weight:600;min-width:20px;text-align:center">${c.qty}</span>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="changeQty('${ck}',1)">+</button>
        </div>
      </div>
      <div style="text-align:right">
        <div class="cart-item-price" style="display:flex;align-items:center;gap:4px;justify-content:flex-end;margin-bottom:2px;">
          $ <input type="number" class="input-sm" style="width:70px;text-align:right;padding:2px 4px;font-size:13px;" value="${c.customPrice !== undefined ? c.customPrice : p.price}" onchange="updateCartItemPrice('${ck}', this.value)">
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">Sub: ${fmt((c.customPrice !== undefined ? c.customPrice : p.price)*c.qty)}</div>
        <button class="cart-item-remove" onclick="removeFromCart('${ck}')">×</button>
      </div>
    </div>`;
  }).join('');
  if (count) count.textContent = cart.reduce((a,c)=>a+c.qty,0);
  updateCartTotals();
}

function changeQty(cartKey, delta) {
  const item = cart.find(c => (c.cartKey || c.productId) === cartKey);
  if (!item) return;
  const p = DB.getProducts().find(x => x.id === item.productId);
  const maxStock = (item.variantIdx !== undefined && p?.variants && p.variants[item.variantIdx]) ? p.variants[item.variantIdx].stock : (p?.stock || 99);
  item.qty = Math.max(1, Math.min(item.qty + delta, maxStock));
  renderCartItems();
}

function updateCartItemPrice(cartKey, newPrice) {
  const item = cart.find(c => (c.cartKey || c.productId) === cartKey);
  if (!item) return;
  const parsed = parseFloat(newPrice);
  if (!isNaN(parsed) && parsed >= 0) {
    item.customPrice = parsed;
  }
  renderCartItems();
}

// updateCartTotals is defined below with full split-pay support

function selectPay(type) {
  // Obsolete - Split/Multi pay is now the standard default view
}

function calculateDirectChange() {
  // Replaced by inline calculations in validateSplitAmounts
}

function toggleMultiPay(enabled) {
  // Obsolete - Split/Multi pay is now permanent
}

// NOTE: duplicate updateCartTotals removed — the one above (line ~1661) is canonical.
// This block now just delegates to add split-pay logic.
(function patchUpdateCartTotals() {
  // Wrap the existing updateCartTotals to also handle split-pay UI
})();
function updateCartTotals() {
  const prods = DB.getProducts();
  const sub = cart.reduce((a,c) => {
    const p = prods.find(x=>x.id===c.productId);
    const price = c.customPrice !== undefined ? c.customPrice : (p?p.price:0);
    return a+(price*c.qty);
  }, 0);
  const disc = parseFloat(el('cart-discount')?.value||0);
  const discAmt = sub * (disc/100);
  const total = sub - discAmt;
  
  if (el('ct-sub'))  el('ct-sub').textContent = fmt(sub);
  if (el('ct-disc')) el('ct-disc').textContent = `-${fmt(discAmt)}`;
  if (el('ct-total')) el('ct-total').textContent = fmt(total);
  if (el('v-split-total-target')) el('v-split-total-target').textContent = fmt(total);
  
  // Set default cash input if empty
  const cashInput = el('v-split-cash');
  if (cashInput && (cashInput.value === "" || parseFloat(cashInput.value) === 0)) {
    cashInput.value = total;
  }
  
  validateSplitAmounts();
}

function validateSplitAmounts() {
  const prods = DB.getProducts();
  const sub = cart.reduce((a,c)=>{ 
    const p=prods.find(x=>x.id===c.productId); 
    const price = c.customPrice !== undefined ? c.customPrice : (p?p.price:0);
    return a+(price*c.qty); 
  },0);
  const disc = parseFloat(el('cart-discount')?.value||0);
  let baseTarget = sub - (sub * (disc/100));

  const cash = parseFloat(el('v-split-cash')?.value)||0;
  const card = parseFloat(el('v-split-card')?.value)||0;
  const debt = parseFloat(el('v-split-debt')?.value)||0;

  // Optional card surcharge
  const applyCardSurcharge = el('v-card-surcharge-apply')?.checked;
  const cardSurchargePct = parseFloat(el('v-card-surcharge-pct')?.value)||0;
  const cardSurchargeRate = applyCardSurcharge ? (cardSurchargePct / 100) : 0;
  const cardSurchargeAmt = card * cardSurchargeRate;

  // The base transaction needs to cover the original amount before surcharges
  // Enter total as the direct sum
  const currentSum = cash + card + debt;
  
  if (el('v-split-total-entered')) el('v-split-total-entered').textContent = fmt(currentSum);
  if (el('v-split-total-target')) el('v-split-total-target').textContent = fmt(baseTarget);

  // Vuelto calculation
  let change = 0;
  if (currentSum > baseTarget) {
    const leftToPayWithCash = baseTarget - (card + debt);
    if (leftToPayWithCash >= 0) {
      change = cash - leftToPayWithCash;
    } else {
      change = cash;
    }
  }
  
  if (el('v-cash-change')) el('v-cash-change').textContent = fmt(change);

  // Validation
  const excessWithoutCash = (card + debt) - baseTarget;
  const isUnbalanced = currentSum < baseTarget || excessWithoutCash > 0.01;
  
  const btn = el('btn-confirm-sale');
  if (btn) {
    if (isUnbalanced) {
      el('ct-total').style.color = 'var(--red)';
      btn.disabled = true;
      if (excessWithoutCash > 0.01) {
        btn.textContent = `Error: Tarjeta + Deudor exceden total`;
      } else {
        btn.textContent = `Falta dinero (${fmt(baseTarget - currentSum)})`;
      }
    } else {
      el('ct-total').style.color = 'var(--accent)';
      btn.disabled = false;
      btn.textContent = '✅ Confirmar Venta';
    }
  }
}

function openNewDebtorFromVenta(selectEl) {
  openModal('Nuevo Deudor', `
    <div class="form-group"><label>Nombre</label><input id="nd-name" type="text" placeholder="Nombre completo"/></div>
    <div class="form-group"><label>Teléfono (opcional)</label><input id="nd-phone" type="text" placeholder="11-1234-5678"/></div>
    <div class="form-group"><label>Recargo (%)</label><input id="nd-sur" type="number" value="0" min="0"/></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveDebtorFromVenta()">Crear y seleccionar</button>
  `);
  window._ventaDebtorSelect = selectEl;
}

function saveDebtorFromVenta() {
  const name = el('nd-name').value.trim();
  const phone = el('nd-phone').value.trim();
  const surcharge = parseFloat(el('nd-sur').value)||0;
  if (!name) { toast('El nombre es requerido.','error'); return; }
  const d = DB.addDebtor({ name, phone, surcharge });
  // Add to select
  const sel = window._ventaDebtorSelect || el('v-debtor-select');
  if (sel) {
    const opt = document.createElement('option');
    opt.value = d.id; opt.textContent = `${d.name} (+${d.surcharge}%)`;
    sel.insertBefore(opt, sel.lastElementChild);
    sel.value = d.id;
    saleDebtorId = d.id;
  }
  closeModal(); toast('Deudor creado y seleccionado.','success');
}

function openNewProductFromVenta() {
  const cats = sortByName(DB.getCategories());
  const catOpts = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  openModal('➕ Crear producto rápido', `
    <p class="text-muted" style="font-size:13px; margin-bottom:14px;">Creá el producto y se agregará automáticamente al carrito.</p>
    <div class="form-row cols-2">
      <div class="form-group">
        <label>Categoría</label>
        <select id="qp-cat">
          <option value="">Seleccionar...</option>
          ${catOpts}
          <option value="__new__">+ Nueva categoría</option>
        </select>
      </div>
      <div class="form-group">
        <label>Precio ($)</label>
        <input id="qp-price" type="number" placeholder="0" min="0"/>
      </div>
    </div>
    <div class="form-group">
      <label>Nombre del producto</label>
      <input id="qp-name" type="text" placeholder="Se autocompleta con la categoría"/>
    </div>
    <div id="qp-newcat-container" style="display:none;" class="form-group">
      <label>Nombre de nueva categoría</label>
      <input id="qp-newcat-name" type="text" placeholder="Ej: Pantalones"/>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveQuickProductFromVenta()">✅ Crear y agregar al carrito</button>
  `);

  makeSearchableSelect('qp-cat', (value, label) => {
    const nameInput = el('qp-name');
    const newCatContainer = el('qp-newcat-container');
    if (value === '__new__') {
      if (newCatContainer) newCatContainer.style.display = 'block';
      const newNameInput = el('qp-newcat-name');
      if (newNameInput) newNameInput.focus();
    } else {
      if (newCatContainer) newCatContainer.style.display = 'none';
      // Auto-fill name with category name if name is empty or was previously auto-set
      if (nameInput && (!nameInput.value.trim() || nameInput.dataset.autofilled === '1')) {
        nameInput.value = label;
        nameInput.dataset.autofilled = '1';
      }
    }
  });

  // Clear autofilled flag if user types manually
  setTimeout(() => {
    const n = el('qp-name');
    if (n) n.addEventListener('input', () => { n.dataset.autofilled = '0'; });
  }, 50);
}

function saveQuickProductFromVenta() {
  const name = el('qp-name').value.trim();
  let categoryId = el('qp-cat').value;
  const price = parseFloat(el('qp-price').value) || 0;

  if (!name) { toast('Ingresá el nombre del producto.', 'error'); return; }

  // Create new category if needed
  if (categoryId === '__new__') {
    const newCatName = el('qp-newcat-name')?.value.trim();
    if (!newCatName) { toast('Ingresá un nombre para la nueva categoría.', 'error'); return; }
    const newCat = DB.addCategory(newCatName);
    categoryId = newCat.id;
    toast(`Categoría "${newCatName}" creada.`, 'success');
  }

  if (!categoryId) { toast('Seleccioná una categoría.', 'error'); return; }

  // Create product with stock=1 (enough to add to cart)
  const newProd = DB.addProduct({ name, categoryId, talle: '', price, stock: 1 });

  closeModal();
  toast(`"${name}" creado y agregado al carrito.`, 'success');

  // Re-render view-venta to include the new product in the grid
  renderView('view-venta');

  // Add to cart after render
  setTimeout(() => addToCart(newProd.id), 100);
}

function openEditProductFromVenta(productId) {
  openEditProduct(productId);
  // Hook saveEditProduct to refresh the sales window upon complete
  const origSave = window.saveEditProduct;
  window.saveEditProduct = function(id) {
    origSave.call(this, id);
    renderView('view-venta');
    window.saveEditProduct = origSave;
  };
}

function openNewCatFromVenta() {
  openModal('Nueva Categoría', `
    <div class="form-group"><label>Nombre</label><input id="vcat-name" type="text" placeholder="Ej: Remeras"/></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveVentaCat()">Guardar</button>
  `);
}
function saveVentaCat() {
  const name = el('vcat-name').value.trim();
  if (!name) { toast('Ingresá un nombre','error'); return; }
  DB.addCategory(name);
  closeModal(); toast('Categoría creada.','success');
  renderView('view-venta');
}

function confirmSale() {
  if (cart.length === 0) { toast('El carrito está vacío.','error'); return; }
  
  const cashAmt = parseFloat(el('v-split-cash')?.value)||0;
  const cardAmt = parseFloat(el('v-split-card')?.value)||0;
  const debtAmt = parseFloat(el('v-split-debt')?.value)||0;
  
  if (debtAmt > 0 && !saleDebtorId) {
    const dsel = el('v-debtor-select');
    if (!dsel || !dsel.value || dsel.value==='__new__') {
      toast('Seleccioná un deudor para la parte a deudor.','error'); return;
    }
    saleDebtorId = dsel.value;
  }

  const prods = DB.getProducts();
  const sub = cart.reduce((a,c)=>{ 
    const p=prods.find(x=>x.id===c.productId); 
    const price = c.customPrice !== undefined ? c.customPrice : (p?p.price:0);
    return a+(price*c.qty); 
  },0);
  const disc = parseFloat(el('cart-discount')?.value||0);
  const discAmt = sub*(disc/100);
  let baseTotal = sub - discAmt;
  let totalFinal = baseTotal;

  // Apply card surcharge if toggled
  const applyCardSurcharge = el('v-card-surcharge-apply')?.checked;
  const cardSurchargePct = parseFloat(el('v-card-surcharge-pct')?.value)||0;
  let cardSurchargeAmt = 0;
  if (applyCardSurcharge && cardAmt > 0) {
    cardSurchargeAmt = cardAmt * (cardSurchargePct / 100);
    totalFinal += cardSurchargeAmt;
  }

  // Apply surcharge if debtor
  let surcharge = 0;
  let debtorName = '';
  let finalDebtAmt = debtAmt;
  
  if (saleDebtorId && debtAmt > 0) {
    const debtor = DB.getDebtors().find(d=>d.id===saleDebtorId);
    if (debtor) {
      surcharge = parseFloat(el('v-debtor-surcharge-pct')?.value) || 0;
      debtorName = debtor.name;
      
      // Apply surcharge only to debt fraction
      const surchargeAmt = debtAmt * (surcharge/100);
      totalFinal += surchargeAmt;
      finalDebtAmt = debtAmt + surchargeAmt;
    }
  }

  const items = cart.map(c => {
    const p = prods.find(x=>x.id===c.productId);
    const price = c.customPrice !== undefined ? c.customPrice : (p?.price || 0);
    return { productId: c.productId, name: p?.name, price: price, qty: c.qty, variantLabel: c.variantLabel || null, variantIdx: c.variantIdx !== undefined ? c.variantIdx : null };
  });

  // Calculate dynamic change
  const currentSum = cashAmt + cardAmt + debtAmt;
  let change = 0;
  if (currentSum > baseTotal) {
    const leftToPayWithCash = baseTotal - (cardAmt + debtAmt);
    if (leftToPayWithCash >= 0) {
      change = cashAmt - leftToPayWithCash;
    } else {
      change = cashAmt;
    }
  }

  const finalCardAmtWithSurcharge = cardAmt + cardSurchargeAmt;

  // Show confirm modal
  let methodBadge = `
    <div style="font-size:12px;color:var(--text-2);text-align:right;">
      💵 Efectivo: ${fmt(cashAmt)}<br/>
      💳 Tarjeta: ${fmt(finalCardAmtWithSurcharge)} ${applyCardSurcharge ? `(con recargo ${cardSurchargePct}%)` : ''}<br/>
      ${debtAmt > 0 ? `📋 Deudor (${debtorName}): ${fmt(finalDebtAmt)} ${surcharge > 0 ? `(con recargo ${surcharge}%)` : ''}<br/>` : ''}
    </div>`;

  let directCashHtml = '';
  if (change > 0) {
    directCashHtml = `
      <div class="cart-total-row text-green" style="font-size:15px; font-weight:800;">
        <span>Vuelto a entregar:</span>
        <span>${fmt(change)}</span>
      </div>
    `;
  }

  openModal('Confirmar Venta', `
    <div style="margin-bottom:14px">
      ${items.map(i=>`<div class="cart-total-row"><span>${i.name} x${i.qty}</span><span>${fmt(i.price*i.qty)}</span></div>`).join('')}
    </div>
    <div class="cart-total-row"><span>Subtotal</span><span>${fmt(sub)}</span></div>
    ${disc>0?`<div class="cart-total-row"><span>Descuento ${disc}%</span><span class="text-green">-${fmt(discAmt)}</span></div>`:''}
    ${cardSurchargeAmt>0?`<div class="cart-total-row"><span>Recargo tarjeta ${cardSurchargePct}%</span><span class="text-yellow">+${fmt(cardSurchargeAmt)}</span></div>`:''}
    ${surcharge>0?`<div class="cart-total-row"><span>Recargo deudor ${surcharge}% (sobre parte fiada)</span><span class="text-yellow">+${fmt(totalFinal-baseTotal-cardSurchargeAmt)}</span></div>`:''}
    <div class="cart-total-row big"><span>TOTAL COBRADO</span><span class="text-accent">${fmt(totalFinal)}</span></div>
    ${directCashHtml}
    <hr class="divider"/>
    <div class="cart-total-row">
      <span>Medios de Pago</span>
      <div>${methodBadge}</div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="finalizeSale(${totalFinal},${sub},${discAmt},${disc},${surcharge},1,${cashAmt},${finalCardAmtWithSurcharge},${finalDebtAmt})">✅ Confirmar</button>
  `);
}

function finalizeSale(totalFinal, subtotal, discAmt, discPct, surcharge, isMulti, splitCash, splitCard, splitDebt) {
  const prods = DB.getProducts();
  const items = cart.map(c => {
    const p = prods.find(x=>x.id===c.productId);
    const price = c.customPrice !== undefined ? c.customPrice : (p?.price || 0);
    return { productId: c.productId, name: p?.name, price: price, qty: c.qty };
  });

  // Discount stock
  cart.forEach(c => {
    const p = prods.find(x=>x.id===c.productId);
    if (p) DB.updateProduct(p.id, { stock: Math.max(0, p.stock - c.qty) });
  });

  // Save sale
  const sale = DB.addSale({
    items, subtotal, discountPct: discPct, discountAmt: discAmt,
    surcharge, totalFinal,
    payType: isMulti ? 'multi' : salePayType, 
    debtorId: saleDebtorId,
    cashier: currentUser.name,
    userId: currentUser.id,
    splitDetails: isMulti ? { cash: splitCash, card: splitCard, debt: splitDebt } : null
  });

  // Add debt if debtor or multi-pay with debtor fraction
  if (saleDebtorId) {
    const debtAmount = isMulti ? splitDebt : totalFinal;
    if (debtAmount > 0) {
      DB.addDebt({ debtorId: saleDebtorId, saleId: sale.id, amount: debtAmount });
    }
  }

  cart = [];
  salePayType = 'efectivo';
  saleDebtorId = null;
  closeModal();
  toast('¡Venta registrada exitosamente! 🎉','success');
  renderView('view-venta');
}

// ══════════════════════════════════════════════════════════
//  HISTORIAL DE VENTAS
// ══════════════════════════════════════════════════════════
function buildHistorial() {
  const sales = DB.getSales().map(s => ({ ...s, _type: 'sale' }));
  const manualDebts = DB.getDebts().filter(d => !d.saleId).map(d => ({ ...d, _type: 'manual_debt' }));
  const combined = [...sales, ...manualDebts].sort((a, b) => new Date(b.date) - new Date(a.date));
  const todayVal = today();
  
  // Get date range inputs or defaults
  const fromDate = window._historialFromDate || '';
  const toDate = window._historialToDate || '';

  const filteredCombined = combined.filter(item => {
    const sDate = item.date.slice(0, 10);
    if (fromDate && sDate < fromDate) return false;
    if (toDate && sDate > toDate) return false;
    return true;
  });

  const rows = filteredCombined.map(item => {
    if (item._type === 'sale') {
      const s = item;
      let payBadge = '';
      if (s.payType === 'multi') {
        payBadge = '<span class="badge badge-purple">🥞 Multi-Pago</span>';
      } else {
        payBadge = {
          efectivo: '<span class="badge badge-green">💵 Efectivo</span>',
          debito:   '<span class="badge badge-blue">💳 Débito/Créd.</span>',
          deudor:   '<span class="badge badge-yellow">📋 Deudor</span>',
        }[s.payType] || s.payType;
      }
      
      const debtor = s.debtorId ? DB.getDebtors().find(d=>d.id===s.debtorId) : null;
      const isReturned = s.returned === true;
      
      return `<tr style="${isReturned ? 'background:rgba(255,200,0,0.08); border-left:3px solid var(--yellow);' : ''}">
        <td>${fmtDate(s.date)}</td>
        <td>
          ${s.items?.map(i=>`${i.name} x${i.qty}`).join(', ')}
          ${isReturned ? '<span style="display:inline-block; background:var(--yellow); color:#333; font-size:10px; font-weight:800; padding:2px 7px; border-radius:20px; margin-left:6px; text-transform:uppercase; vertical-align:middle;">Devuelta/Anulada</span>' : ''}
          ${s.exchangeRef ? '<span style="display:inline-block; background:var(--purple); color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:20px; margin-left:6px; vertical-align:middle;">Cambio</span>' : ''}
        </td>
        <td>${s.cashier||'-'}</td>
        <td>${payBadge}${debtor?` <small class="text-muted">${debtor.name}</small>`:''}</td>
        <td>${s.discountPct>0?`<span class="text-green">-${s.discountPct}%</span>`:'-'}</td>
        <td class="${isReturned ? 'text-yellow' : 'text-accent'}" style="font-weight:700">${fmt(s.totalFinal)}</td>
        <td>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="openSaleDetails('${s.id}')" title="Ver Detalle">👀</button>
        </td>
      </tr>`;
    } else {
      const d = item;
      const isAbono = d.amount < 0;
      const debtor = DB.getDebtors().find(x=>x.id===d.debtorId);
      const debtorName = debtor ? debtor.name : 'Deudor';
      const detailStr = d.detail ? ` <small class="text-muted">(${d.detail})</small>` : '';
      return `<tr style="background-color: var(--bg3);">
        <td>${fmtDate(d.date)}</td>
        <td>
          ${isAbono ? '💸 Abono a Deuda' : '📝 Deuda Agregada'}${detailStr}
        </td>
        <td>-</td>
        <td><span class="badge ${isAbono ? 'badge-purple' : 'badge-yellow'}">Manual</span> <small class="text-muted">${debtorName}</small></td>
        <td>-</td>
        <td class="${isAbono ? 'text-green' : 'text-red'}" style="font-weight:700">${fmt(Math.abs(d.amount))}</td>
        <td>—</td>
      </tr>`;
    }
  }).join('');

  const total = filteredCombined.reduce((a, item) => {
    if (item._type === 'sale' && !item.returned) return a + item.totalFinal;
    return a;
  }, 0);
  
  return `
  <div class="view-header">
    <h2>📋 Historial de Ventas</h2>
    <p>${filteredCombined.length} venta(s) mostrada(s) · Recaudado neto: <strong class="text-green">${fmt(total)}</strong></p>
    <div class="view-actions">
      <button class="btn btn-secondary" onclick="exportHistorialCSV()">📥 Exportar Excel (CSV)</button>
    </div>
  </div>

  <div class="filter-container">
    <div class="filter-item">
      <label>Desde:</label>
      <input type="date" id="hist-from" value="${fromDate}" onchange="applyHistorialFilters()"/>
    </div>
    <div class="filter-item">
      <label>Hasta:</label>
      <input type="date" id="hist-to" value="${toDate}" onchange="applyHistorialFilters()"/>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="clearHistorialFilters()">Limpiar filtros</button>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr><th>Fecha</th><th>Productos</th><th>Cajero</th><th>Pago</th><th>Desc.</th><th>Total</th><th>Acciones</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="7" style="text-align:center;color:var(--text-3)">Sin ventas en el rango seleccionado</td></tr>'}</tbody>
    </table>
  </div>`;
}

window._currentReturnSelection = {};

function changeReturnQty(idx, delta, maxQty) {
  const current = window._currentReturnSelection[idx] || 0;
  let next = current + delta;
  if (next < 0) next = 0;
  if (next > maxQty) next = maxQty;
  window._currentReturnSelection[idx] = next;
  
  const elQty = document.getElementById(`ret-qty-${idx}`);
  if (elQty) elQty.innerText = next;
  
  const hasReturns = Object.values(window._currentReturnSelection).some(v => v > 0);
  const btn = document.getElementById('btn-process-return');
  if (btn) btn.style.display = hasReturns ? 'inline-block' : 'none';
}

function openSaleDetails(saleId) {
  const sale = DB.getSales().find(s => s.id === saleId);
  if (!sale) return;

  const debtor = sale.debtorId ? DB.getDebtors().find(d => d.id === sale.debtorId) : null;
  const isReturned = sale.returned;
  window._currentReturnSelection = {};

  const itemsHtml = sale.items.map((i, idx) => {
    let returnHtml = '';
    if (!isReturned) {
      returnHtml = `
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <span style="font-size:11px; color:var(--text-3); font-weight:bold;">DEVOLVER:</span>
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px" onclick="changeReturnQty(${idx}, -1, ${i.qty})">-</button>
          <span id="ret-qty-${idx}" style="font-weight:700; width:16px; text-align:center;">0</span>
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px" onclick="changeReturnQty(${idx}, 1, ${i.qty})">+</button>
        </div>
      `;
    }

    return `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);">
      <div>
        <strong>${i.name}</strong> x${i.qty}
        ${i.variantLabel ? `<span style="font-size:10px; color:var(--text-3)">(${i.variantLabel})</span>` : ''}
        ${returnHtml}
      </div>
      <div style="text-align:right;">
        <span>${fmt(i.price)}</span> c/u<br/>
        <strong>${fmt(i.price * i.qty)}</strong>
      </div>
    </div>`;
  }).join('');

  let payDetails = '';
  if (sale.payType === 'multi' && sale.splitDetails) {
    payDetails = `
      <div style="margin-top:8px; font-size:13px;">
        ${sale.splitDetails.cash > 0 ? `💵 Efectivo: <strong>${fmt(sale.splitDetails.cash)}</strong><br>` : ''}
        ${sale.splitDetails.card > 0 ? `💳 Tarjeta: <strong>${fmt(sale.splitDetails.card)}</strong><br>` : ''}
        ${sale.splitDetails.debt > 0 ? `📋 Deudor: <strong>${fmt(sale.splitDetails.debt)}</strong><br>` : ''}
      </div>
    `;
  } else {
    payDetails = `<strong>${sale.payType}</strong>`;
  }

  openModal('🔍 Detalle de Venta', `
    <div style="background:var(--bg3); padding:12px; border-radius:var(--r-sm); margin-bottom:14px; font-size:13px;">
      <strong>Fecha:</strong> ${fmtDate(sale.date)}<br/>
      <strong>Cajero:</strong> ${sale.cashier}<br/>
      <strong>Método de pago:</strong> ${payDetails}<br/>
      ${debtor ? `<strong>Deudor:</strong> ${debtor.name}<br/>` : ''}
      ${sale.returned ? `<strong class="text-red">¡Venta Devuelta / Anulada!</strong><br/>` : ''}
    </div>
    
    <div style="margin-bottom:14px;">
      <h4 style="margin:0 0 8px 0; font-size:14px;">Prendas:</h4>
      ${itemsHtml}
    </div>

    <div style="background:var(--bg2); padding:12px; border-radius:var(--r-sm); border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span>Subtotal original:</span> <span>${fmt(sale.subtotal)}</span>
      </div>
      ${sale.discountAmt > 0 ? `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:var(--green);">
        <span>Descuento (${sale.discountPct}%):</span> <span>-${fmt(sale.discountAmt)}</span>
      </div>` : ''}
      ${sale.surcharge > 0 ? `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:var(--yellow);">
        <span>Recargo original:</span> <span>+${fmt(sale.surcharge)}</span>
      </div>` : ''}
      <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px dashed var(--border); font-size:16px; font-weight:800; color:var(--accent);">
        <span>TOTAL ACTUAL:</span> <span>${fmt(sale.totalFinal)}</span>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
    ${!isReturned ? `
      <button id="btn-open-exchange" class="btn btn-warning" onclick="closeModal(); setTimeout(()=>openExchangeModal('${sale.id}'),200)">🔄 Cambio de Prenda</button>
      <button id="btn-process-return" class="btn btn-danger" style="display:none;" onclick="processPartialReturn('${sale.id}')">Procesar Devolución</button>
    ` : ''}
  `);
}

function processPartialReturn(saleId) {
  const sale = DB.getSales().find(s => s.id === saleId);
  if (!sale) return;

  const prods = DB.getProducts();
  let totalItemsReturned = 0;
  let totalItemsOriginally = sale.items.reduce((sum, i) => sum + i.qty, 0);
  
  let newSubtotal = 0;
  let newItems = [];

  // Recalculate based on what is Kept vs Returned
  sale.items.forEach((item, idx) => {
    const retQty = window._currentReturnSelection[idx] || 0;
    totalItemsReturned += retQty;
    
    if (retQty > 0) {
      const p = prods.find(x => x.id === item.productId);
      if (p) DB.updateProduct(p.id, { stock: p.stock + retQty });
    }

    const keptQty = item.qty - retQty;
    if (keptQty > 0) {
      newItems.push({ ...item, qty: keptQty });
      newSubtotal += (item.price * keptQty);
    }
  });

  if (totalItemsReturned === 0) {
    toast('No hay prendas seleccionadas para devolver','error');
    return;
  }

  if (totalItemsReturned === totalItemsOriginally) {
    // Return completely
    DB.updateSale(saleId, { returned: true });
    if (sale.payType === 'deudor' && sale.debtorId) {
      const debts = DB.getDebts();
      const sDebt = debts.find(d => d.saleId === saleId && !d.paid);
      if (sDebt) DB.payDebt(sDebt.id);
    }
    toast('Venta anulada totalmente y stock devuelto.','success');
  } else {
    // Partial return
    const newDiscountAmt = newSubtotal * ((sale.discountPct || 0) / 100);
    const newBaseTotal = newSubtotal - newDiscountAmt;
    
    let newSurcharge = 0;
    if (sale.surcharge > 0 && sale.subtotal > 0) {
      const surchargeRatio = sale.surcharge / sale.subtotal;
      newSurcharge = newSubtotal * surchargeRatio;
    }
    
    const newTotalFinal = newBaseTotal + newSurcharge;

    DB.updateSale(saleId, {
      items: newItems,
      subtotal: newSubtotal,
      discountAmt: newDiscountAmt,
      surcharge: newSurcharge,
      totalFinal: newTotalFinal
    });
    
    toast('Devolución parcial procesada. Venta y stock actualizados.','success');
  }
  
  closeModal();
  renderView('view-historial');
}

// ══════════════════════════════════════════════════════════
//  CAMBIO DE PRENDA
// ══════════════════════════════════════════════════════════
window._exchRetSel = {};
window._exchSaleId = null;

function openExchangeModal(saleId) {
  const sale = DB.getSales().find(s => s.id === saleId);
  if (!sale) return;
  window._exchSaleId = saleId;
  window._exchRetSel = {};

  const prods = DB.getProducts();

  const returnItemsHtml = sale.items.map((i, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
      <div>
        <strong>${i.name}</strong> x${i.qty}
        ${i.variantLabel ? `<span class="badge badge-purple" style="font-size:10px;">${i.variantLabel}</span>` : ''}
        <div style="font-size:12px; color:var(--text-2)">${fmt(i.price)} c/u</div>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:11px; color:var(--text-3);">Devolver:</span>
        <button class="btn btn-secondary btn-sm" style="padding:2px 8px" onclick="exchChangeQty(${idx},-1,${i.qty})">-</button>
        <span id="exch-ret-${idx}" style="font-weight:800; min-width:18px; text-align:center;">0</span>
        <button class="btn btn-secondary btn-sm" style="padding:2px 8px" onclick="exchChangeQty(${idx},1,${i.qty})">+</button>
      </div>
    </div>
  `).join('');

  // Product options: include each variant as separate entry for clarity
  const productOptions = prods
    .filter(p => getTotalStock(p) > 0)
    .flatMap(p => {
      const variants = getVariants(p);
      if (p.variants && p.variants.length > 1) {
        return p.variants
          .filter(v => v.stock > 0)
          .map((v, vi) => `<option value="${p.id}__v${vi}" data-price="${v.price}">${p.name} – ${v.label} (${fmt(v.price)}) [Stock: ${v.stock}]</option>`);
      }
      return [`<option value="${p.id}" data-price="${variants[0].price}">${p.name}${p.talle ? ' Talle '+p.talle : ''} (${fmt(variants[0].price)}) [Stock: ${variants[0].stock}]</option>`];
    }).join('');

  openModal('🔄 Cambio de Prenda', `
    <div style="margin-bottom:14px;">
      <h4 style="margin:0 0 8px 0; font-size:14px; color:var(--text-1);">1️⃣ Prendas que devuelve el cliente:</h4>
      ${returnItemsHtml}
      <div style="background:var(--bg3); padding:8px 12px; border-radius:var(--r-sm); margin-top:10px; display:flex; justify-content:space-between;">
        <span style="font-size:13px;">Crédito del cliente:</span>
        <strong id="exch-credit" style="color:var(--green); font-size:15px;">$0</strong>
      </div>
    </div>
    <div style="margin-bottom:14px;">
      <h4 style="margin:0 0 8px 0; font-size:14px; color:var(--text-1);">2️⃣ Prenda nueva que se lleva:</h4>
      <div class="form-group">
        <select id="exch-new-product" onchange="updateExchangeCalc()" style="width:100%;">
          <option value="">-- Seleccioná la prenda nueva --</option>
          ${productOptions}
        </select>
      </div>
    </div>
    <div style="background:var(--bg2); padding:12px; border-radius:var(--r-sm); border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:13px;">
        <span>Prenda nueva:</span> <span id="exch-new-val" style="color:var(--text-1);">$0</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:13px; color:var(--green);">
        <span>Crédito cliente:</span> <span id="exch-credit2">$0</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:2px dashed var(--border); font-size:16px; font-weight:800;">
        <span id="exch-diff-label">Diferencia a cobrar:</span>
        <span id="exch-diff-val" style="color:var(--accent);">$0</span>
      </div>
    </div>
    <div id="exch-pay-area" style="display:none; margin-top:12px;">
      <div class="form-group" style="margin-bottom:0">
        <label>Método de pago de la diferencia</label>
        <select id="exch-pay-type">
          <option value="efectivo">💵 Efectivo</option>
          <option value="debito">💳 Débito/Crédito</option>
          <option value="deudor">📋 Deudor</option>
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button id="btn-finalize-exch" class="btn btn-success" style="display:none;" onclick="finalizeExchange()">Confirmar Cambio ✅</button>
  `);
}

function exchChangeQty(idx, delta, maxQty) {
  const cur = window._exchRetSel[idx] || 0;
  window._exchRetSel[idx] = Math.max(0, Math.min(cur + delta, maxQty));
  const el_q = document.getElementById(`exch-ret-${idx}`);
  if (el_q) el_q.innerText = window._exchRetSel[idx];
  updateExchangeCalc();
}

function updateExchangeCalc() {
  const saleId = window._exchSaleId;
  const sale = DB.getSales().find(s => s.id === saleId);
  if (!sale) return;

  // Calculate credit from returned items
  let credit = 0;
  sale.items.forEach((item, idx) => {
    const retQty = window._exchRetSel[idx] || 0;
    credit += retQty * item.price;
  });

  // Get new product price
  const selVal = document.getElementById('exch-new-product')?.value || '';
  let newPrice = 0;
  if (selVal) {
    const opt = document.querySelector(`#exch-new-product option[value="${selVal}"]`);
    if (opt) newPrice = parseFloat(opt.dataset.price) || 0;
  }

  const diff = newPrice - credit;

  // Update UI
  document.getElementById('exch-credit').innerText = fmt(credit);
  document.getElementById('exch-credit2').innerText = fmt(credit);
  document.getElementById('exch-new-val').innerText = fmt(newPrice);
  
  const diffLabel = document.getElementById('exch-diff-label');
  const diffVal = document.getElementById('exch-diff-val');
  if (diffLabel && diffVal) {
    if (diff > 0) {
      diffLabel.innerText = 'El cliente debe abonar:';
      diffVal.style.color = 'var(--accent)';
      diffVal.innerText = fmt(diff);
    } else if (diff < 0) {
      diffLabel.innerText = 'A devolver al cliente:';
      diffVal.style.color = 'var(--green)';
      diffVal.innerText = fmt(Math.abs(diff));
    } else {
      diffLabel.innerText = 'Sin diferencia (cambio exacto):';
      diffVal.style.color = 'var(--text-2)';
      diffVal.innerText = '$0';
    }
  }

  const payArea = document.getElementById('exch-pay-area');
  const btnFinalize = document.getElementById('btn-finalize-exch');
  const hasSelection = selVal && credit > 0;
  
  if (payArea) payArea.style.display = (diff > 0 && hasSelection) ? 'block' : 'none';
  if (btnFinalize) btnFinalize.style.display = hasSelection ? 'inline-block' : 'none';
}

function finalizeExchange() {
  const saleId = window._exchSaleId;
  const sale = DB.getSales().find(s => s.id === saleId);
  if (!sale) return;

  const selVal = document.getElementById('exch-new-product')?.value || '';
  if (!selVal) { toast('Seleccioná la prenda nueva.', 'error'); return; }

  const prods = DB.getProducts();
  let totalItemsOriginally = sale.items.reduce((sum, i) => sum + i.qty, 0);
  let totalItemsReturned = 0;
  let credit = 0;
  let newItems = [];
  let newSubtotal = 0;

  // Process returned items
  sale.items.forEach((item, idx) => {
    const retQty = window._exchRetSel[idx] || 0;
    totalItemsReturned += retQty;
    credit += retQty * item.price;

    if (retQty > 0) {
      const p = prods.find(x => x.id === item.productId);
      if (p) {
        const stockField = (item.variantIdx !== undefined && p.variants && p.variants[item.variantIdx]) 
          ? null : 'stock';
        if (stockField) {
          DB.updateProduct(p.id, { stock: p.stock + retQty });
        } else if (p.variants && item.variantIdx !== undefined) {
          const newVariants = p.variants.map((v, vi) => vi === item.variantIdx ? { ...v, stock: v.stock + retQty } : v);
          DB.updateProduct(p.id, { variants: newVariants });
        }
      }
    }

    const keptQty = item.qty - retQty;
    if (keptQty > 0) {
      newItems.push({ ...item, qty: keptQty });
      newSubtotal += item.price * keptQty;
    }
  });

  if (totalItemsReturned === 0) { toast('No seleccionaste ninguna prenda a devolver.', 'error'); return; }

  // Determine new product
  let newProductId, newVariantIdx;
  if (selVal.includes('__v')) {
    const [pid, vidStr] = selVal.split('__v');
    newProductId = pid;
    newVariantIdx = parseInt(vidStr);
  } else {
    newProductId = selVal;
    newVariantIdx = undefined;
  }

  const newProd = prods.find(x => x.id === newProductId);
  if (!newProd) { toast('Prenda nueva no encontrada.', 'error'); return; }

  const variants = getVariants(newProd);
  const newProdVariant = newVariantIdx !== undefined ? newProd.variants[newVariantIdx] : variants[0];
  const newPrice = newProdVariant.price;
  const newLabel = newVariantIdx !== undefined ? newProd.variants[newVariantIdx].label : null;

  // Check stock of new product
  if (newProdVariant.stock <= 0) { toast('Sin stock de la prenda nueva.', 'error'); return; }

  // Deduct stock of new product
  if (newVariantIdx !== undefined && newProd.variants) {
    const updVariants = newProd.variants.map((v, vi) => vi === newVariantIdx ? { ...v, stock: v.stock - 1 } : v);
    DB.updateProduct(newProductId, { variants: updVariants });
  } else {
    DB.updateProduct(newProductId, { stock: newProdVariant.stock - 1 });
  }

  // Calculate difference
  const diff = newPrice - credit;
  const payType = diff > 0 ? (document.getElementById('exch-pay-type')?.value || 'efectivo') : 'efectivo';
  const totalFinal = Math.max(diff, 0); // if negative, it's free exchange (client has credit)

  // Update original sale: remove returned items, recalculate
  if (totalItemsReturned === totalItemsOriginally) {
    // All returned — mark as returned
    DB.updateSale(saleId, { returned: true });
  } else {
    const newDiscountAmt = newSubtotal * ((sale.discountPct || 0) / 100);
    const newSurcharge = sale.surcharge > 0 && sale.subtotal > 0 ? (newSubtotal * (sale.surcharge / sale.subtotal)) : 0;
    DB.updateSale(saleId, {
      items: newItems,
      subtotal: newSubtotal,
      discountAmt: newDiscountAmt,
      surcharge: newSurcharge,
      totalFinal: newSubtotal - newDiscountAmt + newSurcharge
    });
  }

  // Register the exchange as a new sale
  const newSaleItem = {
    productId: newProductId,
    name: newProd.name,
    price: newPrice,
    qty: 1,
    variantLabel: newLabel
  };

  const exchangeSale = DB.addSale({
    items: [newSaleItem],
    subtotal: newPrice,
    discountPct: 0,
    discountAmt: 0,
    surcharge: 0,
    totalFinal: totalFinal,
    payType: totalFinal > 0 ? payType : 'efectivo',
    cashier: currentUser.name,
    exchangeRef: saleId,
    creditApplied: credit,
    note: `Cambio de prenda. Crédito aplicado: ${fmt(credit)}`
  });

  if (diff > 0) {
    toast(`Cambio procesado. El cliente pagó ${fmt(diff)} de diferencia.`, 'success');
  } else if (diff < 0) {
    toast(`Cambio procesado. El cliente tiene ${fmt(Math.abs(diff))} de saldo a favor.`, 'success');
  } else {
    toast('Cambio procesado sin diferencia de precio.', 'success');
  }

  closeModal();
  renderView('view-historial');
}

function applyHistorialFilters() {
  window._historialFromDate = el('hist-from')?.value || '';
  window._historialToDate = el('hist-to')?.value || '';
  renderView('view-historial');
}

function clearHistorialFilters() {
  window._historialFromDate = '';
  window._historialToDate = '';
  renderView('view-historial');
}

function exportHistorialCSV() {
  const sales = DB.getSales().slice().reverse();
  const fromDate = window._historialFromDate || '';
  const toDate = window._historialToDate || '';

  const filteredSales = sales.filter(s => {
    const sDate = s.date.slice(0, 10);
    if (fromDate && sDate < fromDate) return false;
    if (toDate && sDate > toDate) return false;
    return true;
  });

  if (filteredSales.length === 0) {
    toast('No hay datos para exportar en este rango','error');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Fecha,Productos,Cajero,Metodo Pago,Descuento,Total,Estado\n";

  filteredSales.forEach(s => {
    const dateStr = fmtDate(s.date).replace(/,/g, '');
    const itemsStr = s.items?.map(i=>`${i.name} (x${i.qty})`).join(' | ').replace(/,/g, '');
    const state = s.returned ? "Devuelto" : "Activo";
    csvContent += `"${dateStr}","${itemsStr}","${s.cashier}","${s.payType}","${s.discountPct}%","${s.totalFinal}","${state}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `5inco_ventas_${fromDate||'inicio'}_a_${toDate||'fin'}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast('Archivo CSV exportado con éxito','success');
}

// (Removed old return logic)

// ══════════════════════════════════════════════════════════
//  DEUDORES
// ══════════════════════════════════════════════════════════
function buildDeudores() {
  const allDebtors = DB.getDebtors();
  const allDebts = DB.getDebts();

  // Filters from window state
  const searchVal = (window._deudoresSearch || '').toLowerCase();
  const sortBy = window._deudoresSort || 'name-asc';
  const statusFilter = window._deudoresStatus || 'all';

  let debtors = allDebtors.map(d => ({
    ...d,
    balance: DB.getDebtorBalance(d.id),
    pendingCount: allDebts.filter(x => x.debtorId === d.id && !x.paid).length,
    lastActivity: allDebts.filter(x => x.debtorId === d.id).sort((a,b) => new Date(b.date) - new Date(a.date))[0]?.date || d.createdAt || ''
  }));

  // Apply search
  if (searchVal) debtors = debtors.filter(d => d.name.toLowerCase().includes(searchVal));

  // Apply status filter
  if (statusFilter === 'with-debt') debtors = debtors.filter(d => d.balance > 0);
  else if (statusFilter === 'no-debt') debtors = debtors.filter(d => d.balance <= 0);

  // Apply sort
  debtors.sort((a, b) => {
    switch(sortBy) {
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'balance-desc': return b.balance - a.balance;
      case 'balance-asc': return a.balance - b.balance;
      case 'pending-desc': return b.pendingCount - a.pendingCount;
      case 'pending-asc': return a.pendingCount - b.pendingCount;
      case 'recent': return new Date(b.lastActivity) - new Date(a.lastActivity);
      case 'oldest': return new Date(a.lastActivity) - new Date(b.lastActivity);
      default: return 0;
    }
  });

  const cards = debtors.map(d => {
    const balanceColor = d.balance > 0 ? 'var(--red)' : 'var(--green)';
    const balanceStr = d.balance > 0 ? fmt(d.balance) : `¡Al día!`;
    return `
    <div class="debtor-card" data-name="${d.name.toLowerCase()}" data-balance="${d.balance}" data-pending="${d.pendingCount}">
      <div class="debtor-avatar">${initials(d.name)}</div>
      <div class="debtor-info">
        <div class="debtor-name">${d.name}</div>
        <div class="debtor-phone">${d.phone||'Sin teléfono'} · Recargo: ${d.surcharge}%</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:2px">
          ${d.pendingCount} deuda(s) pendiente(s)
          ${d.lastActivity ? `· Última actividad: ${fmtDate(d.lastActivity)}` : ''}
        </div>
      </div>
      <div style="text-align:right">
        <div class="debtor-debt" style="color:${balanceColor}">${balanceStr}</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-secondary btn-sm" onclick="openDebtorDetail('${d.id}')">Ver</button>
          <button class="btn btn-ghost btn-sm" onclick="openEditDebtor('${d.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDebtorConfirm('${d.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');

  const totalDebt = allDebtors.reduce((sum, d) => sum + DB.getDebtorBalance(d.id), 0);
  const withDebt = allDebtors.filter(d => DB.getDebtorBalance(d.id) > 0).length;

  return `
  <div class="view-header">
    <h2>💳 Lista de Deudores</h2>
    <p>${allDebtors.length} deudor(es) total · <strong class="text-red">${withDebt} con deuda</strong> · Deuda total: <strong class="text-red">${fmt(totalDebt)}</strong></p>
    <div class="view-actions">
      <button class="btn btn-primary" onclick="openNewDebtorModal()">➕ Nuevo deudor</button>
    </div>
  </div>

  <div class="filter-container" style="flex-wrap:wrap; gap:10px; margin-bottom:16px;">
    <div class="search-box" style="flex:1; min-width:180px;">
      <span class="search-icon">🔍</span>
      <input type="text" id="deudores-search" placeholder="Buscar por nombre..." value="${window._deudoresSearch || ''}" oninput="applyDeudoresFilters()">
    </div>

    <div class="filter-item">
      <label>📊 Ordenar por</label>
      <select id="deudores-sort" onchange="applyDeudoresFilters()">
        <option value="name-asc" ${sortBy==='name-asc'?'selected':''}>Nombre A→Z</option>
        <option value="name-desc" ${sortBy==='name-desc'?'selected':''}>Nombre Z→A</option>
        <option value="balance-desc" ${sortBy==='balance-desc'?'selected':''}>Mayor deuda primero</option>
        <option value="balance-asc" ${sortBy==='balance-asc'?'selected':''}>Menor deuda primero</option>
        <option value="pending-desc" ${sortBy==='pending-desc'?'selected':''}>Más deudas pendientes</option>
        <option value="pending-asc" ${sortBy==='pending-asc'?'selected':''}>Menos deudas pendientes</option>
        <option value="recent" ${sortBy==='recent'?'selected':''}>Actividad más reciente</option>
        <option value="oldest" ${sortBy==='oldest'?'selected':''}>Actividad más antigua</option>
      </select>
    </div>

    <div class="filter-item">
      <label>📌 Estado</label>
      <select id="deudores-status" onchange="applyDeudoresFilters()">
        <option value="all" ${statusFilter==='all'?'selected':''}>Todos</option>
        <option value="with-debt" ${statusFilter==='with-debt'?'selected':''}>Solo con deuda</option>
        <option value="no-debt" ${statusFilter==='no-debt'?'selected':''}>Al día (sin deuda)</option>
      </select>
    </div>

    <button class="btn btn-ghost btn-sm" onclick="clearDeudoresFilters()">✖ Limpiar filtros</button>
  </div>

  <div id="deudores-list">
    ${debtors.length ? cards : '<div class="empty-state"><div class="empty-icon">💳</div><p>No se encontraron deudores con esos filtros.</p></div>'}
  </div>`;
}

function applyDeudoresFilters() {
  window._deudoresSearch = el('deudores-search')?.value || '';
  window._deudoresSort = el('deudores-sort')?.value || 'name-asc';
  window._deudoresStatus = el('deudores-status')?.value || 'all';
  renderView('view-deudores');
}

function clearDeudoresFilters() {
  window._deudoresSearch = '';
  window._deudoresSort = 'name-asc';
  window._deudoresStatus = 'all';
  renderView('view-deudores');
}

function bindDeudores() {
  // Filters are applied reactively via applyDeudoresFilters() / onchange / oninput
}

function openDebtorDetail(id) {
  const debtor = DB.getDebtors().find(d=>d.id===id);
  if (!debtor) return;
  let debts = DB.getDebts().filter(d=>d.debtorId===id);
  const sales = DB.getSales();
  const balance = DB.getDebtorBalance(id);

  // Apply filters
  const statusFilter = window._debtorDetailStatus || 'pending';
  const sortBy = window._debtorDetailSort || 'date-desc';

  if (statusFilter === 'pending') debts = debts.filter(d => !d.paid);
  else if (statusFilter === 'paid') debts = debts.filter(d => d.paid);

  debts.sort((a, b) => {
    switch (sortBy) {
      case 'date-desc': return new Date(b.date) - new Date(a.date);
      case 'date-asc': return new Date(a.date) - new Date(b.date);
      case 'amount-desc': return Math.abs(b.amount) - Math.abs(a.amount);
      case 'amount-asc': return Math.abs(a.amount) - Math.abs(b.amount);
      default: return 0;
    }
  });

  const cards = debts.map(debt => {
    const isAbono = debt.amount < 0;
    const amountStr = isAbono ? `+${fmt(Math.abs(debt.amount))}` : fmt(debt.amount);
    const badgeCls = debt.paid ? 'badge-green' : (isAbono ? 'badge-purple' : 'badge-red');
    const badgeTxt = debt.paid ? (isAbono ? 'Aplicado' : 'Pagado') : (isAbono ? 'Abono a favor' : 'Pendiente');

    // Build detail description
    let detailHtml = '';
    if (debt.saleId) {
      const sale = sales.find(s => s.id === debt.saleId);
      if (sale && sale.items && sale.items.length > 0) {
        const itemsList = sale.items.map(i => `${i.qty}x ${i.name}`).join(', ');
        detailHtml = `<div class="debt-card-detail">🛒 Venta: ${itemsList}</div>`;
      } else {
        detailHtml = `<div class="debt-card-detail">🛒 Venta vinculada</div>`;
      }
    } else if (debt.detail) {
      detailHtml = `<div class="debt-card-detail">${isAbono ? '💸' : '📝'} ${debt.detail}</div>`;
    } else {
      detailHtml = `<div class="debt-card-detail" style="color:var(--text-3)">${isAbono ? '💸 Abono / Pago manual' : '📝 Agregado manualmente'}</div>`;
    }

    let actionHtml = '';
    if (debt.paid) {
      actionHtml = `<span style="font-size:11px;color:var(--text-3)">Cerrado: ${fmtDate(debt.paidDate)}</span>`;
    } else {
      actionHtml = `<button class="btn btn-success btn-sm" onclick="payDebt('${debt.id}','${id}')">✅ ${isAbono ? 'Archivar' : 'Pagado'}</button>`;
    }

    const saleLink = debt.saleId
      ? `<a href="#" onclick="closeModal(); setTimeout(() => viewSaleTicket('${debt.saleId}'), 200)" style="font-size:11px;color:var(--accent);text-decoration:underline;">Ver Ticket</a>`
      : '';

    return `
    <div class="debt-card ${debt.paid ? 'debt-card--paid' : ''} ${isAbono ? 'debt-card--abono' : ''}">
      <div class="debt-card-header">
        <span class="debt-card-date">${fmtDate(debt.date)}</span>
        <span class="badge ${badgeCls}">${badgeTxt}</span>
      </div>
      ${detailHtml}
      <div class="debt-card-footer">
        <div class="debt-card-amount ${isAbono ? 'text-green' : ''}">${amountStr}</div>
        <div class="debt-card-actions">${saleLink} ${actionHtml}</div>
      </div>
    </div>`;
  }).join('');

  openModal(`💳 ${debtor.name}`, `
    <div class="flex-row mb-2">
      <div>
        <div style="font-size:13px;color:var(--text-2)">${debtor.phone||'Sin teléfono'}</div>
        <div style="font-size:13px;color:var(--text-2)">Recargo: ${debtor.surcharge}%</div>
      </div>
      <div class="ml-auto" style="text-align:right">
        <div style="font-size:12px;color:var(--text-2)">Deuda pendiente</div>
        <div style="font-size:22px;font-weight:800;color:var(--red)">${fmt(balance)}</div>
      </div>
    </div>
    <div class="divider"></div>
    
    <div class="filter-container" style="gap:8px; margin-bottom:12px; font-size:12px;">
      <select id="dd-status" onchange="window._debtorDetailStatus=this.value; openDebtorDetail('${id}')" style="flex:1; padding:4px;">
        <option value="pending" ${statusFilter==='pending'?'selected':''}>Pendientes</option>
        <option value="paid" ${statusFilter==='paid'?'selected':''}>Pagados/Cerrados</option>
        <option value="all" ${statusFilter==='all'?'selected':''}>Todos los movs.</option>
      </select>
      <select id="dd-sort" onchange="window._debtorDetailSort=this.value; openDebtorDetail('${id}')" style="flex:1; padding:4px;">
        <option value="date-desc" ${sortBy==='date-desc'?'selected':''}>Más recientes</option>
        <option value="date-asc" ${sortBy==='date-asc'?'selected':''}>Más antiguos</option>
        <option value="amount-desc" ${sortBy==='amount-desc'?'selected':''}>Mayor importe</option>
        <option value="amount-asc" ${sortBy==='amount-asc'?'selected':''}>Menor importe</option>
      </select>
    </div>

    <div class="debt-cards-list">
      ${cards || '<div class="empty-state" style="padding:24px 0"><div class="empty-icon">💳</div><p>No hay movimientos con esos filtros.</p></div>'}
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`);
}

function viewSaleTicket(saleId) {
  const sale = DB.getSales().find(s => s.id === saleId);
  if (!sale) { toast('Venta no encontrada', 'error'); return; }
  
  const itemsHtml = sale.items?.map(i => `
    <div class="cart-total-row"><span>${i.name} x${i.qty}</span><span>${fmt(i.price*i.qty)}</span></div>
  `).join('') || '';

  const splitHtml = sale.splitDetails ? `
    <hr class="divider"/>
    <div style="font-size:12px;color:var(--text-2);text-align:right;">
      💵 Efectivo: ${fmt(sale.splitDetails.cash || 0)}<br/>
      💳 Tarjeta: ${fmt(sale.splitDetails.card || 0)}<br/>
      📋 Deudor: ${fmt(sale.splitDetails.debt || 0)}
    </div>
  ` : '';

  openModal('📄 Ticket de Venta', `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:16px;background:var(--bg-card);padding:10px;border-radius:6px;">
      <b>Fecha:</b> ${fmtDate(sale.date)}<br/>
      <b>Cajero/a:</b> ${sale.cashier || '-'}<br/>
      <b>Medio principal:</b> ${sale.payType.toUpperCase()}
    </div>
    <div style="margin-bottom:14px">
      ${itemsHtml}
    </div>
    <hr class="divider"/>
    <div class="cart-total-row"><span>Subtotal</span><span>${fmt(sale.subtotal)}</span></div>
    ${sale.discountAmt > 0 ? `<div class="cart-total-row"><span>Descuento ${sale.discountPct}%</span><span class="text-green">-${fmt(sale.discountAmt)}</span></div>` : ''}
    ${sale.surcharge > 0 ? `<div class="cart-total-row"><span>Recargos</span><span class="text-yellow">+${fmt(sale.surcharge)}</span></div>` : ''}
    <div class="cart-total-row big"><span>TOTAL</span><span class="text-accent">${fmt(sale.totalFinal)}</span></div>
    ${splitHtml}
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`);
}

function payDebt(debtId, debtorId) {
  const debt = DB.getDebts().find(d => d.id === debtId);
  DB.payDebt(debtId);
  if (debt && debt.amount < 0) {
    toast('Abono archivado.','success');
  } else {
    toast('Deuda marcada como pagada.','success');
  }
  openDebtorDetail(debtorId);
  renderView('view-deudores');
}

function openNewDebtorModal() {
  openModal('Nuevo Deudor', `
    <div class="form-group"><label>Nombre completo</label><input id="deb-name" type="text" placeholder="Nombre apellido"/></div>
    <div class="form-group"><label>Teléfono</label><input id="deb-phone" type="text" placeholder="11-1234-5678"/></div>
    <div class="form-group"><label>Recargo (%)</label><input id="deb-sur" type="number" value="0" min="0"/></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveNewDebtor()">Guardar</button>
  `);
}

function saveNewDebtor() {
  const name = el('deb-name').value.trim();
  const phone = el('deb-phone').value.trim();
  const surcharge = parseFloat(el('deb-sur').value)||0;
  if (!name) { toast('El nombre es requerido.','error'); return; }
  DB.addDebtor({ name, phone, surcharge });
  closeModal(); toast('Deudor creado.','success');
  renderView('view-deudores');
}

function openEditDebtor(id) {
  const d = DB.getDebtors().find(x=>x.id===id);
  if (!d) return;
  openModal('Editar Deudor', `
    <div class="form-group"><label>Nombre</label><input id="ed-name" type="text" value="${d.name}"/></div>
    <div class="form-group"><label>Teléfono</label><input id="ed-phone" type="text" value="${d.phone||''}"/></div>
    <div class="form-group"><label>Recargo (%)</label><input id="ed-sur" type="number" value="${d.surcharge}"/></div>
    <div class="divider"></div>
    <div class="form-row cols-2">
      <div class="form-group"><label>➕ Sumar deuda</label><input id="ed-add-debt" type="number" placeholder="$ a sumar" min="0"/></div>
      <div class="form-group"><label>➖ Abonar (Restar)</label><input id="ed-sub-debt" type="number" placeholder="$ a restar" min="0"/></div>
    </div>
    <div class="form-group"><label>Detalle (Opcional)</label><input id="ed-detail" type="text" placeholder="Motivo de la suma o abono"/></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveEditDebtor('${id}')">Guardar</button>
  `);
}
function saveEditDebtor(id) {
  const name = el('ed-name').value.trim();
  const phone = el('ed-phone').value.trim();
  const surcharge = parseFloat(el('ed-sur').value)||0;
  const newDebt = parseFloat(el('ed-add-debt').value)||0;
  const payDebtAmt = parseFloat(el('ed-sub-debt').value)||0;
  const detail = el('ed-detail').value.trim() || null;
  
  if (!name) { toast('El nombre es requerido.','error'); return; }
  DB.updateDebtor(id, { name, phone, surcharge });
  
  if (newDebt > 0) {
    DB.addDebt({ debtorId: id, amount: newDebt, detail });
    DB.addAuditLog('debtor_update', `Suma de deuda manual: ${name} - $${newDebt}`, { debtorId: id, amount: newDebt, detail });
  }
  if (payDebtAmt > 0) {
    // Add negative debt to represent a payment/abono
    DB.addDebt({ debtorId: id, amount: -Math.abs(payDebtAmt), detail });
    DB.addAuditLog('debtor_update', `Abono de deuda manual: ${name} - $${payDebtAmt}`, { debtorId: id, amount: payDebtAmt, detail });
  }
  
  closeModal(); toast('Deudor actualizado.','success');
  renderView('view-deudores');
}
function deleteDebtorConfirm(id) {
  const d = DB.getDebtors().find(x=>x.id===id);
  if (!d) return;
  if (!confirm(`¿Eliminar a ${d.name}? Esto eliminará su registro pero no sus deudas históricas.`)) return;
  DB.deleteDebtor(id);
  toast('Deudor eliminado.','success');
  renderView('view-deudores');
}

// ══════════════════════════════════════════════════════════
//  GASTOS Y CAJA DIARIA
// ══════════════════════════════════════════════════════════
function buildGastos() {
  const expenses = DB.getExpenses().slice().reverse();
  const fixedTemplates = DB.getFixedExpenses();
  const dateStr = today();
  const cashSess = DB.getCashSession(dateStr);
  const jefe = currentUser.role === 'jefe';
  
  // Calculate cash sales total for today
  const todaySales = DB.getSales().filter(s => s.date.startsWith(dateStr) && !s.returned);
  const cashSalesToday = todaySales.reduce((sum, s) => {
    if (s.payType === 'efectivo') return sum + s.totalFinal;
    if (s.payType === 'multi' && s.splitDetails) return sum + (s.splitDetails.cash || 0);
    return sum;
  }, 0);
  const cardSalesToday = todaySales.reduce((sum, s) => {
    if (s.payType === 'debito') return sum + s.totalFinal;
    if (s.payType === 'multi' && s.splitDetails) return sum + (s.splitDetails.card || 0);
    return sum;
  }, 0);
  const debtorSalesToday = todaySales.reduce((sum, s) => {
    if (s.payType === 'deudor') return sum + s.totalFinal;
    if (s.payType === 'multi' && s.splitDetails) return sum + (s.splitDetails.debt || 0);
    return sum;
  }, 0);

  const expensesToday = DB.getExpenses().filter(e => e.date.startsWith(dateStr)).reduce((sum, e) => sum + e.amount, 0);
  const openingCash = cashSess ? cashSess.openingCash : 0;
  const expectedCashInDrawer = openingCash + cashSalesToday - expensesToday;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const fixedListRows = fixedTemplates.map(f => `
    <tr>
      <td><strong>${f.name}</strong></td>
      <td>${fmt(f.amount)}</td>
      <td>
        <button class="btn btn-success btn-sm" onclick="payFixedExpense('${f.id}')" title="Marcar como pagado este mes">💸 Pagar</button>
        <button class="btn btn-ghost btn-sm" onclick="openEditFixedExpense('${f.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteFixedExpenseConfirm('${f.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');

  const historyRows = expenses.map(e => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>
        <span class="badge ${e.type==='fijo'?'badge-purple':e.type==='caja'?'badge-yellow':'badge-red'}">
          ${e.type==='fijo'?'Fijo/Servicio':e.type==='caja'?'Retiro Caja':'Gasto Directo'}
        </span>
      </td>
      <td><strong>${e.name}</strong></td>
      <td>${e.cashier ? `<small class="text-muted">${e.cashier}</small>` : 'Jefe'}</td>
      <td class="text-red" style="font-weight:700">-${fmt(e.amount)}</td>
      <td>
        ${jefe ? `<button class="btn btn-danger btn-sm btn-icon" onclick="deleteExpenseConfirm('${e.id}')">🗑️</button>` : '—'}
      </td>
    </tr>
  `).join('');

  // Daily cash session info block
  let sessionHtml = '';
  if (cashSess) {
    sessionHtml = `
      <div class="card" style="border-left: 4px solid var(--accent); margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding: 16px 20px;">
        <div>
          <div style="font-size:12px; color:var(--text-3); font-weight:700; text-transform:uppercase;">Caja Inicial Abierta</div>
          <div style="font-size:24px; font-weight:800; color:var(--accent); margin-top:2px;">${fmt(cashSess.openingCash)}</div>
          <div style="font-size:11px; color:var(--text-2); margin-top:4px;">Iniciada por <strong>${cashSess.openedBy}</strong> a las ${new Date(cashSess.openedAt).toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
        ${jefe ? `<button class="btn btn-secondary btn-sm" onclick="promptOpeningCashBox('${dateStr}')">⚙️ Ajustar Caja Inicial</button>` : ''}
      </div>`;
  } else {
    sessionHtml = `
      <div class="card" style="border-left: 4px solid var(--red); margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding: 16px 20px;">
        <div>
          <div style="font-size:12px; color:var(--text-3); font-weight:700; text-transform:uppercase;">⚠️ Caja Diaria sin Abrir</div>
          <p style="font-size:13px; color:var(--text-2); margin-top:4px;">No se ha registrado el efectivo inicial para el día de hoy.</p>
        </div>
        <button class="btn btn-primary" onclick="promptOpeningCashBox('${dateStr}')">📥 Abrir Caja Chica</button>
      </div>`;
  }

  return `
  <div class="view-header">
    <h2>💸 ${jefe ? 'Gastos y Caja' : 'Caja y Retiros'}</h2>
    <p>Control de efectivo en caja diaria ${jefe ? 'y costos mensuales' : ''}</p>
    <div class="view-actions">
      <button class="btn btn-danger" onclick="openWithdrawCash()"><span style="margin-right:4px;">💸</span> Sacar Plata de Caja (Retiro)</button>
      ${jefe ? `
        <button class="btn btn-primary" onclick="openAddBoxExpense()">➕ Registrar Gasto General</button>
        <button class="btn btn-secondary" onclick="openAddFixedTemplate()">⚙️ Configurar Servicio Fijo</button>
      ` : ''}
    </div>
  </div>

  ${sessionHtml}

  <div class="stats-grid">
    <div class="stat-card" style="border-left: 4px solid var(--accent);">
      <div class="stat-icon">📥</div>
      <div class="stat-label">Caja Inicial Hoy</div>
      <div class="stat-value text-accent">${fmt(openingCash)}</div>
    </div>
    <div class="stat-card" style="border-left: 4px solid var(--green);">
      <div class="stat-icon">💵</div>
      <div class="stat-label">Ventas Efectivo Hoy</div>
      <div class="stat-value text-green">${fmt(cashSalesToday)}</div>
    </div>
    <div class="stat-card" style="border-left: 4px solid var(--blue);">
      <div class="stat-icon">💳</div>
      <div class="stat-label">Ventas Tarjeta Hoy</div>
      <div class="stat-value text-blue">${fmt(cardSalesToday)}</div>
    </div>
    <div class="stat-card" style="border-left: 4px solid var(--yellow);">
      <div class="stat-icon">📋</div>
      <div class="stat-label">Ventas Deudor Hoy</div>
      <div class="stat-value text-yellow">${fmt(debtorSalesToday)}</div>
    </div>
    <div class="stat-card" style="border-left: 4px solid var(--red);">
      <div class="stat-icon">💸</div>
      <div class="stat-label">Retiros/Gastos Hoy</div>
      <div class="stat-value text-red">-${fmt(expensesToday)}</div>
    </div>
    <div class="stat-card" style="border-left: 4px solid var(--purple);">
      <div class="stat-icon">💰</div>
      <div class="stat-label">Caja Esperada (Efectivo)</div>
      <div class="stat-value text-purple" style="font-size:24px;">${fmt(expectedCashInDrawer)}</div>
    </div>
  </div>

  ${jefe ? `
  <div class="section">
    <div class="section-header">
      <span class="section-title">🏢 Servicios y Costos Fijos Mensuales (Alquiler, Luz, etc.)</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre Costo</th><th>Monto Estándar</th><th>Acciones</th></tr></thead>
        <tbody>
          ${fixedListRows || '<tr><td colspan="3" style="text-align:center;color:var(--text-3)">Sin servicios fijos configurados</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-header">
      <span class="section-title">📋 Libro Histórico de Gastos Realizados</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto / Detalle</th><th>Registrado Por</th><th>Monto</th><th>Acción</th></tr></thead>
        <tbody>
          ${historyRows || '<tr><td colspan="6" style="text-align:center;color:var(--text-3)">No hay gastos registrados aún</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  ${!jefe ? (() => {
    const hoursToday = (() => {
      const h = DB.getHours();
      return h[currentUser.id] && h[currentUser.id][dateStr] !== undefined ? h[currentUser.id][dateStr] : (currentUser.defaultHours || 3.5);
    })();
    return `
  <div class="section">
    <div class="section-header"><span class="section-title">⏰ Mis Horas de Hoy</span></div>
    <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;">
          <div style="font-size:12px;color:var(--text-3);font-weight:700;text-transform:uppercase;">Horas cargadas hoy</div>
          <div id="my-hours-display" style="font-size:36px;font-weight:800;color:var(--accent);margin-top:2px;">${hoursToday}h</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <button class="btn btn-ghost btn-sm" onclick="adjustMyHours(-0.5)">- 0.5h</button>
          <button class="btn btn-ghost btn-sm" onclick="adjustMyHours(-1)">- 1h</button>
          <button class="btn btn-ghost btn-sm" onclick="adjustMyHours(1)">+ 1h</button>
          <button class="btn btn-ghost btn-sm" onclick="adjustMyHours(0.5)">+ 0.5h</button>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:flex-end;">
        <div class="form-group" style="margin:0;flex:1;">
          <label style="font-size:12px;">Establecer valor exacto</label>
          <input id="my-hours-manual" type="number" min="0" max="24" step="0.5" value="${hoursToday}" style="font-size:18px;font-weight:700;text-align:center;"/>
        </div>
        <button class="btn btn-primary" style="margin-bottom:0;" onclick="saveMyHoursManual()">Guardar</button>
      </div>
    </div>
  </div>`;
  })() : ''}

  `;
}

function bindGastos() {}

function adjustMyHours(delta) {
  const dateStr = today();
  const h = DB.getHours();
  const current = (h[currentUser.id] && h[currentUser.id][dateStr] !== undefined) ? h[currentUser.id][dateStr] : (currentUser.defaultHours || 3.5);
  const newVal = Math.max(0, Math.round((current + delta) * 10) / 10);
  DB.setHoursForDay(currentUser.id, dateStr, newVal);
  const disp = document.getElementById('my-hours-display');
  const input = document.getElementById('my-hours-manual');
  if (disp) disp.textContent = newVal + 'h';
  if (input) input.value = newVal;
  toast(`Horas actualizadas: ${newVal}h`, 'success');
}

function saveMyHoursManual() {
  const val = parseFloat(document.getElementById('my-hours-manual')?.value);
  if (isNaN(val) || val < 0) { toast('Valor inválido', 'error'); return; }
  const dateStr = today();
  DB.setHoursForDay(currentUser.id, dateStr, val);
  const disp = document.getElementById('my-hours-display');
  if (disp) disp.textContent = val + 'h';
  toast(`Horas guardadas: ${val}h`, 'success');
}

function openWithdrawCash() {
  openModal('💸 Sacar Plata de Caja (Retiro)', `
    <p class="text-muted mb-2">Registrá una salida de dinero en efectivo de la caja chica:</p>
    <div class="form-group">
      <label>Monto a Retirar ($)</label>
      <input id="withdraw-amount" type="number" min="1" placeholder="0" style="font-size:24px; font-weight:800; text-align:center;" required autofocus/>
    </div>
    <div class="form-group">
      <label>Descripción / Motivo del Retiro</label>
      <input id="withdraw-desc" type="text" placeholder="Ej: Para pagar flete, comprar cambio, fletes, etc." required/>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="saveWithdrawCash()">Confirmar Retiro 💸</button>
  `);
}

function saveWithdrawCash() {
  const amount = parseFloat(el('withdraw-amount').value)||0;
  const desc = el('withdraw-desc').value.trim();
  if (amount <= 0 || !desc) { toast('Por favor ingresá un monto válido y el motivo del retiro.', 'error'); return; }

  // Check if there is enough cash in the drawer
  const today_str = today();
  const todaySales = DB.getSales().filter(s => s.date.startsWith(today_str) && !s.returned);
  const cashSalesToday = todaySales.reduce((sum, s) => {
    if (s.payType === 'efectivo') return sum + s.totalFinal;
    if (s.payType === 'multi' && s.splitDetails) return sum + (s.splitDetails.cash || 0);
    return sum;
  }, 0);
  const expensesToday = DB.getExpenses().filter(e => e.date.startsWith(today_str)).reduce((sum, e) => sum + e.amount, 0);
  const cashSess = DB.getCashSession(today_str);
  const openingCash = cashSess ? cashSess.openingCash : 0;
  const currentCash = openingCash + cashSalesToday - expensesToday;

  if (amount > currentCash) {
    if (!confirm(`⚠️ Alerta: El monto a retirar (${fmt(amount)}) supera el efectivo estimado disponible en caja (${fmt(currentCash)}). ¿Deseas continuar de todas formas?`)) {
      return;
    }
  }

  DB.addExpense({
    type: 'caja',
    name: `Retiro: ${desc}`,
    amount,
    cashier: currentUser.name
  });

  closeModal();
  toast(`Retiro de ${fmt(amount)} registrado con éxito.`, 'success');
  renderView('view-gastos');
  
  // Also refresh dashboard if it's the active view
  if (el('view-dashboard') && el('view-dashboard').classList.contains('active')) {
    renderView('view-dashboard');
  }
}

function openAddBoxExpense() {
  openModal('Registrar Gasto de Caja', `
    <div class="form-group">
      <label>Concepto del Gasto</label>
      <input id="ge-name" type="text" placeholder="Ej: Artículos de limpieza, Cinta adhesiva, Flete..."/>
    </div>
    <div class="form-group">
      <label>Monto ($)</label>
      <input id="ge-amount" type="number" min="1" placeholder="0"/>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveBoxExpense()">Registrar</button>
  `);
}

function saveBoxExpense() {
  const name = el('ge-name').value.trim();
  const amount = parseFloat(el('ge-amount').value)||0;
  if (!name || amount <= 0) { toast('Campos requeridos y monto válido.','error'); return; }
  
  DB.addExpense({
    type: 'caja',
    name,
    amount,
    cashier: currentUser.name
  });

  closeModal();
  toast('Gasto de caja registrado.','success');
  renderView('view-gastos');
}

function openAddFixedTemplate() {
  openModal('Configurar Servicio Fijo', `
    <div class="form-group">
      <label>Nombre del Servicio / Gasto</label>
      <input id="fe-name" type="text" placeholder="Ej: Alquiler, Luz Aysa, Gas, Internet..."/>
    </div>
    <div class="form-group">
      <label>Monto Estándar Mensual ($)</label>
      <input id="fe-amount" type="number" min="1" placeholder="0"/>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveFixedTemplate()">Guardar</button>
  `);
}

function saveFixedTemplate() {
  const name = el('fe-name').value.trim();
  const amount = parseFloat(el('fe-amount').value)||0;
  if (!name || amount <= 0) { toast('Ingresa un nombre y monto válido.','error'); return; }

  DB.addFixedExpense(name, amount);
  closeModal();
  toast('Servicio fijo configurado.','success');
  renderView('view-gastos');
}

function openEditFixedExpense(id) {
  const f = DB.getFixedExpenses().find(x=>x.id===id);
  if (!f) return;
  openModal('Editar Servicio Fijo', `
    <div class="form-group">
      <label>Concepto</label>
      <input id="efe-name" type="text" value="${f.name}"/>
    </div>
    <div class="form-group">
      <label>Monto ($)</label>
      <input id="efe-amount" type="number" value="${f.amount}"/>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveEditFixed('${id}')">Guardar</button>
  `);
}

function saveEditFixed(id) {
  const name = el('efe-name').value.trim();
  const amount = parseFloat(el('efe-amount').value)||0;
  if (!name || amount <= 0) { toast('Completa todos los campos','error'); return; }
  DB.updateFixedExpense(id, name, amount);
  closeModal();
  toast('Servicio fijo actualizado.','success');
  renderView('view-gastos');
}

function payFixedExpense(id) {
  const f = DB.getFixedExpenses().find(x=>x.id===id);
  if (!f) return;
  
  openModal(`Pagar – ${f.name}`, `
    <p class="text-muted mb-2">Ingresa el monto final de la factura de este mes para <strong>${f.name}</strong>:</p>
    <div class="form-group">
      <label>Monto pagado ($)</label>
      <input id="pay-fixed-amount" type="number" value="${f.amount}" style="font-size:20px; font-weight:700;"/>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="finalizePayFixed('${f.name}')">Marcar Pago ✅</button>
  `);
}

function finalizePayFixed(name) {
  const amount = parseFloat(el('pay-fixed-amount').value)||0;
  if (amount <= 0) { toast('Monto inválido','error'); return; }

  DB.addExpense({
    type: 'fijo',
    name,
    amount,
    cashier: currentUser.name
  });

  closeModal();
  toast(`Pago de ${name} registrado con éxito.`, 'success');
  renderView('view-gastos');
}

function deleteFixedExpenseConfirm(id) {
  if (!confirm('¿Eliminar esta plantilla de servicio fijo?')) return;
  DB.deleteFixedExpense(id);
  toast('Servicio fijo eliminado.','success');
  renderView('view-gastos');
}

function deleteExpenseConfirm(id) {
  if (currentUser.role !== 'jefe') {
    toast('No tenés permisos para eliminar registros históricos de gastos.', 'error');
    return;
  }
  if (!confirm('¿Eliminar este registro de gasto histórico?')) return;
  DB.deleteExpense(id);
  toast('Gasto eliminado.','success');
  renderView('view-gastos');
}

// ══════════════════════════════════════════════════════════
//  HISTORIAL COMPLETO (solo jefes)
// ══════════════════════════════════════════════════════════

const AUDIT_LABELS = {
  sale_create:      { icon: '🛒', label: 'Venta' },
  sale_return:      { icon: '🔄', label: 'Devolución' },
  expense_create:   { icon: '💸', label: 'Gasto' },
  expense_delete:   { icon: '🗑️', label: 'Gasto Eliminado' },
  category_create:  { icon: '🏷️', label: 'Cat. Creada' },
  category_update:  { icon: '✏️', label: 'Cat. Editada' },
  category_delete:  { icon: '🗑️', label: 'Cat. Eliminada' },
  product_create:   { icon: '👗', label: 'Prenda Creada' },
  product_update:   { icon: '✏️', label: 'Prenda Editada' },
  product_delete:   { icon: '🗑️', label: 'Prenda Eliminada' },
  debtor_create:    { icon: '👤', label: 'Deudor Creado' },
  debtor_update:    { icon: '✏️', label: 'Deudor Editado' },
  debtor_delete:    { icon: '🗑️', label: 'Deudor Eliminado' },
  debt_paid:        { icon: '✅', label: 'Deuda Cobrada' },
  hours_adjust:     { icon: '🕐', label: 'Horas Ajust.' },
  cash_open:        { icon: '📥', label: 'Apertura Caja' },
  user_update:      { icon: '👥', label: 'Empleado' },
};

function buildHistoricoAdmin() {
  const allLogs = DB.getAuditLog().slice().reverse();
  const users = DB.getUsers();
  const actionTypes = Object.keys(AUDIT_LABELS);

  const userOptions = users.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
  const typeOptions = actionTypes.map(t => `<option value="${t}">${AUDIT_LABELS[t].icon} ${AUDIT_LABELS[t].label}</option>`).join('');

  return `
  <div class="view-header">
    <h2>🕵️ Historial Completo</h2>
    <p>Registro de absolutamente todos los movimientos del sistema</p>
  </div>

  <div class="card" style="padding:16px 20px; margin-bottom:20px;">
    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:12px; align-items:end;">
      <div class="form-group" style="margin:0;">
        <label style="font-size:12px;">Desde</label>
        <input type="date" id="audit-from" style="font-size:13px;"/>
      </div>
      <div class="form-group" style="margin:0;">
        <label style="font-size:12px;">Hasta</label>
        <input type="date" id="audit-to" style="font-size:13px;"/>
      </div>
      <div class="form-group" style="margin:0;">
        <label style="font-size:12px;">Usuario</label>
        <select id="audit-user" style="font-size:13px;">
          <option value="">Todos</option>
          ${userOptions}
        </select>
      </div>
      <div class="form-group" style="margin:0;">
        <label style="font-size:12px;">Tipo de acción</label>
        <select id="audit-type" style="font-size:13px;">
          <option value="">Todos</option>
          ${typeOptions}
        </select>
      </div>
      <div class="form-group" style="margin:0;">
        <label style="font-size:12px;">Buscar texto</label>
        <input type="text" id="audit-search" placeholder="Palabras clave..." style="font-size:13px;"/>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="applyAuditFilters()">🔍 Filtrar</button>
        <button class="btn btn-ghost btn-sm" onclick="clearAuditFilters()">✕ Limpiar</button>
      </div>
    </div>
  </div>

  <div id="audit-summary" style="margin-bottom:12px; font-size:13px; color:var(--text-3);"></div>

  <div class="table-wrap">
    <table id="audit-table">
      <thead>
        <tr>
          <th>Fecha / Hora</th>
          <th>Usuario</th>
          <th>Tipo</th>
          <th>Descripción</th>
        </tr>
      </thead>
      <tbody id="audit-tbody">
        ${renderAuditRows(allLogs)}
      </tbody>
    </table>
  </div>`;
}

function renderAuditRows(logs) {
  if (!logs.length) return '<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:30px;">Sin registros para mostrar</td></tr>';
  return logs.map(log => {
    const meta = AUDIT_LABELS[log.action] || { icon: '📌', label: log.action };
    return `<tr>
      <td style="white-space:nowrap;font-size:12px;">${fmtDate(log.date)}</td>
      <td><span style="font-weight:600;">${log.userName || '-'}</span></td>
      <td><span class="badge badge-purple" style="font-size:11px;">${meta.icon} ${meta.label}</span></td>
      <td style="font-size:13px;">${log.description}</td>
    </tr>`;
  }).join('');
}

function applyAuditFilters() {
  let logs = DB.getAuditLog().slice().reverse();
  const from   = document.getElementById('audit-from')?.value;
  const to     = document.getElementById('audit-to')?.value;
  const user   = document.getElementById('audit-user')?.value;
  const type   = document.getElementById('audit-type')?.value;
  const search = document.getElementById('audit-search')?.value?.toLowerCase();

  if (from)   logs = logs.filter(l => l.date >= from);
  if (to)     logs = logs.filter(l => l.date.slice(0,10) <= to);
  if (user)   logs = logs.filter(l => l.userName === user);
  if (type)   logs = logs.filter(l => l.action === type);
  if (search) logs = logs.filter(l => l.description.toLowerCase().includes(search));

  const tbody = document.getElementById('audit-tbody');
  if (tbody) tbody.innerHTML = renderAuditRows(logs);
  const summary = document.getElementById('audit-summary');
  if (summary) summary.textContent = `Mostrando ${logs.length} registro(s)`;
}

function clearAuditFilters() {
  ['audit-from','audit-to','audit-user','audit-type','audit-search'].forEach(id => {
    const el2 = document.getElementById(id);
    if (el2) el2.value = '';
  });
  const logs = DB.getAuditLog().slice().reverse();
  const tbody = document.getElementById('audit-tbody');
  if (tbody) tbody.innerHTML = renderAuditRows(logs);
  const summary = document.getElementById('audit-summary');
  if (summary) summary.textContent = '';
}

function bindHistoricoAdmin() {
  // Allow pressing Enter in text search
  const searchInput = document.getElementById('audit-search');
  if (searchInput) {
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') applyAuditFilters(); });
  }
  // Show total on load
  const total = DB.getAuditLog().length;
  const summary = document.getElementById('audit-summary');
  if (summary && total > 0) summary.textContent = `${total} registro(s) en total`;
}

// ─── Auto-login check & Supabase Startup ──────────────────
async function startApp() {
  // Inicializar Supabase y sincronizar la caché local
  await DB.initSupabase();
  DB.seed(); // Garantiza el sembrado si está en modo local o Supabase está vacío
  
  renderNetflixProfiles();
  const session = DB.getSession();
  if (session && session.id) {
    // Verificar si el usuario aún existe
    const user = DB.getUsers().find(u=>u.id===session.id);
    if (user) {
      currentUser = user;
      
      // Auto-registrar horas del cajero si inicia jornada hoy
      if (currentUser.role === 'cajero') {
        const dateStr = today();
        const hoursData = DB.getHours();
        if (!hoursData[currentUser.id] || hoursData[currentUser.id][dateStr] === undefined) {
          const defaultHours = currentUser.defaultHours || 3.5;
          DB.setHoursForDay(currentUser.id, dateStr, defaultHours);
          toast(`Se cargaron automáticamente tus ${defaultHours} hs del día de hoy.`, 'success');
        }
      }
      
      initApp();
      return;
    }
  }
  showPage('page-login');
}
startApp();
