const url = 'http://www.statbunker.com/competitions/PlayerStandings?comp_id=415';
const headers = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml',
  'accept-language': 'en-GB,en;q=0.9',
  'referer': 'https://www.statbunker.com/'
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let html = '';
for (let attempt=1; attempt<=8; attempt++) {
  const r = await fetch(`${url}&_save_probe=${Date.now()}_${attempt}`, {headers, redirect:'follow'});
  const t = await r.text();
  console.log(`attempt ${attempt}: ${r.status} ${t.length}`);
  if (r.ok && t.length > 100000) { html = t; break; }
  await sleep(1500);
}
if (!html) throw new Error('Could not fetch StatBunker page');

const decode = s => String(s).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');
const strip = s => decode(String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
const hits = [];
for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
  const href = decode(m[1]);
  const text = strip(m[2]);
  if (/save|shot|keeper|goalkeep/i.test(`${href} ${text}`)) hits.push({href,text});
}
const seen = new Set();
console.log('\nSAVE/SHOT/KEEPER LINKS');
for (const hit of hits) {
  const key = `${hit.text}\t${hit.href}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(key);
}

console.log('\nRAW SAVE CONTEXT');
const lower = html.toLowerCase();
for (const needle of ['save','saves','shot','keeper','goalkeeper']) {
  let at = 0, n = 0;
  while ((at = lower.indexOf(needle, at)) >= 0 && n < 20) {
    const snippet = strip(html.slice(Math.max(0,at-180), Math.min(html.length,at+260)));
    console.log(`${needle}: ${snippet}`);
    at += needle.length; n++;
  }
}
