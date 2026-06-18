/* ═══════════════════════════════════════
   5inco Store – App Logic
   ═══════════════════════════════════════ */

// ─── Init ─────────────────────────────────────────────────
// Supabase y seed se inicializan asíncronamente al final en startApp()

let currentUser = null;
let cart = [];        // [{ product, qty, discount }]
let salePayType = 'efectivo';
let saleDebtorId = null;

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
    
    // Auto-register default hours if cashier logs in
    if (currentUser.role === 'cajero') {
      const dateStr = today();
      const hoursData = DB.getHours();
      if (!hoursData[currentUser.id] || hoursData[currentUser.id][dateStr] === undefined) {
        const defaultHours = currentUser.defaultHours || 8;
        DB.setHoursForDay(currentUser.id, dateStr, defaultHours);
        toast(`Se cargaron automáticamente tus ${defaultHours} hs del día de hoy.`, 'success');
      }
    }
    
    // Intercept with Cash Box Opening balance if not set for today
    const dateStr = today();
    const cashSess = DB.getCashSession(dateStr);
    
    if (!cashSess) {
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
  }
  
  const ventasItems = [
    { view: 'view-venta',  icon: '🛒', label: 'Nueva Venta' },
    { view: 'view-historial', icon: '📋', label: 'Historial' },
  ];
  if (!jefe) {
    ventasItems.push({ view: 'view-gastos', icon: '💸', label: 'Caja y Retiros' });
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
    <div class="view" id="view-dashboard">${buildDashboard()}</div>
    <div class="view" id="view-empleados"></div>
    <div class="view" id="view-stock"></div>
    <div class="view" id="view-categorias"></div>
    ` : ''}
    <div class="view" id="view-gastos"></div>
    <div class="view" id="view-venta"></div>
    <div class="view" id="view-historial"></div>
    <div class="view" id="view-deudores"></div>
  `;
  // Render all views
  const views = ['view-venta','view-historial','view-deudores', 'view-gastos'];
  if (currentUser.role === 'jefe') views.push('view-empleados','view-stock','view-categorias');
  views.forEach(v => renderView(v));
}

