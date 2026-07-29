const fs = require('fs');
let code = fs.readFileSync('data.js', 'utf8');

// Category Insert
code = code.replace(
  "      this.supabase.from('categories').insert(cat)\n        .then(({ error }) => { if (error) console.error('Error insertando categoría en Supabase:', error); });",
  "      this._rest('POST', 'categories', [{ tenant_id: this.currentTenant, ...cat }]).catch(e => console.error(e));"
);

// Category Delete
code = code.replace(
  "      this.supabase.from('categories').delete().eq('id', id)\n        .then(({ error }) => { if (error) console.error('Error eliminando categoría en Supabase:', error); });",
  "      this._rest('DELETE', `categories?id=eq.${id}&tenant_id=eq.${this.currentTenant}`).catch(e => console.error(e));"
);

// Category Update
code = code.replace(
  "      this.supabase.from('categories').update({ name }).eq('id', id)\n        .then(({ error }) => { if (error) console.error('Error actualizando categoría en Supabase:', error); });",
  "      this._rest('PATCH', `categories?id=eq.${id}&tenant_id=eq.${this.currentTenant}`, { name }).catch(e => console.error(e));"
);

// Product Delete
code = code.replace(
  "      this.supabase.from('products').delete().eq('id', id)\n        .then(({ error }) => { if (error) console.error('Error eliminando producto en Supabase:', error); });",
  "      this._rest('DELETE', `products?id=eq.${id}&tenant_id=eq.${this.currentTenant}`).catch(e => console.error(e));"
);

// Sale Update
code = code.replace(
`        this.supabase.from('sales').update({
          total_final: totalFinal,
          pay_type: payType,
          split_details: splitDetails || null,
          returned: returned || false,
          details: rest
        }).eq('id', id).then(({ error }) => { if (error) console.error('Error actualizando venta en Supabase:', error); });`,
`        this._rest('PATCH', \`sales?id=eq.\${id}&tenant_id=eq.\${this.currentTenant}\`, {
          total_final: totalFinal, pay_type: payType, split_details: splitDetails || null, returned: returned || false, details: rest
        }).catch(e => console.error(e));`
);

// Debtors Insert
code = code.replace(
`      this.supabase.from('debtors').insert(d)
        .then(({ error }) => { if (error) console.error('Error insertando deudor en Supabase:', error); });`,
"      this._rest('POST', 'debtors', [{ tenant_id: this.currentTenant, ...d }]).catch(e => console.error(e));"
);

// Debtors Update
code = code.replace(
`      this.supabase.from('debtors').update(d).eq('id', id)
        .then(({ error }) => { if (error) console.error('Error actualizando deudor en Supabase:', error); });`,
"      this._rest('PATCH', `debtors?id=eq.${id}&tenant_id=eq.${this.currentTenant}`, d).catch(e => console.error(e));"
);

// Debtors Delete
code = code.replace(
`      this.supabase.from('debtors').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Error eliminando deudor en Supabase:', error); });`,
"      this._rest('DELETE', `debtors?id=eq.${id}&tenant_id=eq.${this.currentTenant}`).catch(e => console.error(e));"
);

// Debts Insert
code = code.replace(
`      this.supabase.from('debts').insert({
        id: dbObj.id,
        debtor_id: dbObj.debtorId,
        amount: dbObj.amount,
        paid: dbObj.paid,
        date: dbObj.date,
        paid_date: dbObj.paidDate,
        sale_id: dbObj.saleId,
        detail: dbObj.detail
      }).then(({ error }) => { if (error) console.error('Error insertando deuda en Supabase:', error); });`,
`      this._rest('POST', 'debts', [{ tenant_id: this.currentTenant, id: dbObj.id, debtor_id: dbObj.debtorId, amount: dbObj.amount, paid: dbObj.paid, date: dbObj.date, paid_date: dbObj.paidDate, sale_id: dbObj.saleId, detail: dbObj.detail }]).catch(e => console.error(e));`
);

// Debts Update
code = code.replace(
`      this.supabase.from('debts').update({
        paid: true,
        paid_date: dateStr
      }).eq('id', debtId).then(({ error }) => { if (error) console.error('Error actualizando deuda en Supabase:', error); });`,
`      this._rest('PATCH', \`debts?id=eq.\${debtId}&tenant_id=eq.\${this.currentTenant}\`, { paid: true, paid_date: dateStr }).catch(e => console.error(e));`
);

// Expenses Insert
code = code.replace(
`      this.supabase.from('expenses').insert({
        id: ex.id,
        type: ex.type,
        date: ex.date,
        name: ex.name,
        amount: ex.amount,
        user_id: ex.userId
      }).then(({ error }) => { if (error) console.error('Error insertando gasto en Supabase:', error); });`,
`      this._rest('POST', 'expenses', [{ tenant_id: this.currentTenant, id: ex.id, type: ex.type, date: ex.date, name: ex.name, amount: ex.amount, user_id: ex.userId }]).catch(e => console.error(e));`
);

// Expenses Delete
code = code.replace(
`      this.supabase.from('expenses').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Error eliminando gasto en Supabase:', error); });`,
"      this._rest('DELETE', `expenses?id=eq.${id}&tenant_id=eq.${this.currentTenant}`).catch(e => console.error(e));"
);

// Fixed Expenses Insert
code = code.replace(
`      this.supabase.from('fixed_expenses').insert(item)
        .then(({ error }) => { if (error) console.error('Error insertando gasto fijo en Supabase:', error); });`,
"      this._rest('POST', 'fixed_expenses', [{ tenant_id: this.currentTenant, ...item }]).catch(e => console.error(e));"
);

// Fixed Expenses Update
code = code.replace(
`      this.supabase.from('fixed_expenses').update({ name, amount }).eq('id', id)
        .then(({ error }) => { if (error) console.error('Error actualizando gasto fijo en Supabase:', error); });`,
"      this._rest('PATCH', `fixed_expenses?id=eq.${id}&tenant_id=eq.${this.currentTenant}`, { name, amount }).catch(e => console.error(e));"
);

// Fixed Expenses Delete
code = code.replace(
`      this.supabase.from('fixed_expenses').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('Error eliminando gasto fijo en Supabase:', error); });`,
"      this._rest('DELETE', `fixed_expenses?id=eq.${id}&tenant_id=eq.${this.currentTenant}`).catch(e => console.error(e));"
);

fs.writeFileSync('data.js', code);
