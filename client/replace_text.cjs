const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.jsx') || file.endsWith('.css')) results.push(file);
        }
    });
    return results;
}

const files = walk('./src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // We only replace if it's NOT already a var()
    content = content.replace(/color:\s*(['"]?)#(?:fff|ffffff)(['"]?)(?!\s*\))/gi, 'color: $1var(--color-text, #fff)$2');
    content = content.replace(/color:\s*(['"]?)rgba\(255,\s*255,\s*255,\s*(0\.[7-9][0-9]*|1(?:\.0+)?)\)(['"]?)(?!\s*\))/gi, 'color: $1var(--color-text, rgba(255, 255, 255, $2))$3');
    content = content.replace(/color:\s*(['"]?)rgba\(255,\s*255,\s*255,\s*(0\.[5-6][0-9]*)\)(['"]?)(?!\s*\))/gi, 'color: $1var(--color-text-muted, rgba(255, 255, 255, $2))$3');
    content = content.replace(/color:\s*(['"]?)rgba\(255,\s*255,\s*255,\s*(0\.[1-4][0-9]*)\)(['"]?)(?!\s*\))/gi, 'color: $1var(--color-text-faint, rgba(255, 255, 255, $2))$3');

    content = content.replace(/border(-color)?:\s*([^;]*?)(['"]?)rgba\(255,\s*255,\s*255,\s*0\.[0-1][0-9]*\)(['"]?)(?!\s*\))/gi, 'border$1: $2$3var(--color-border, rgba(255, 255, 255, 0.08))$4');
    
    // Backgrounds
    content = content.replace(/background(-color)?:\s*(['"]?)rgba\(255,\s*255,\s*255,\s*(0\.[0-2][0-9]*)\)(['"]?)(?!\s*\))/gi, 'background$1: $2var(--color-overlay, rgba(255, 255, 255, $3))$4');

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
});

console.log('Finished replacing text and borders.');
