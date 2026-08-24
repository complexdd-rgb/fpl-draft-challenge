const urls = [
  'https://www.statbunker.com/competitions/PlayerStandings?comp_id=415',
  'https://dr.statbunker.com/competitions/PlayerStandings?comp_id=415',
  'https://po.statbunker.com/competitions/PlayerStandings?comp_id=415',
  'https://betl.statbunker.com/competitions/PlayerStandings?comp_id=415',
  'https://tripadvisor4biz.statbunker.com/competitions/PlayerStandings?comp_id=415',
  'http://www.statbunker.com/competitions/PlayerStandings?comp_id=415'
];
const headerSets = [
  { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36', 'accept': 'text/html,application/xhtml+xml', 'accept-language': 'en-GB,en;q=0.9', 'referer': 'https://www.statbunker.com/' },
  { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }
];
for (const url of urls) {
  for (let i = 0; i < headerSets.length; i++) {
    try {
      const r = await fetch(url, { headers: headerSets[i], redirect: 'follow' });
      const text = await r.text();
      console.log(`${r.status}\t${text.length}\tH${i+1}\t${url}\tfinal=${r.url}`);
    } catch (error) {
      console.log(`ERR\t0\tH${i+1}\t${url}\t${error.message}`);
    }
  }
}
