const fs = require('fs');
let code = fs.readFileSync('data.js', 'utf8');

// Add helpers
if (!code.includes('_insert(table, data)')) {
  code = code.replace(
    "  async _rest(method, table, body = null, query = '') {",
    "  _insert(table, data) {\n    const payload = Array.isArray(data) ? data.map(d => ({...d, tenant_id: this.currentTenant})) : [{...data, tenant_id: this.currentTenant}];\n    return this._rest('POST', table, payload);\n  },\n  _update(table, id, data) {\n    return this._rest('PATCH', `${table}?id=eq.${id}&tenant_id=eq.${this.currentTenant}`, data);\n  },\n  _delete(table, id) {\n    return this._rest('DELETE', `${table}?id=eq.${id}&tenant_id=eq.${this.currentTenant}`);\n  },\n\n  async _rest(method, table, body = null, query = '') {"
  );
}

// categories
code = code.replace(/this\.supabase\.from\('categories'\)\.insert\(cat\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._insert('categories', cat).catch(e => console.error('Error:', e));");
code = code.replace(/this\.supabase\.from\('categories'\)\.delete\(\)\.eq\('id',\s*id\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._delete('categories', id).catch(e => console.error('Error:', e));");
code = code.replace(/this\.supabase\.from\('categories'\)\.update\(\{ name \}\)\.eq\('id',\s*id\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._update('categories', id, { name }).catch(e => console.error('Error:', e));");

// products
code = code.replace(/this\.supabase\.from\('products'\)\.delete\(\)\.eq\('id',\s*id\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._delete('products', id).catch(e => console.error('Error:', e));");

// sales
code = code.replace(/this\.supabase\.from\('sales'\)\.update\(\{([\s\S]*?)\}\)\.eq\('id',\s*id\)\.then\([\s\S]*?\);/g, "this._update('sales', id, {$1}).catch(e => console.error('Error:', e));");

// debtors
code = code.replace(/this\.supabase\.from\('debtors'\)\.insert\(d\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._insert('debtors', d).catch(e => console.error('Error:', e));");
code = code.replace(/this\.supabase\.from\('debtors'\)\.update\(d\)\.eq\('id',\s*id\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._update('debtors', id, d).catch(e => console.error('Error:', e));");
code = code.replace(/this\.supabase\.from\('debtors'\)\.delete\(\)\.eq\('id',\s*id\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._delete('debtors', id).catch(e => console.error('Error:', e));");

// debts
code = code.replace(/this\.supabase\.from\('debts'\)\.insert\(\{([\s\S]*?)\}\)\.then\([\s\S]*?\);/g, "this._insert('debts', {$1}).catch(e => console.error('Error:', e));");
code = code.replace(/this\.supabase\.from\('debts'\)\.update\(\{([\s\S]*?)\}\)\.eq\('id',\s*debtId\)\.then\([\s\S]*?\);/g, "this._update('debts', debtId, {$1}).catch(e => console.error('Error:', e));");

// expenses
code = code.replace(/this\.supabase\.from\('expenses'\)\.insert\(\{([\s\S]*?)\}\)\.then\([\s\S]*?\);/g, "this._insert('expenses', {$1}).catch(e => console.error('Error:', e));");
code = code.replace(/this\.supabase\.from\('expenses'\)\.delete\(\)\.eq\('id',\s*id\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._delete('expenses', id).catch(e => console.error('Error:', e));");

// fixed expenses
code = code.replace(/this\.supabase\.from\('fixed_expenses'\)\.insert\(item\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._insert('fixed_expenses', item).catch(e => console.error('Error:', e));");
code = code.replace(/this\.supabase\.from\('fixed_expenses'\)\.delete\(\)\.eq\('id',\s*id\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._delete('fixed_expenses', id).catch(e => console.error('Error:', e));");
code = code.replace(/this\.supabase\.from\('fixed_expenses'\)\.update\(\{ name, amount \}\)\.eq\('id',\s*id\)\s*\n\s*\.then\([\s\S]*?\);/g, "this._update('fixed_expenses', id, { name, amount }).catch(e => console.error('Error:', e));");

fs.writeFileSync('data.js', code);
