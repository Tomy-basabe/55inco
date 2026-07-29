const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Replace specific interpolations that represent user-input text
// e.g., ${p.name}, ${cat.name}, ${d.name}, ${i.name}, ${u.name}, ${prod.name}, ${c.name}, ${o.label}
// Also ${p.talle}, ${e.description}, ${log.action}
const patterns = [
  /\$\{([^}]+)\.name\}/g,
  /\$\{([^}]+)\.talle\}/g,
  /\$\{([^}]+)\.description\}/g,
  /\$\{([^}]+)\.action\}/g,
  /\$\{([^}]+)\.label\}/g
];

patterns.forEach(regex => {
  code = code.replace(regex, (match, obj) => {
    // If it's already wrapped in escapeHTML or it's a function call, skip
    if (obj.includes('escapeHTML') || obj.includes('(') || obj.includes('?')) return match;
    // Don't escape things that are HTML icons or badges, wait, 'label' might be an icon?
    if (obj === 'MOBILE_ICONS' || obj === 'NAV_ICONS' || obj === 'i') return match; 
    
    // Specifically handle the simple objects
    if (['p', 'cat', 'd', 'i', 'u', 'prod', 'c', 'o', 'e', 'log', 'debtor', 'v'].includes(obj.trim())) {
      return `\${escapeHTML(${obj}.${match.split('.')[1].replace('}', '')})}`;
    }
    return match;
  });
});

// Replace specific standalone variables if needed
code = code.replace(/\$\{name\}/g, '${escapeHTML(name)}');
code = code.replace(/\$\{debtorName\}/g, '${escapeHTML(debtorName)}');

fs.writeFileSync('app.js', code);
console.log('escapeHTML applied');
