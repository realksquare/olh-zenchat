const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace(/background(-color)?:\s*#0e1117/gi, 'background$1: var(--body-bg, #0e1117)');
css = css.replace(/background(-color)?:\s*#161b22/gi, 'background$1: var(--color-surface, #161b22)');
css = css.replace(/background(-color)?:\s*#1e2530/gi, 'background$1: var(--color-surface-offset, #1e2530)');
css = css.replace(/background(-color)?:\s*#0f172a/gi, 'background$1: var(--color-surface, #0f172a)');
fs.writeFileSync('src/index.css', css);
console.log('Replaced hardcoded backgrounds in index.css');
