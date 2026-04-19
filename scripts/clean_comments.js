const fs = require('fs');
const path = require('path');

const files = [
  'd:/olh-zenchat/client/src/context/SocketContext.jsx',
  'd:/olh-zenchat/client/src/stores/authStore.js',
  'd:/olh-zenchat/client/src/stores/chatStore.js',
  'd:/olh-zenchat/client/src/utils/audio.js',
  'd:/olh-zenchat/server/socket/handlers.js',
  'd:/olh-zenchat/server/utils/cloudinary.js',
];

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');

  const cleaned = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;

    const inlineIdx = line.indexOf(' //');
    if (inlineIdx > 0) {
      const before = line.slice(0, inlineIdx);
      const dq = (before.match(/"/g) || []).length;
      const sq = (before.match(/'/g) || []).length;
      const bt = (before.match(/`/g) || []).length;
      if (dq % 2 === 0 && sq % 2 === 0 && bt % 2 === 0) {
        cleaned.push(line.slice(0, inlineIdx));
        continue;
      }
    }
    cleaned.push(line);
  }

  let result = cleaned.join('\n');

  result = result.replace(/\/\*[^*]*\*\//g, '');
  result = result.replace(/\u2014/g, '-');
  result = result.replace(/\u2013/g, '-');
  result = result.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(file, result, 'utf8');
  console.log('Cleaned:', path.basename(file));
}
console.log('Done.');
