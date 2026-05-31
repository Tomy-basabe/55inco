/* ═══════════════════════════════════════
   5inco Store – Data Layer (localStorage)
   ═══════════════════════════════════════ */

const DB = {
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

  // ── Seed initial data ─────────────────
  seed() {
    // If not seeded, or if it was seeded with old passwords, let's force set the users to PIN '2812'
    const users = [
      { id: 'u1', name: 'Andrea Tuta', username: 'andrea', password: '2812', role: 'jefe' },
      { id: 'u2', name: 'Tomy',        username: 'tomy',   password: '2812', role: 'cajero', salaryHour: 800, defaultHours: 8 },
      { id: 'u3', name: 'Flor',        username: 'flor',   password: '2812', role: 'cajero', salaryHour: 800, defaultHours: 8 },
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
      // Force migrate old passwords to '2812' without erasing existing products/debtors/sales!
      this.set(this.KEYS.users, users);
      localStorage.setItem('5inco_seeded', '2');
    }
  },
  // ── Session ───────────────────────────
  getSession() { return this.getObj(this.KEYS.session); },
  setSession(user) { this.set(this.KEYS.session, user); },
  clearSession() { localStorage.removeItem(this.KEYS.session); },

  // ── Users ─────────────────────────────
  getUsers() { return this.get(this.KEYS.users); },
  saveUsers(u) { this.set(this.KEYS.users, u); },
  findUser(username, password) {
    return this.getUsers().find(u => u.username === username && u.password === password) || null;
  },

  // ── Categories ────────────────────────
  getCategories() { return this.get(this.KEYS.categories); },
  addCategory(name) {
    const cats = this.getCategories();
    const cat = { id: this.id(), name };
    cats.push(cat); this.set(this.KEYS.categories, cats);
    return cat;
  },
  deleteCategory(id) {
    this.set(this.KEYS.categories, this.getCategories().filter(c => c.id !== id));
  },
  updateCategory(id, name) {
    const cats = this.getCategories().map(c => c.id === id ? { ...c, name } : c);
    this.set(this.KEYS.categories, cats);
  },

  // ── Products ──────────────────────────
  getProducts() { return this.get(this.KEYS.products); },
  addProduct(data) {
    const prods = this.getProducts();
    const p = { id: this.id(), ...data };
    prods.push(p); this.set(this.KEYS.products, prods);
    return p;
  },
  updateProduct(id, data) {
    const prods = this.getProducts().map(p => p.id === id ? { ...p, ...data } : p);
    this.set(this.KEYS.products, prods);
  },
  deleteProduct(id) {
    this.set(this.KEYS.products, this.getProducts().filter(p => p.id !== id));
  },

  // ── Sales ─────────────────────────────
  getSales() { return this.get(this.KEYS.sales); },
  addSale(sale) {
    const sales = this.getSales();
    const s = { id: this.id(), date: new Date().toISOString(), ...sale };
    sales.push(s); this.set(this.KEYS.sales, sales);
    return s;
  },
  updateSale(id, data) {
    const sales = this.getSales().map(s => s.id === id ? { ...s, ...data } : s);
    this.set(this.KEYS.sales, sales);
  },

  // ── Debtors ───────────────────────────
  getDebtors() { return this.get(this.KEYS.debtors); },
  addDebtor(data) {
    const debtors = this.getDebtors();
    const d = { id: this.id(), surcharge: 0, ...data };
    debtors.push(d); this.set(this.KEYS.debtors, debtors);
    return d;
  },
  updateDebtor(id, data) {
    const debtors = this.getDebtors().map(d => d.id === id ? { ...d, ...data } : d);
    this.set(this.KEYS.debtors, debtors);
  },
  deleteDebtor(id) {
    this.set(this.KEYS.debtors, this.getDebtors().filter(d => d.id !== id));
  },

  // ── Debts ─────────────────────────────
  getDebts() { return this.get(this.KEYS.debts); },
  addDebt(debt) {
    const debts = this.getDebts();
    const d = { id: this.id(), date: new Date().toISOString(), paid: false, ...debt };
    debts.push(d); this.set(this.KEYS.debts, debts);
    return d;
  },
  payDebt(id) {
    const debts = this.getDebts().map(d => d.id === id ? { ...d, paid: true, paidDate: new Date().toISOString() } : d);
    this.set(this.KEYS.debts, debts);
  },
  getDebtorBalance(debtorId) {
    return this.getDebts().filter(d => d.debtorId === debtorId && !d.paid)
      .reduce((sum, d) => sum + d.amount, 0);
  },

  // ── Hours ─────────────────────────────
  // hours = { userId: { 'YYYY-MM-DD': hoursWorked } }
  getHours() { return this.getObj(this.KEYS.hours); },
  setHoursForDay(userId, date, hours) {
    const h = this.getHours();
    if (!h[userId]) h[userId] = {};
    h[userId][date] = hours;
    this.set(this.KEYS.hours, h);
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
    return e;
  },
  deleteExpense(id) {
    this.set(this.KEYS.expenses, this.getExpenses().filter(e => e.id !== id));
  },

  // ── Fixed Expenses (Templates) ────────
  getFixedExpenses() { return this.get(this.KEYS.fixedExpenses); },
  addFixedExpense(name, amount) {
    const fe = this.getFixedExpenses();
    const item = { id: this.id(), name, amount };
    fe.push(item); this.set(this.KEYS.fixedExpenses, fe);
    return item;
  },
  deleteFixedExpense(id) {
    this.set(this.KEYS.fixedExpenses, this.getFixedExpenses().filter(f => f.id !== id));
  },
  updateFixedExpense(id, name, amount) {
    const fe = this.getFixedExpenses().map(f => f.id === id ? { ...f, name, amount } : f);
    this.set(this.KEYS.fixedExpenses, fe);
  },

  // ── Cash Sessions ─────────────────────
  getCashSession(dateStr) {
    const sessions = this.getObj(this.KEYS.cashSession);
    return sessions[dateStr] || null; // { openingCash: 12000, active: true }
  },
  setCashSession(dateStr, data) {
    const sessions = this.getObj(this.KEYS.cashSession);
    sessions[dateStr] = data;
    this.set(this.KEYS.cashSession, sessions);
  },
};
