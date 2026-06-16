const fs = require('fs');

let css = fs.readFileSync('src/index.css', 'utf8');

// Replace dark blue and dark gray backgrounds in index.css
css = css.replace(/background(-color)?:\s*#111827/gi, 'background$1: var(--color-surface, #111827)');
css = css.replace(/background(-color)?:\s*#1c1f26/gi, 'background$1: var(--color-surface, #1c1f26)');
css = css.replace(/background(-color)?:\s*#131921/gi, 'background$1: var(--color-surface-offset, #131921)');
css = css.replace(/background(-color)?:\s*rgba\((?:15,\s*23,\s*42|14,\s*17,\s*23|10,\s*14,\s*20),\s*([0-9.]+)\)/gi, 'background$1: var(--color-surface, rgba(15, 23, 42, $2))');

fs.writeFileSync('src/index.css', css);
console.log('Fixed additional dark backgrounds in index.css');
