import fs from 'node:fs';

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`${path}: expected patch target not found`);
  const first = source.indexOf(from);
  if (source.indexOf(from, first + from.length) !== -1) throw new Error(`${path}: patch target is not unique`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceOnce(
  'js/leaderboard-client.js',
  'const ATTEMPT_PREFIX = "fpl-v5-leaderboard-attempt-";',
  'const ATTEMPT_PREFIX = "fpl-v5.1-leaderboard-attempt-";'
);

replaceOnce(
  'js/leaderboard-client.js',
  '    const anchor=document.getElementById("phase45Shell")||document.getElementById("localHistory")||document.querySelector("main");\n    if(anchor?.parentNode)anchor.insertAdjacentElement("afterend",shell); else document.querySelector("main")?.appendChild(shell);',
  '    const main=document.querySelector("main.app")||document.querySelector("main");\n    if(main)main.appendChild(shell); else document.body.appendChild(shell);'
);

replaceOnce(
  'index.html',
  '<script src="js/leaderboard-client.js?v=5.0.0"></script>',
  '<script src="js/leaderboard-client.js?v=5.1.0"></script>'
);

replaceOnce(
  '.github/workflows/live-challenge-cleanup-v1.yml',
  '          node --check js/player-daily-mobile-nav-visibility.js\n',
  '          node --check js/player-daily-mobile-nav-visibility.js\n          node --check js/leaderboard-client.js\n'
);

replaceOnce(
  '.github/workflows/live-challenge-cleanup-v1.yml',
  '      - name: Re-run Daily UI invariants\n        run: node scripts/test-daily-ui-redesign-v1.mjs\n',
  '      - name: Check leaderboard device timing + layout invariants\n        run: node scripts/test-leaderboard-device-timing-layout.mjs\n\n      - name: Re-run Daily UI invariants\n        run: node scripts/test-daily-ui-redesign-v1.mjs\n'
);

console.log('Leaderboard timing/layout patch applied.');