function renderView(v) {
  const el2 = el(v);
  if (!el2) return;
  switch(v) {
    case 'view-dashboard':  el2.innerHTML = buildDashboard(); bindDashboard(); break;
    case 'view-empleados':  el2.innerHTML = buildEmpleados(); bindEmpleados(); break;
    case 'view-stock':      el2.innerHTML = buildStock(); bindStock(); break;
    case 'view-categorias': el2.innerHTML = buildCategorias(); bindCategorias(); break;
    case 'view-venta':      el2.innerHTML = buildVenta(); bindVenta(); break;
    case 'view-historial':  el2.innerHTML = buildHistorial(); break;
    case 'view-deudores':   el2.innerHTML = buildDeudores(); bindDeudores(); break;
    case 'view-gastos':     el2.innerHTML = buildGastos(); bindGastos(); break;
  }
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════
function buildDashboard() {
  const sales = DB.getSales();
  const today_str = today();
  const todaySales = sales.filter(s => s.date.startsWith(today_str) && !s.returned);
  
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
  <div class="view-header">
    <h2>📊 Dashboard</h2>
    <p>Resumen del negocio – ${new Date().toLocaleDateString('es-AR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
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
function bindDashboard() {}

// ══════════════════════════════════════════════════════════
//  EMPLEADOS
// ══════════════════════════════════════════════════════════
function buildEmpleados() {
  const users = DB.getUsers().filter(u => u.role === 'cajero');
  const now = new Date();
  const year = now.getFullYear(); const month = now.getMonth()+1;

  let rows = users.map(u => {
    const salary = DB.calcSalary(u.id, year, month);
    const monthDays = getMonthDays(year, month);
    const hoursData = DB.getHoursForMonth(u.id, year, month);
    const totalHours = Object.values(hoursData).reduce((a,b)=>a+b,0);
    return `
    <tr>
      <td><div class="flex-row"><div class="user-avatar" style="width:34px;height:34px;font-size:12px">${initials(u.name)}</div>${u.name}</div></td>
      <td>${fmt(u.salaryHour||0)}/h</td>
      <td>${u.defaultHours||0}h/día</td>
      <td>${totalHours}h</td>
      <td class="text-green">${fmt(salary)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openEmpleadoEdit('${u.id}')">✏️ Editar</button>
        <button class="btn btn-secondary btn-sm" onclick="openHorasEmpleado('${u.id}')">🕐 Horas</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="view-header">
    <h2>👥 Empleados</h2>
    <p>Gestión de sueldos y horas trabajadas</p>
    <div class="view-actions">
      <button class="btn btn-primary" onclick="openNuevoEmpleado()">➕ Nuevo empleado</button>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Nombre</th><th>Sueldo/hora</th><th>Hs. por día</th><th>Hs. este mes</th><th>Sueldo del mes</th><th>Acciones</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-3)">Sin empleados</td></tr>'}</tbody>
    </table>
  </div>`;
}

function bindEmpleados() {}

function openNuevoEmpleado() {
  openModal('Nuevo Empleado', `
    <div class="form-group"><label>Nombre completo</label><input id="emp-name" type="text" placeholder="Nombre apellido"/></div>
    <div class="form-group"><label>Usuario</label><input id="emp-user" type="text" placeholder="usuario"/></div>
    <div class="form-group"><label>Contraseña</label><input id="emp-pass" type="password" placeholder="••••••"/></div>
    <div class="form-row cols-2">
      <div class="form-group"><label>Sueldo por hora ($)</label><input id="emp-salary" type="number" placeholder="0"/></div>
      <div class="form-group"><label>Horas por día</label><input id="emp-hours" type="number" placeholder="8"/></div>
    </div>
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
  const defaultHours = parseFloat(el('emp-hours').value)||8;
  if (!name || !username || !password) { toast('Completa todos los campos requeridos.','error'); return; }
  const users = DB.getUsers();
  if (users.find(u=>u.username===username)) { toast('Ya existe ese usuario.','error'); return; }
  const newUser = { id: DB.id(), name, username, password, role: 'cajero', salaryHour, defaultHours };
  users.push(newUser); DB.saveUsers(users);
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
      <div class="form-group"><label>Horas por día</label><input id="ee-hours" type="number" value="${u.defaultHours||8}"/></div>
    </div>
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
  const defaultHours = parseFloat(el('ee-hours').value)||8;
  if (!name) { toast('El nombre es requerido.','error'); return; }
  users[idx] = { ...users[idx], name, salaryHour, defaultHours };
  if (pass) users[idx].password = pass;
  DB.saveUsers(users);
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
  const defaultH = u.defaultHours || 8;
  const monthName = new Date(year,month-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
  const todayStr = today();

  let daysHtml = '';
  for (let d = 1; d <= monthDays; d++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const dow = new Date(dateStr).toLocaleDateString('es-AR',{weekday:'short'});
    const hrs = hoursData[dateStr] !== undefined ? hoursData[dateStr] : defaultH;
    daysHtml += `
    <div class="day-box ${isToday?'today':''}" onclick="editDayHours('${userId}','${dateStr}',${hrs},${defaultH})">
      <div class="day-name">${dow} ${d}</div>
      <div class="day-hours">${hrs}</div>
    </div>`;
  }

  const totalHours = Object.values(hoursData).reduce((a,b)=>a+b,0)
    || (monthDays * defaultH);
  const salary = DB.calcSalary(userId, year, month) || (monthDays * defaultH * (u.salaryHour||0));

  const prevMonth = month===1 ? [year-1,12] : [year,month-1];
  const nextMonth = month===12? [year+1,1]  : [year,month+1];

  openModal(`🕐 Horas – ${u.name}`, `
    <div class="flex-row mb-2">
      <button class="btn btn-ghost btn-sm" onclick="renderHorasModal('${userId}',${prevMonth[0]},${prevMonth[1]})">◀</button>
      <span style="flex:1;text-align:center;font-weight:700">${monthName}</span>
      <button class="btn btn-ghost btn-sm" onclick="renderHorasModal('${userId}',${nextMonth[0]},${nextMonth[1]})">▶</button>
    </div>
    <div class="hours-grid">${daysHtml}</div>
    <div class="divider"></div>
    <div class="flex-row">
      <div><span class="text-muted">Total horas:</span> <strong>${totalHours}h</strong></div>
      <div class="ml-auto"><span class="text-muted">Sueldo estimado:</span> <strong class="text-green">${fmt(totalHours*(u.salaryHour||0))}</strong></div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`);
}

function editDayHours(userId, dateStr, currentHours, defaultHours) {
  const day = new Date(dateStr).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
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
function buildStock() {
  const prods = DB.getProducts();
  const cats = DB.getCategories();
  const catMap = Object.fromEntries(cats.map(c=>[c.id,c.name]));

  const filterBar = `
    <div class="cat-filters" id="stock-cat-filters">
      <div class="cat-filter active" data-cat="all">Todas</div>
      ${cats.map(c=>`<div class="cat-filter" data-cat="${c.id}">${c.name}</div>`).join('')}
    </div>`;

  const rows = prods.map(p=>`
    <tr data-cat="${p.categoryId}">
      <td>${p.name}</td>
      <td>${catMap[p.categoryId]||'-'}</td>
      <td>${p.talle||'—'}</td>
      <td>${fmt(p.price)}</td>
      <td><span class="badge ${p.stock<=2?'badge-red':p.stock<=5?'badge-yellow':'badge-green'}">${p.stock}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openEditProduct('${p.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">🗑️</button>
      </td>
    </tr>`).join('');

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
      <thead><tr><th>Prenda</th><th>Categoría</th><th>Talle</th><th>Precio</th><th>Stock</th><th>Acciones</th></tr></thead>
      <tbody id="stock-tbody">${rows||'<tr><td colspan="6" style="text-align:center;color:var(--text-3)">Sin prendas</td></tr>'}</tbody>
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

function openNewProduct(prefillCatId) {
  const cats = DB.getCategories();
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
    <div class="form-row cols-2">
      <div class="form-group"><label>Precio ($)</label><input id="np-price" type="number" placeholder="0"/></div>
      <div class="form-group"><label>Stock inicial</label><input id="np-stock" type="number" placeholder="0"/></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveNewProduct()">Guardar</button>
  `);
  el('np-cat').addEventListener('change', function() {
    if (this.value === '__new__') {
      const name = prompt('Nombre de la nueva categoría:');
      if (name && name.trim()) {
        const cat = DB.addCategory(name.trim());
        this.innerHTML += `<option value="${cat.id}" selected>${cat.name}</option>`;
        this.value = cat.id;
        toast('Categoría creada.','success');
      } else { this.value = ''; }
    }
  });
}

function saveNewProduct() {
  const name = el('np-name').value.trim();
  const categoryId = el('np-cat').value;
  const talle = el('np-talle').value.trim();
  const price = parseFloat(el('np-price').value)||0;
  const stock = parseInt(el('np-stock').value)||0;
  if (!name || !categoryId) { toast('Nombre y categoría son requeridos.','error'); return; }
  DB.addProduct({ name, categoryId, talle, price, stock });
  closeModal(); toast('Prenda agregada.','success');
  renderView('view-stock');
}

function openEditProduct(id) {
  const p = DB.getProducts().find(x=>x.id===id);
  if (!p) return;
  const cats = DB.getCategories();
  const catOpts = cats.map(c=>`<option value="${c.id}" ${c.id===p.categoryId?'selected':''}>${c.name}</option>`).join('');
  openModal('Editar Prenda', `
    <div class="form-group"><label>Nombre</label><input id="ep-name" type="text" value="${p.name}"/></div>
    <div class="form-row cols-2">
      <div class="form-group"><label>Categoría</label>
        <select id="ep-cat">${catOpts}</select>
      </div>
      <div class="form-group"><label>Talle</label><input id="ep-talle" type="text" value="${p.talle||''}"/></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label>Precio ($)</label><input id="ep-price" type="number" value="${p.price}"/></div>
      <div class="form-group"><label>Stock</label><input id="ep-stock" type="number" value="${p.stock}"/></div>
    </div>
  `, `
    <button class="btn btn-danger" style="margin-right: auto;" onclick="deleteProduct('${id}'); closeModal();">🗑️ Eliminar</button>
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveEditProduct('${id}')">Guardar</button>
  `);
}
function saveEditProduct(id) {
  const name = el('ep-name').value.trim();
  const categoryId = el('ep-cat').value;
  const talle = el('ep-talle').value.trim();
  const price = parseFloat(el('ep-price').value)||0;
  const stock = parseInt(el('ep-stock').value)||0;
  if (!name) { toast('El nombre es requerido.','error'); return; }
  DB.updateProduct(id, { name, categoryId, talle, price, stock });
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
    return `
    <div class="product-card" data-id="${p.id}" data-cat="${p.categoryId}" onclick="addToCart('${p.id}')">
      <button class="btn btn-ghost btn-sm btn-icon" onclick="event.stopPropagation(); openEditProductFromVenta('${p.id}')" style="position: absolute; top: 8px; right: 8px; font-size: 11px; z-index: 10; opacity: 0.7;" title="Editar Prenda">✏️</button>
      <div class="product-cat">${cat?.name||'Sin categoría'}</div>
      <div class="product-name" style="padding-right: 20px;">${p.name}</div>
      ${p.talle ? `<div class="product-talle">Talle: ${p.talle}</div>` : ''}
      <div class="product-price">${fmt(p.price)}</div>
      <div class="product-stock">Stock: ${p.stock}</div>
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
                  ${DB.getDebtors().map(d=>`<option value="${d.id}">${d.name} (+${d.surcharge}%)</option>`).join('')}
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

function addToCart(productId) {
  const p = DB.getProducts().find(x=>x.id===productId);
  if (!p) return;
  if (p.stock <= 0) { toast('Sin stock disponible.','error'); return; }
  const existing = cart.find(c=>c.productId===productId);
  if (existing) {
    if (existing.qty >= p.stock) { toast('Stock máximo alcanzado.','error'); return; }
    existing.qty++;
  } else {
    cart.push({ productId, qty: 1 });
  }
  renderCartItems();
  // Visual feedback
  const card = document.querySelector(`.product-card[data-id="${productId}"]`);
  if (card) { card.classList.add('selected'); setTimeout(()=>card.classList.remove('selected'),600); }
  toast(`${p.name} agregado al carrito.`, 'success');
}

function removeFromCart(productId) {
  cart = cart.filter(c=>c.productId!==productId);
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
    return `
    <div class="cart-item">
      <div style="flex:1">
        <div class="cart-item-name">${p.name}</div>
        <div style="font-size:11px;color:var(--text-3)">${p.talle||''}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="changeQty('${c.productId}',-1)">−</button>
          <span style="font-size:13px;font-weight:600;min-width:20px;text-align:center">${c.qty}</span>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="changeQty('${c.productId}',1)">+</button>
        </div>
      </div>
      <div style="text-align:right">
        <div class="cart-item-price">${fmt(p.price*c.qty)}</div>
        <button class="cart-item-remove" onclick="removeFromCart('${c.productId}')">×</button>
      </div>
    </div>`;
  }).join('');
  if (count) count.textContent = cart.reduce((a,c)=>a+c.qty,0);
  updateCartTotals();
}

function changeQty(productId, delta) {
  const item = cart.find(c=>c.productId===productId);
  if (!item) return;
  const p = DB.getProducts().find(x=>x.id===productId);
  item.qty = Math.max(1, Math.min(item.qty + delta, p?.stock||99));
  renderCartItems();
}

function updateCartTotals() {
  const prods = DB.getProducts();
  const sub = cart.reduce((a,c) => { const p = prods.find(x=>x.id===c.productId); return a+(p?p.price*c.qty:0); }, 0);
  const disc = parseFloat(el('cart-discount')?.value||0);
  const discAmt = sub * (disc/100);
  const total = sub - discAmt;
  if (el('ct-sub'))  el('ct-sub').textContent = fmt(sub);
  if (el('ct-disc')) el('ct-disc').textContent = `-${fmt(discAmt)}`;
  if (el('ct-total')) el('ct-total').textContent = fmt(total);
}

function selectPay(type) {
  // Obsolete - Split/Multi pay is now the standard default view
}

function calculateDirectChange() {
  // Replaced by inline calculations in validateSplitAmounts
}

function toggleMultiPay(enabled) {
  // Obsolete - Split/Multi pay is now permanent
}

function updateCartTotals() {
  const prods = DB.getProducts();
  const sub = cart.reduce((a,c) => { const p = prods.find(x=>x.id===c.productId); return a+(p?p.price*c.qty:0); }, 0);
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
  const sub = cart.reduce((a,c)=>{ const p=prods.find(x=>x.id===c.productId); return a+(p?p.price*c.qty:0); },0);
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
  const cats = DB.getCategories();
  const catOpts = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  openModal('➕ Crear producto rápido', `
    <p class="text-muted" style="font-size:13px; margin-bottom:14px;">Creá el producto y se agregará automáticamente al carrito.</p>
    <div class="form-group">
      <label>Nombre del producto</label>
      <input id="qp-name" type="text" placeholder="Ej: Remera blanca talle M" autofocus/>
    </div>
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
    <div id="qp-newcat-container" style="display:none;" class="form-group">
      <label>Nombre de nueva categoría</label>
      <input id="qp-newcat-name" type="text" placeholder="Ej: Pantalones"/>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveQuickProductFromVenta()">✅ Crear y agregar al carrito</button>
  `);

  // Show/hide new category field on select change
  setTimeout(() => {
    const catSel = el('qp-cat');
    if (catSel) {
      catSel.addEventListener('change', function() {
        const newCatContainer = el('qp-newcat-container');
        if (this.value === '__new__') {
          newCatContainer.style.display = 'block';
          el('qp-newcat-name').focus();
        } else {
          newCatContainer.style.display = 'none';
        }
      });
    }
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
  const sub = cart.reduce((a,c)=>{ const p=prods.find(x=>x.id===c.productId); return a+(p?p.price*c.qty:0); },0);
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
    return { productId: c.productId, name: p?.name, price: p?.price, qty: c.qty };
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
    return { productId: c.productId, name: p?.name, price: p?.price, qty: c.qty };
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
  const sales = DB.getSales().slice().reverse();
  const todayVal = today();
  
  // Get date range inputs or defaults
  const fromDate = window._historialFromDate || '';
  const toDate = window._historialToDate || '';

  const filteredSales = sales.filter(s => {
    const sDate = s.date.slice(0, 10);
    if (fromDate && sDate < fromDate) return false;
    if (toDate && sDate > toDate) return false;
    return true;
  });

  const rows = filteredSales.map(s => {
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
    
    return `<tr style="${isReturned ? 'opacity: 0.6;' : ''}">
      <td>${fmtDate(s.date)}</td>
      <td>
        ${s.items?.map(i=>`${i.name} x${i.qty}`).join(', ')}
        ${isReturned ? '<span class="return-item-badge">Devolución</span>' : ''}
      </td>
      <td>${s.cashier||'-'}</td>
      <td>${payBadge}${debtor?` <small class="text-muted">${debtor.name}</small>`:''}</td>
      <td>${s.discountPct>0?`<span class="text-green">-${s.discountPct}%</span>`:'-'}</td>
      <td class="text-accent" style="font-weight:700">${fmt(s.totalFinal)}</td>
      <td>
        ${!isReturned ? `<button class="btn btn-danger btn-sm btn-icon" onclick="processReturn('${s.id}')" title="Procesar Devolución/Cambio">🔄</button>` : '—'}
      </td>
    </tr>`;
  }).join('');

  const total = filteredSales.reduce((a,s)=>a+(s.returned?0:s.totalFinal),0);
  
  return `
  <div class="view-header">
    <h2>📋 Historial de Ventas</h2>
    <p>${filteredSales.length} venta(s) mostrada(s) · Recaudado neto: <strong class="text-green">${fmt(total)}</strong></p>
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

function processReturn(saleId) {
  const sale = DB.getSales().find(s=>s.id===saleId);
  if (!sale) return;

  openModal('Devolución y Cambio', `
    <p class="text-muted mb-2">Estás procesando el cambio de la siguiente venta:</p>
    <div style="background:var(--bg3);padding:12px;border-radius:var(--r-sm);border:1px solid var(--border);margin-bottom:14px;">
      <strong>Fecha:</strong> ${fmtDate(sale.date)}<br/>
      <strong>Cajero:</strong> ${sale.cashier}<br/>
      <strong>Total pagado:</strong> <span class="text-accent">${fmt(sale.totalFinal)}</span>
    </div>
    <div class="form-group">
      <label>¿Qué deseas hacer?</label>
      <select id="return-action" onchange="toggleReturnActionUi(this.value)">
        <option value="refund">Devolución total (Anulación y devolución de stock)</option>
        <option value="exchange">Cambio de prenda (Generar saldo a favor/diferencia)</option>
      </select>
    </div>
    <div id="exchange-ui" style="display:none;">
      <div class="form-group">
        <label>Seleccionar nueva prenda para el cambio</label>
        <select id="exchange-product-select">
          <option value="">Seleccionar prenda...</option>
          ${DB.getProducts().map(p=>`<option value="${p.id}">${p.name} (${fmt(p.price)}) [Talle ${p.talle||'-'}]</option>`).join('')}
        </select>
      </div>
      <p style="font-size:12px;" class="text-muted">Si la prenda nueva es más cara se cobrará la diferencia; si es más barata quedará como saldo o descuento a favor.</p>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="finalizeReturn('${saleId}')">Procesar 🔄</button>
  `);
}

function toggleReturnActionUi(action) {
  const exUi = el('exchange-ui');
  if (exUi) exUi.style.display = action === 'exchange' ? 'block' : 'none';
}

function finalizeReturn(saleId) {
  const sale = DB.getSales().find(s=>s.id===saleId);
  if (!sale) return;
  
  const action = el('return-action').value;
  const prods = DB.getProducts();

  // Restore old items stock
  sale.items?.forEach(item => {
    const p = prods.find(x=>x.id===item.productId);
    if (p) DB.updateProduct(p.id, { stock: p.stock + item.qty });
  });

  // Mark sale as returned
  DB.updateSale(saleId, { returned: true });

  if (action === 'refund') {
    // If it was a debtor sale, eliminate debt
    if (sale.payType === 'deudor' && sale.debtorId) {
      const debts = DB.getDebts();
      const sDebt = debts.find(d=>d.saleId === saleId && !d.paid);
      if (sDebt) DB.payDebt(sDebt.id); // Mark paid as refund
    }
    toast('Venta anulada y stock devuelto con éxito.','success');
  } else if (action === 'exchange') {
    const newProductId = el('exchange-product-select').value;
    if (!newProductId) { toast('Selecciona la nueva prenda','error'); return; }
    
    const newProduct = prods.find(x=>x.id===newProductId);
    if (!newProduct) return;
    if (newProduct.stock <= 0) { toast('Sin stock disponible de la prenda nueva.','error'); return; }

    const originalPayed = sale.totalFinal;
    const newPrice = newProduct.price;
    const diff = newPrice - originalPayed;

    // Deduct stock of new product
    DB.updateProduct(newProduct.id, { stock: newProduct.stock - 1 });

    if (diff > 0) {
      // Customer has to pay difference
      // Open a secondary fast checkout for difference
      closeModal();
      setTimeout(() => {
        openFastDifferenceCheckout(sale, newProduct, diff);
      }, 300);
      return;
    } else {
      // Difference is negative or zero, simple exchange
      DB.addSale({
        items: [{ productId: newProduct.id, name: newProduct.name, price: newProduct.price, qty: 1 }],
        subtotal: newProduct.price,
        discountPct: 0,
        discountAmt: 0,
        surcharge: 0,
        totalFinal: 0, // simple exchange under credit
        payType: 'efectivo',
        cashier: currentUser.name,
        exchangeRef: saleId
      });
      toast('Cambio procesado sin costos adicionales.','success');
    }
  }
  
  closeModal();
  renderView('view-historial');
}

function openFastDifferenceCheckout(oldSale, newProduct, diff) {
  openModal('Cobrar Diferencia de Cambio', `
    <p class="text-muted mb-2">El nuevo producto es más caro que el original por <strong>${fmt(diff)}</strong>.</p>
    <div class="form-group">
      <label>Método de pago de la diferencia</label>
      <select id="diff-pay-type" onchange="toggleDiffDebtor(this.value)">
        <option value="efectivo">💵 Efectivo</option>
        <option value="debito">💳 Débito/Crédito</option>
        <option value="deudor">📋 Deudor</option>
      </select>
    </div>
    <div id="diff-debtor-area" style="display:none;">
      <div class="form-group">
        <label>Seleccionar Deudor</label>
        <select id="diff-debtor-select">
          ${DB.getDebtors().map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="finalizeExchangeDiff('${oldSale.id}','${newProduct.id}',${diff})">Cobrar y Terminar ✅</button>
  `);
}

function toggleDiffDebtor(val) {
  el('diff-debtor-area').style.display = val === 'deudor' ? 'block' : 'none';
}

function finalizeExchangeDiff(oldSaleId, newProductId, diff) {
  const payType = el('diff-pay-type').value;
  const debtorId = payType === 'deudor' ? el('diff-debtor-select').value : null;

  const newProduct = DB.getProducts().find(x=>x.id===newProductId);

  const sale = DB.addSale({
    items: [{ productId: newProductId, name: newProduct.name, price: newProduct.price, qty: 1 }],
    subtotal: newProduct.price,
    discountPct: 0,
    discountAmt: 0,
    surcharge: 0,
    totalFinal: diff,
    payType,
    debtorId,
    cashier: currentUser.name,
    exchangeRef: oldSaleId
  });

  if (payType === 'deudor' && debtorId) {
    DB.addDebt({ debtorId, saleId: sale.id, amount: diff });
  }

  closeModal();
  toast('¡Cambio y diferencia procesados!','success');
  renderView('view-historial');
}

// ══════════════════════════════════════════════════════════
//  DEUDORES
// ══════════════════════════════════════════════════════════
function buildDeudores() {
  const debtors = DB.getDebtors().sort((a,b) => a.name.localeCompare(b.name));
  const debts = DB.getDebts();

  const cards = debtors.map(d => {
    const balance = DB.getDebtorBalance(d.id);
    const dDebts = debts.filter(x=>x.debtorId===d.id && !x.paid);
    return `
    <div class="debtor-card" data-name="${d.name.toLowerCase()}">
      <div class="debtor-avatar">${initials(d.name)}</div>
      <div class="debtor-info">
        <div class="debtor-name">${d.name}</div>
        <div class="debtor-phone">${d.phone||'Sin teléfono'} · Recargo: ${d.surcharge}%</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:2px">${dDebts.length} deuda(s) pendiente(s)</div>
      </div>
      <div style="text-align:right">
        <div class="debtor-debt">${fmt(balance)}</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-secondary btn-sm" onclick="openDebtorDetail('${d.id}')">Ver</button>
          <button class="btn btn-ghost btn-sm" onclick="openEditDebtor('${d.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDebtorConfirm('${d.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');

  const totalDebt = debtors.reduce((sum,d)=>sum+DB.getDebtorBalance(d.id),0);
  return `
  <div class="view-header">
    <h2>💳 Lista de Deudores</h2>
    <p>${debtors.length} deudor(es) · Deuda total: <strong class="text-red">${fmt(totalDebt)}</strong></p>
    <div class="view-actions">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="deudores-search" placeholder="Buscar deudor...">
      </div>
      <button class="btn btn-primary" onclick="openNewDebtorModal()">➕ Nuevo deudor</button>
    </div>
  </div>
  <div id="deudores-list">
    ${cards || '<div class="empty-state"><div class="empty-icon">💳</div><p>No hay deudores registrados.</p></div>'}
  </div>`;
}

function bindDeudores() {
  const searchInput = el('deudores-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value.toLowerCase();
      document.querySelectorAll('#deudores-list .debtor-card').forEach(card => {
        const name = card.dataset.name;
        if (name.includes(val)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }
}

function openDebtorDetail(id) {
  const debtor = DB.getDebtors().find(d=>d.id===id);
  if (!debtor) return;
  const debts = DB.getDebts().filter(d=>d.debtorId===id);
  const balance = DB.getDebtorBalance(id);
  const rows = debts.map(debt => {
    return `<tr>
      <td>${fmtDate(debt.date)}</td>
      <td>${fmt(debt.amount)}</td>
      <td><span class="badge ${debt.paid?'badge-green':'badge-red'}">${debt.paid?'Pagado':'Pendiente'}</span></td>
      <td>${!debt.paid?`<button class="btn btn-success btn-sm" onclick="payDebt('${debt.id}','${id}')">✅ Marcar pagado</button>`:fmtDate(debt.paidDate)}</td>
    </tr>`;
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
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Monto</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="4" style="text-align:center;color:var(--text-3)">Sin deudas registradas</td></tr>'}</tbody>
      </table>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`);
}

function payDebt(debtId, debtorId) {
  DB.payDebt(debtId);
  toast('Deuda marcada como pagada.','success');
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
    <div class="form-group"><label>Agregar deuda (Opcional)</label><input id="ed-add-debt" type="number" placeholder="Monto a sumar" min="0"/></div>
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
  
  if (!name) { toast('El nombre es requerido.','error'); return; }
  DB.updateDebtor(id, { name, phone, surcharge });
  
  if (newDebt > 0) {
    DB.addDebt({ debtorId: id, amount: newDebt });
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
  </div>`;
}

function bindGastos() {}

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
          const defaultHours = currentUser.defaultHours || 8;
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
