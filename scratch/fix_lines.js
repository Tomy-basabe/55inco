const fs = require('fs');
let lines = fs.readFileSync('data.js', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('this.supabase.from')) {
    // Categories
    if (lines[i].includes(".from('categories').insert(cat)")) {
      lines[i] = "      this._rest('POST', 'categories', [{ tenant_id: this.currentTenant, ...cat }]).catch(e => console.error(e));";
      lines[i+1] = ""; // remove .then
    }
    else if (lines[i].includes(".from('categories').delete().eq('id', id)")) {
      lines[i] = "      this._rest('DELETE', `categories?id=eq.${id}&tenant_id=eq.${this.currentTenant}`).catch(e => console.error(e));";
      lines[i+1] = "";
    }
    else if (lines[i].includes(".from('categories').update({ name }).eq('id', id)")) {
      lines[i] = "      this._rest('PATCH', `categories?id=eq.${id}&tenant_id=eq.${this.currentTenant}`, { name }).catch(e => console.error(e));";
      lines[i+1] = "";
    }
    // Debtors
    else if (lines[i].includes(".from('debtors').insert(d)")) {
      lines[i] = "      this._rest('POST', 'debtors', [{ tenant_id: this.currentTenant, ...d }]).catch(e => console.error(e));";
      lines[i+1] = "";
    }
    else if (lines[i].includes(".from('debtors').update(d).eq('id', id)")) {
      lines[i] = "      this._rest('PATCH', `debtors?id=eq.${id}&tenant_id=eq.${this.currentTenant}`, d).catch(e => console.error(e));";
      lines[i+1] = "";
    }
    else if (lines[i].includes(".from('debtors').delete().eq('id', id)")) {
      lines[i] = "      this._rest('DELETE', `debtors?id=eq.${id}&tenant_id=eq.${this.currentTenant}`).catch(e => console.error(e));";
      lines[i+1] = "";
    }
    // Fixed Expenses
    else if (lines[i].includes(".from('fixed_expenses').insert(item)")) {
      lines[i] = "      this._rest('POST', 'fixed_expenses', [{ tenant_id: this.currentTenant, ...item }]).catch(e => console.error(e));";
      lines[i+1] = "";
    }
    else if (lines[i].includes(".from('fixed_expenses').delete().eq('id', id)")) {
      lines[i] = "      this._rest('DELETE', `fixed_expenses?id=eq.${id}&tenant_id=eq.${this.currentTenant}`).catch(e => console.error(e));";
      lines[i+1] = "";
    }
    else if (lines[i].includes(".from('fixed_expenses').update({ name, amount }).eq('id', id)")) {
      lines[i] = "      this._rest('PATCH', `fixed_expenses?id=eq.${id}&tenant_id=eq.${this.currentTenant}`, { name, amount }).catch(e => console.error(e));";
      lines[i+1] = "";
    }
    // Products Delete
    else if (lines[i].includes(".from('products').delete().eq('id', id)")) {
      lines[i] = "      this._rest('DELETE', `products?id=eq.${id}&tenant_id=eq.${this.currentTenant}`).catch(e => console.error(e));";
      lines[i+1] = "";
    }
    // Debts Insert
    else if (lines[i].includes(".from('debts').insert({")) {
      lines[i] = "      this._rest('POST', 'debts', [{ tenant_id: this.currentTenant, id: dbObj.id, debtor_id: dbObj.debtorId, amount: dbObj.amount, paid: dbObj.paid, date: dbObj.date, paid_date: dbObj.paidDate, sale_id: dbObj.saleId, detail: dbObj.detail }]).catch(e => console.error(e));";
      lines[i+1] = ""; lines[i+2] = ""; lines[i+3] = ""; lines[i+4] = "";
    }
    // Debts Update
    else if (lines[i].includes(".from('debts').update({")) {
      lines[i] = "      this._rest('PATCH', `debts?id=eq.${debtId}&tenant_id=eq.${this.currentTenant}`, { paid: true, paid_date: dateStr }).catch(e => console.error(e));";
      lines[i+1] = ""; lines[i+2] = "";
    }
    // Expenses Insert
    else if (lines[i].includes(".from('expenses').insert({")) {
      lines[i] = "      this._rest('POST', 'expenses', [{ tenant_id: this.currentTenant, id: ex.id, type: ex.type, date: ex.date, name: ex.name, amount: ex.amount, user_id: ex.userId }]).catch(e => console.error(e));";
      lines[i+1] = ""; lines[i+2] = ""; lines[i+3] = ""; lines[i+4] = "";
    }
    // Expenses Delete
    else if (lines[i].includes(".from('expenses').delete().eq('id', id)")) {
      lines[i] = "      this._rest('DELETE', `expenses?id=eq.${id}&tenant_id=eq.${this.currentTenant}`).catch(e => console.error(e));";
      lines[i+1] = "";
    }
    // Sales Update
    else if (lines[i].includes(".from('sales').update({")) {
      lines[i] = "        this._rest('PATCH', `sales?id=eq.${id}&tenant_id=eq.${this.currentTenant}`, { total_final: totalFinal, pay_type: payType, split_details: splitDetails || null, returned: returned || false, details: rest }).catch(e => console.error(e));";
      lines[i+1] = ""; lines[i+2] = ""; lines[i+3] = ""; lines[i+4] = ""; lines[i+5] = ""; lines[i+6] = "";
    }
  }
}

fs.writeFileSync('data.js', lines.filter(l => l !== "").join('\n'));
