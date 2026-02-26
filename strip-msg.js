const fs = require('fs');
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { data += chunk; });
process.stdin.on('end', () => {
  const out = data.split(/\r?\n/).filter((l) => !/^Co-authored-by:/i.test(l)).join('\n');
  process.stdout.write(out);
});
