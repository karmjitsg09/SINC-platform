const fs = require('fs');
const path = require('path');

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
      const c = fs.readFileSync(p, 'utf8');
      const matches = c.match(/\.from\(['"]profiles['"]\)\.select\([^\)]*\)/g);
      if (matches) {
        console.log(p);
        matches.forEach(m => console.log('   ', m));
      }
    }
  }
}

walk('./src');
