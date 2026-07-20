/* ═══════════════════════════════════════
   5inco Store – Data Layer (Supabase & LocalStorage)
   ═══════════════════════════════════════ */

const DB = {
  // ── Supabase Configuration ────────────
  SUPABASE_URL: 'https://oiyviypyaqocfnzcyjsn.supabase.co',
  SUPABASE_KEY: 'sb_publishable_y07f9bN1fLQ8_jCY-cFvyQ_s7YPylH0',
  supabase: null,
  isSynced: false,

  // ── Keys ──────────────────────────────
  KEYS: {
    users:      '5inco_users',
    categories: '5inco_categories',
    products:   '5inco_products',
    sales:      '5inco_sales',
    debtors:    '5inco_debtors',
    debts:      '5inco_debts',
    hours:      '5inco_hours',
    session:    '5inco_session',
    expenses:   '5inco_expenses',
    fixedExpenses:'5inco_fixed_expenses',
    cashSession: '5inco_cash_session',
    audit:      '5inco_audit',
  },

  // ── Generic helpers ───────────────────
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },
  getObj(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch { return {}; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
  id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

  // ── Supabase Init and Synchronization ──
  async initSupabase() {
    if (!this.SUPABASE_URL || !this.SUPABASE_KEY) {
      console.warn('Supabase: Claves no configuradas. Iniciando en modo local (localStorage).');
      return false;
    }
    try {
      if (typeof supabase === 'undefined') {
        console.error('Supabase SDK no está cargado. Asegúrate de incluir el script CDN.');
        return false;
      }
      this.supabase = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
      
      const overlay = document.getElementById('supabase-loading-overlay');
      if (overlay) overlay.style.display = 'flex';

      // Cargar todas las tablas en paralelo
      const [
        { data: users, error: errUsers },
        { data: categories, error: errCats },
        { data: products, error: errProds },
        { data: debtors, error: errDebtors },
        { data: debts, error: errDebts },
        { data: sales, error: errSales },
        { data: expenses, error: errExpenses },
        { data: fixedExpenses, error: errFixedExpenses },
        { data: hours, error: errHours },
        { data: cashSessions, error: errCashSessions }
      ] = await Promise.all([
        this.supabase.from('users').select('*'),
        this.supabase.from('categories').select('*'),
        this.supabase.from('products').select('*'),
        this.supabase.from('debtors').select('*'),
        this.supabase.from('debts').select('*'),
        this.supabase.from('sales').select('*'),
        this.supabase.from('expenses').select('*'),
        this.supabase.from('fixed_expenses').select('*'),
        this.supabase.from('hours').select('*'),
        this.supabase.from('cash_sessions').select('*')
      ]);

      if (errUsers || errCats || errProds || errDebtors || errDebts || errSales || errExpenses || errFixedExpenses || errHours || errCashSessions) {
        console.error('Error cargando datos de Supabase:', { errUsers, errCats, errProds, errDebtors, errDebts, errSales, errExpenses, errFixedExpenses, errHours, errCashSessions });
        throw new Error('Error al consultar tablas de Supabase');
      }

      // Si la base de datos está vacía, sembramos datos iniciales
      if (!users || users.length === 0) {
        console.log('Base de datos vacía. Sembrando datos iniciales...');
        await this.seedSupabase();
        if (overlay) overlay.style.display = 'none';
        return true;
      }

      // Mapear y actualizar la caché local
      this.set(this.KEYS.users, users.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        password: u.password,
        role: u.role,
        salaryHour: Number(u.salary_hour || 0),
        defaultHours: Number(u.default_hours || 3.5),
        commissionPct: Number(u.commission_pct || 0)
      })));

      this.set(this.KEYS.categories, categories);
      
      this.set(this.KEYS.products, products.map(p => ({
        id: p.id,
        name: p.name,
        categoryId: p.category_id,
        price: Number(p.price || 0),
        talle: p.talle,
        stock: Number(p.stock || 0),
        variants: p.variants || []
      })));

      this.set(this.KEYS.debtors, debtors);

      this.set(this.KEYS.debts, debts.map(d => ({
        id: d.id,
        debtorId: d.debtor_id,
        amount: Number(d.amount || 0),
        paid: d.paid,
        date: d.date,
        paidDate: d.paid_date,
        saleId: d.sale_id,
        detail: d.detail || null
      })));

      this.set(this.KEYS.sales, sales.map(s => ({
        id: s.id,
        date: s.date,
        totalFinal: Number(s.total_final || 0),
        payType: s.pay_type,
        splitDetails: s.split_details,
        returned: s.returned,
        ...(s.details || {})
      })));

      this.set(this.KEYS.expenses, expenses);

      this.set(this.KEYS.fixedExpenses, fixedExpenses);

      // Reconstruir horas { userId: { 'YYYY-MM-DD': hs } }
      const hoursObj = {};
      hours.forEach(h => {
        if (!hoursObj[h.user_id]) hoursObj[h.user_id] = {};
        hoursObj[h.user_id][h.date] = Number(h.hours || 0);
      });
      this.set(this.KEYS.hours, hoursObj);

      // Reconstruir sesiones de caja { dateStr: session }
      const cashSessionsObj = {};
      cashSessions.forEach(cs => {
        cashSessionsObj[cs.date] = {
          openingCash: Number(cs.opening_cash || 0),
          active: cs.active,
          openedBy: cs.opened_by,
          openedAt: cs.opened_at
        };
      });
      this.set(this.KEYS.cashSession, cashSessionsObj);

      localStorage.setItem('5inco_seeded', '2');
      this.isSynced = true;
      console.log('Sincronización exitosa con Supabase.');
      if (overlay) overlay.style.display = 'none';
      return true;
    } catch (e) {
      console.error('Fallo en sincronización con Supabase. Usando caché local.', e);
      const overlay = document.getElementById('supabase-loading-overlay');
      if (overlay) overlay.style.display = 'none';
      return false;
    }
  },

  async seedSupabase() {
    const users = [
      { id: 'u1', name: 'Andrea Tuta', username: 'andrea', password: '2812', role: 'jefe' },
      { id: 'u2', name: 'Tomy',        username: 'tomy',   password: '2812', role: 'cajero', salary_hour: 800, default_hours: 3.5 },
      { id: 'u3', name: 'Flor',        username: 'flor',   password: '2812', role: 'cajero', salary_hour: 800, default_hours: 3.5 },
    ];
    const categories = [
      { id: 'c1', name: 'Remeras' },
      { id: 'c2', name: 'Pantalones' },
      { id: 'c3', name: 'Vestidos' },
      { id: 'c4', name: 'Accesorios' },
    ];
    const products = [
      { id: 'p1', name: 'Remera Básica Blanca', category_id: 'c1', price: 3500, talle: 'M',  stock: 10 },
      { id: 'p2', name: 'Remera Estampada',      category_id: 'c1', price: 4200, talle: 'L',  stock: 5  },
      { id: 'p3', name: 'Jean Skinny',            category_id: 'c2', price: 12000, talle: '38', stock: 7 },
      { id: 'p4', name: 'Vestido Floral',         category_id: 'c3', price: 8500, talle: 'S',  stock: 3  },
    ];
    const debtors = [
      { id: 'd1', name: 'María González', phone: '11-2345-6789', surcharge: 10 },
      { id: 'd2', name: 'Laura Pérez',    phone: '11-8765-4321', surcharge: 10 },
    ];
    const fixedExpenses = [
      { id: 'f1', name: 'Alquiler', amount: 150000 },
      { id: 'f2', name: 'Luz (Edesur)', amount: 25000 },
      { id: 'f3', name: 'Agua (AySA)', amount: 8000 },
      { id: 'f4', name: 'Internet/Tel', amount: 12000 }
    ];

    try {
      await Promise.all([
        this.supabase.from('users').insert(users),
        this.supabase.from('categories').insert(categories),
        this.supabase.from('products').insert(products),
        this.supabase.from('debtors').insert(debtors),
        this.supabase.from('fixed_expenses').insert(fixedExpenses)
      ]);
      console.log('Se sembraron los datos por defecto en Supabase.');
      await this.initSupabase();
    } catch (e) {
      console.error('Error al sembrar datos en Supabase:', e);
    }
  },

  // ── Seed initial data ─────────────────
  seed() {
    // Fallback de sembrado local si no está usando Supabase
    if (this.supabase) return;

    const users = [
      { id: 'u1', name: 'Andrea Tuta', username: 'andrea', password: '2812', role: 'jefe' },
      { id: 'u2', name: 'Tomy',        username: 'tomy',   password: '2812', role: 'cajero', salaryHour: 800, defaultHours: 3.5 },
      { id: 'u3', name: 'Flor',        username: 'flor',   password: '2812', role: 'cajero', salaryHour: 800, defaultHours: 3.5 },
    ];

    if (!localStorage.getItem('5inco_seeded')) {
      this.set(this.KEYS.users, users);
      this.set(this.KEYS.categories, [
        { id: 'c1', name: 'Remeras' },
        { id: 'c2', name: 'Pantalones' },
        { id: 'c3', name: 'Vestidos' },
        { id: 'c4', name: 'Accesorios' },
      ]);
      this.set(this.KEYS.products, [
        { id: 'p1', name: 'Remera Básica Blanca', categoryId: 'c1', price: 3500, talle: 'M',  stock: 10 },
        { id: 'p2', name: 'Remera Estampada',      categoryId: 'c1', price: 4200, talle: 'L',  stock: 5  },
        { id: 'p3', name: 'Jean Skinny',            categoryId: 'c2', price: 12000, talle: '38', stock: 7 },
        { id: 'p4', name: 'Vestido Floral',         categoryId: 'c3', price: 8500, talle: 'S',  stock: 3  },
      ]);
      this.set(this.KEYS.debtors, [
        { id: 'd1', name: 'María González', phone: '11-2345-6789', surcharge: 10 },
        { id: 'd2', name: 'Laura Pérez',    phone: '11-8765-4321', surcharge: 10 },
      ]);
      this.set(this.KEYS.debts, []);
      this.set(this.KEYS.sales, []);
      this.set(this.KEYS.hours, {});
      this.set(this.KEYS.expenses, []);
      this.set(this.KEYS.fixedExpenses, [
        { id: 'f1', name: 'Alquiler', amount: 150000 },
        { id: 'f2', name: 'Luz (Edesur)', amount: 25000 },
        { id: 'f3', name: 'Agua (AySA)', amount: 8000 },
        { id: 'f4', name: 'Internet/Tel', amount: 12000 }
      ]);
      localStorage.setItem('5inco_seeded', '2');
    } else if (localStorage.getItem('5inco_seeded') === '1') {
      this.set(this.KEYS.users, users);
      localStorage.setItem('5inco_seeded', '2');
    }
  },

  // ── Audit Log ─────────────────────────
  getAuditLog() { return this.get(this.KEYS.audit); },
  addAuditLog(action, description, details = {}) {
    const logs = this.getAuditLog();
    const session = this.getSession();
    const entry = {
      id: this.id(),
      date: new Date().toISOString(),
      userId: session ? session.id : 'system',
      userName: session ? session.name : 'Sistema',
      action,
      description,
      details
    };
    logs.push(entry);
    // Keep max 2000 entries
    if (logs.length > 2000) logs.splice(0, logs.length - 2000);
    this.set(this.KEYS.audit, logs);
  },

  // ── Session ───────────────────────────
  getSession() { return this.getObj(this.KEYS.session); },
  setSession(user) { this.set(this.KEYS.session, user); },
  clearSession() { localStorage.removeItem(this.KEYS.session); },

  // ── Users ─────────────────────────────
  getUsers() { return this.get(this.KEYS.users); },
  saveUsers(u) {
    this.set(this.KEYS.users, u);
    if (this.supabase) {
      const promises = u.map(user => 
        this.supabase.from('users').upsert({
          id: user.id,
          name: user.name,
          username: user.username,
          password: user.password,
          role: user.role,
          salary_hour: user.salaryHour,
          default_hours: user.defaultHours,
          commission_pct: user.commissionPct || 0
        })
      );
      Promise.all(promises).catch(err => console.error('Error sincronizando usuarios:', err));
    }
  },
  findUser(username, password) {
    return this.getUsers().find(u => u.username === username && u.password === password) || null;
  },

  // ── Categories ────────────────────────
  getCategories() { return this.get(this.KEYS.categories); },
  addCategory(name) {
    const cats = this.getCategories();
    const cat = { id: this.id(), name };
    cats.push(cat); this.set(this.KEYS.categories, cats);
    this.addAuditLog('category_create', `Categoría creada: "${name}"`, { catId: cat.id, name });
    if (this.supabase) {
      this.supabase.from('categories').insert(cat)
        .then(({ error }) => { if (error) console.error('Error insertando categoría en Supabase:', error); });
    }
    return cat;
  },
  deleteCategory(id) {
    const cat = this.getCategories().find(c => c.id === id);
    this.set(this.KEYS.categories, this.getCategories().filter(c => c.id !== id));
    this.addAuditLog('category_delete', `Categoría eliminada: "${cat ? cat.name : id}"`, { catId: id });
    if (this.supabase) {
      this.supabase.from('categories').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Error eliminando categoría en Supabase:', error); });
    }
  },
  updateCategory(id, name) {
    const old = this.getCategories().find(c => c.id === id);
    const cats = this.getCategories().map(c => c.id === id ? { ...c, name } : c);
    this.set(this.KEYS.categories, cats);
    this.addAuditLog('category_update', `Categoría renombrada: "${old ? old.name : id}" → "${name}"`, { catId: id, oldName: old?.name, newName: name });
    if (this.supabase) {
      this.supabase.from('categories').update({ name }).eq('id', id)
        .then(({ error }) => { if (error) console.error('Error actualizando categoría en Supabase:', error); });
    }
  },

  // ── Products ──────────────────────────
  getProducts() { return this.get(this.KEYS.products); },
  addProduct(data) {
    const prods = this.getProducts();
    const p = { id: this.id(), ...data };
    prods.push(p); this.set(this.KEYS.products, prods);
    this.addAuditLog('product_create', `Prenda creada: "${p.name}" (${p.talle || 'sin talle'}) – Stock: ${p.stock} – Precio: $${p.price}`, { productId: p.id, name: p.name, talle: p.talle, price: p.price, stock: p.stock });
    if (this.supabase) {
      this.supabase.from('products').insert({
        id: p.id,
        name: p.name,
        category_id: p.categoryId || null,
        price: p.price,
        talle: p.talle || null,
        stock: p.stock,
        variants: p.variants || []
      }).then(({ error }) => { if (error) console.error('Error insertando producto en Supabase:', error); });
    }
    return p;
  },
  updateProduct(id, data) {
    const old = this.getProducts().find(p => p.id === id);
    const prods = this.getProducts().map(p => p.id === id ? { ...p, ...data } : p);
    this.set(this.KEYS.products, prods);
    const updated = prods.find(p => p.id === id);
    this.addAuditLog('product_update', `Prenda editada: "${updated?.name || id}"`, { productId: id, old, new: updated });
    if (this.supabase) {
      const p = prods.find(x => x.id === id);
      if (p) {
        this.supabase.from('products').update({
          name: p.name,
          category_id: p.categoryId || null,
          price: p.price,
          talle: p.talle || null,
          stock: p.stock,
          variants: p.variants || []
        }).eq('id', id).then(({ error }) => { if (error) console.error('Error actualizando producto en Supabase:', error); });
      }
    }
  },
  deleteProduct(id) {
    const prod = this.getProducts().find(p => p.id === id);
    this.set(this.KEYS.products, this.getProducts().filter(p => p.id !== id));
    this.addAuditLog('product_delete', `Prenda eliminada: "${prod ? prod.name : id}"`, { productId: id, name: prod?.name });
    if (this.supabase) {
      this.supabase.from('products').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Error eliminando producto en Supabase:', error); });
    }
  },

  // ── Sales ─────────────────────────────
  getSales() { return this.get(this.KEYS.sales); },
  addSale(sale) {
    const sales = this.getSales();
    const s = { id: this.id(), date: new Date().toISOString(), ...sale };
    sales.push(s); this.set(this.KEYS.sales, sales);
    this.addAuditLog('sale_create', `Venta registrada – ${s.payType} – Total: $${s.totalFinal}`, { saleId: s.id, total: s.totalFinal, payType: s.payType });
    if (this.supabase) {
      const { date, totalFinal, payType, splitDetails, returned, ...rest } = s;
      this.supabase.from('sales').insert({
        id: s.id,
        date: date,
        total_final: totalFinal,
        pay_type: payType,
        split_details: splitDetails || null,
        returned: returned || false,
        details: rest
      }).then(({ error }) => { if (error) console.error('Error insertando venta en Supabase:', error); });
    }
    return s;
  },
  updateSale(id, data) {
    const sales = this.getSales().map(s => s.id === id ? { ...s, ...data } : s);
    this.set(this.KEYS.sales, sales);
    const s = sales.find(x => x.id === id);
    if (data.returned) {
      this.addAuditLog('sale_return', `Venta devuelta – Total: $${s?.totalFinal || '?'}`, { saleId: id });
    }
    if (this.supabase) {
      if (s) {
        const { date, totalFinal, payType, splitDetails, returned, ...rest } = s;
        this.supabase.from('sales').update({
          total_final: totalFinal,
          pay_type: payType,
          split_details: splitDetails || null,
          returned: returned || false,
          details: rest
        }).eq('id', id).then(({ error }) => { if (error) console.error('Error actualizando venta en Supabase:', error); });
      }
    }
  },

  // ── Debtors ───────────────────────────
  getDebtors() { return this.get(this.KEYS.debtors); },
  addDebtor(data) {
    const debtors = this.getDebtors();
    const d = { id: this.id(), surcharge: 0, ...data };
    debtors.push(d); this.set(this.KEYS.debtors, debtors);
    this.addAuditLog('debtor_create', `Deudor creado: "${d.name}"`, { debtorId: d.id, name: d.name, phone: d.phone });
    if (this.supabase) {
      this.supabase.from('debtors').insert(d)
        .then(({ error }) => { if (error) console.error('Error insertando deudor en Supabase:', error); });
    }
    return d;
  },
  updateDebtor(id, data) {
    const old = this.getDebtors().find(d => d.id === id);
    const debtors = this.getDebtors().map(d => d.id === id ? { ...d, ...data } : d);
    this.set(this.KEYS.debtors, debtors);
    this.addAuditLog('debtor_update', `Deudor editado: "${old ? old.name : id}"`, { debtorId: id });
    if (this.supabase) {
      const d = debtors.find(x => x.id === id);
      if (d) {
        this.supabase.from('debtors').update(d).eq('id', id)
          .then(({ error }) => { if (error) console.error('Error actualizando deudor en Supabase:', error); });
      }
    }
  },
  deleteDebtor(id) {
    const deb = this.getDebtors().find(d => d.id === id);
    this.set(this.KEYS.debtors, this.getDebtors().filter(d => d.id !== id));
    this.addAuditLog('debtor_delete', `Deudor eliminado: "${deb ? deb.name : id}"`, { debtorId: id });
    if (this.supabase) {
      this.supabase.from('debtors').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Error eliminando deudor de Supabase:', error); });
    }
  },

  // ── Debts ─────────────────────────────
  getDebts() { return this.get(this.KEYS.debts); },
  addDebt(debt) {
    const debts = this.getDebts();
    const d = { id: this.id(), date: new Date().toISOString(), paid: false, ...debt };
    debts.push(d); this.set(this.KEYS.debts, debts);

    if (this.supabase) {
      this.supabase.from('debts').insert({
        id: d.id,
        debtor_id: d.debtorId,
        amount: d.amount,
        paid: d.paid,
        date: d.date,
        paid_date: d.paidDate || null,
        sale_id: d.saleId || null,
        detail: d.detail || null
      }).then(({ error }) => { if (error) console.error('Error insertando deuda en Supabase:', error); });
    }
    return d;
  },
  payDebt(id) {
    const dateStr = new Date().toISOString();
    const debt = this.getDebts().find(d => d.id === id);
    const debts = this.getDebts().map(d => d.id === id ? { ...d, paid: true, paidDate: dateStr } : d);
    this.set(this.KEYS.debts, debts);
    const debtor = debt ? this.getDebtors().find(d => d.id === debt.debtorId) : null;
    this.addAuditLog('debt_paid', `Deuda cobrada – ${debtor ? debtor.name : 'Deudor'} – $${debt ? debt.amount : '?'}`, { debtId: id, amount: debt?.amount, debtorName: debtor?.name });
    if (this.supabase) {
      this.supabase.from('debts').update({
        paid: true,
        paid_date: dateStr
      }).eq('id', id).then(({ error }) => { if (error) console.error('Error actualizando pago de deuda en Supabase:', error); });
    }
  },
  getDebtorBalance(debtorId) {
    return this.getDebts().filter(d => d.debtorId === debtorId && !d.paid)
      .reduce((sum, d) => sum + d.amount, 0);
  },

  // ── Hours ─────────────────────────────
  getHours() { return this.getObj(this.KEYS.hours); },
  setHoursForDay(userId, date, hours, silent = false) {
    const h = this.getHours();
    const prev = h[userId] ? h[userId][date] : undefined;
    if (!h[userId]) h[userId] = {};
    h[userId][date] = hours;
    this.set(this.KEYS.hours, h);
    if (!silent) {
      const users = this.getUsers();
      const u = users.find(x => x.id === userId);
      this.addAuditLog('hours_adjust', `Horas ajustadas – ${u ? u.name : userId} – ${date}: ${prev !== undefined ? prev + 'h → ' : ''}${hours}h`, { userId, date, prev, new: hours });
    }
    if (this.supabase) {
      this.supabase.from('hours').upsert({
        user_id: userId,
        date: date,
        hours: hours
      }).then(({ error }) => { if (error) console.error('Error guardando horas en Supabase:', error); });
    }
  },
  removeHoursForDay(userId, dateStr) {
    const h = this.getHours();
    if (h[userId] && h[userId][dateStr] !== undefined) {
      delete h[userId][dateStr];
      this.set(this.KEYS.hours, h);
      this.addAuditLog('hours_delete', `Registro de horas eliminado – ${dateStr}`, { userId, dateStr });
      if (this.supabase) {
        this.supabase.from('hours').delete().match({ user_id: userId, date: dateStr })
          .then(({ error }) => { if (error) console.error('Error borrando horas en Supabase:', error); });
      }
    }
  },
  getHoursForMonth(userId, year, month) {
    const h = this.getHours();
    if (!h[userId]) return {};
    const prefix = `${year}-${String(month).padStart(2,'0')}`;
    const result = {};
    Object.entries(h[userId]).forEach(([d, v]) => {
      if (d.startsWith(prefix)) result[d] = v;
    });
    return result;
  },
  calcSalary(userId, year, month) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return 0;
    const days = this.getHoursForMonth(userId, year, month);
    const totalHours = Object.values(days).reduce((a, b) => a + b, 0);
    return totalHours * (user.salaryHour || 0);
  },

  // ── Expenses ──────────────────────────
  getExpenses() { return this.get(this.KEYS.expenses); },
  addExpense(data) {
    const expenses = this.getExpenses();
    const e = { id: this.id(), date: new Date().toISOString(), ...data };
    expenses.push(e); this.set(this.KEYS.expenses, expenses);
    this.addAuditLog('expense_create', `Gasto registrado – $${e.amount} – ${e.description || e.detail || 'Sin descripción'}`, { expenseId: e.id, amount: e.amount, description: e.description || e.detail });
    if (this.supabase) {
      this.supabase.from('expenses').insert({
        id: e.id,
        date: e.date,
        amount: e.amount,
        description: e.description || e.detail || null
      }).then(({ error }) => { if (error) console.error('Error insertando gasto en Supabase:', error); });
    }
    return e;
  },
  deleteExpense(id) {
    const exp = this.getExpenses().find(e => e.id === id);
    this.set(this.KEYS.expenses, this.getExpenses().filter(e => e.id !== id));
    this.addAuditLog('expense_delete', `Gasto eliminado – $${exp ? exp.amount : '?'} – ${exp?.description || exp?.detail || ''}`, { expenseId: id });
    if (this.supabase) {
      this.supabase.from('expenses').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Error eliminando gasto en Supabase:', error); });
    }
  },

  // ── Fixed Expenses (Templates) ────────
  getFixedExpenses() { return this.get(this.KEYS.fixedExpenses); },
  addFixedExpense(name, amount) {
    const fe = this.getFixedExpenses();
    const item = { id: this.id(), name, amount };
    fe.push(item); this.set(this.KEYS.fixedExpenses, fe);

    if (this.supabase) {
      this.supabase.from('fixed_expenses').insert(item)
        .then(({ error }) => { if (error) console.error('Error insertando gasto fijo en Supabase:', error); });
    }
    return item;
  },
  deleteFixedExpense(id) {
    this.set(this.KEYS.fixedExpenses, this.getFixedExpenses().filter(f => f.id !== id));
    if (this.supabase) {
      this.supabase.from('fixed_expenses').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Error eliminando gasto fijo en Supabase:', error); });
    }
  },
  updateFixedExpense(id, name, amount) {
    const fe = this.getFixedExpenses().map(f => f.id === id ? { ...f, name, amount } : f);
    this.set(this.KEYS.fixedExpenses, fe);
    if (this.supabase) {
      this.supabase.from('fixed_expenses').update({ name, amount }).eq('id', id)
        .then(({ error }) => { if (error) console.error('Error actualizando gasto fijo en Supabase:', error); });
    }
  },

  // ── Cash Sessions ─────────────────────
  getCashSession(dateStr) {
    const sessions = this.getObj(this.KEYS.cashSession);
    return sessions[dateStr] || null;
  },
  setCashSession(dateStr, data) {
    const sessions = this.getObj(this.KEYS.cashSession);
    const isNew = !sessions[dateStr];
    sessions[dateStr] = data;
    this.set(this.KEYS.cashSession, sessions);
    if (isNew) {
      this.addAuditLog('cash_open', `Apertura de caja – Efectivo inicial: $${data.openingCash}`, { date: dateStr, openingCash: data.openingCash, openedBy: data.openedBy });
    }
    if (this.supabase) {
      this.supabase.from('cash_sessions').upsert({
        date: dateStr,
        opening_cash: data.openingCash,
        active: data.active,
        opened_by: data.openedBy,
        opened_at: data.openedAt
      }).then(({ error }) => { if (error) console.error('Error guardando sesión de caja en Supabase:', error); });
    }
  },

  // ── Users audit hook ──────────────────
  saveUsersWithAudit(users, actionDesc) {
    this.set(this.KEYS.users, users);
    this.addAuditLog('user_update', actionDesc, {});
    if (this.supabase) {
      const promises = users.map(user =>
        this.supabase.from('users').upsert({
          id: user.id,
          name: user.name,
          username: user.username,
          password: user.password,
          role: user.role,
          salary_hour: user.salaryHour,
          default_hours: user.defaultHours,
          commission_pct: user.commissionPct || 0
        })
      );
      Promise.all(promises).catch(err => console.error('Error sincronizando usuarios:', err));
    }
  },
};
