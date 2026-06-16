import fs from 'fs';
import path from 'path';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.jsx')) results.push(file);
        }
    });
    return results;
}

const files = walk('./src/components');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace #0e1117
    content = content.replace(/background:\s*["']#0e1117["']/g, 'background: "var(--body-bg, #0e1117)"');
    // Replace #161b22
    content = content.replace(/background:\s*["']#161b22["']/g, 'background: "var(--color-surface, #161b22)"');
    // Replace #0f172a
    content = content.replace(/background:\s*["']#0f172a["']/g, 'background: "var(--color-surface, #0f172a)"');
    // Replace rgba(15, 23, 42, X)
    content = content.replace(/background:\s*["']rgba\(15,\s*23,\s*42,\s*([0-9.]+)\)["']/g, 'background: "var(--color-surface, rgba(15, 23, 42, $1))"');
    // Replace linear-gradient
    content = content.replace(/background:\s*['"]linear-gradient\(180deg, #1a2030 0%, #161b22 100%\)['"]/g, 'background: "var(--color-surface, linear-gradient(180deg, #1a2030 0%, #161b22 100%))"');

    // Also replace backgroundColor
    content = content.replace(/backgroundColor:\s*["']rgba\(15,\s*23,\s*42,\s*([0-9.]+)\)["']/g, 'backgroundColor: "var(--color-surface, rgba(15, 23, 42, $1))"');

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
});

console.log('Finished updating JSX inline styles.');
