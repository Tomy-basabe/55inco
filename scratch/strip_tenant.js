const fs = require('fs');
let code = fs.readFileSync('data.js', 'utf8');

// Remove tenant_id from all POST bodies (various forms)
code = code.replace(/tenant_id:\s*this\.currentTenant,\s*/g, '');
code = code.replace(/,\s*tenant_id:\s*this\.currentTenant/g, '');

// Remove tenant_id filter from DELETE/PATCH URLs
code = code.replace(/&tenant_id=eq\.\$\{this\.currentTenant\}/g, '');
code = code.replace(/\?tenant_id=eq\.\$\{this\.currentTenant\}&/g, '?');

// Fix "tenant_id: this.currentTenant, ...cat" patterns => just "...cat"
code = code.replace(/\[\{ tenant_id: this\.currentTenant, \.\.\.(cat|d|item|ex)\s*\}\]/g, '[{ ...$1 }]');

fs.writeFileSync('data.js', code);
console.log('Done');
