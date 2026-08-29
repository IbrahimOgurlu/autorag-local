import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();
const publicDir = join(ROOT, 'public');
const vehicles = JSON.parse(await readFile(join(ROOT, 'data', 'vehicles.json'), 'utf8'));
const generalKnowledge = JSON.parse(await readFile(join(ROOT, 'data', 'general_auto_knowledge.json'), 'utf8'));
const priceRows = parseCsv(await readFile(join(ROOT, 'data', 'market_prices.csv'), 'utf8'));

function parseCsv(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const columns = header.split(',');
  return rows.map(row => Object.fromEntries(row.split(',').map((cell, i) => [columns[i], cell])));
}

function fold(value = '') {
  return value.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').replaceAll('ş', 's')
    .replaceAll('ğ', 'g').replaceAll('ü', 'u').replaceAll('ö', 'o').replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value) {
  return [...new Set(fold(value).split(' ').filter(word => word.length > 1 && !['ile', 'icin', 'bir', 've', 'mi', 'mu', 'mı', 'bu', 'ne', 'nasil'].includes(word)))];
}

function vehicleText(vehicle) {
  return Object.entries(vehicle).filter(([key]) => key !== 'id').map(([, value]) => String(value)).join(' ');
}

function retrieve(question, limit = 3) {
  const query = tokens(question);
  return vehicles.map(vehicle => {
    const text = fold(vehicleText(vehicle));
    const score = query.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
    return { vehicle, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

function retrieveGeneral(question, limit = 2) {
  const query = tokens(question);
  return generalKnowledge.map(item => {
    const text = fold(`${item.topic} ${item.keywords} ${item.answer}`);
    const score = query.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
    return { item, score };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

function marketStats(vehicle) {
  const rows = priceRows.filter(row => row.brand === vehicle.brand && row.model === vehicle.model && Number(row.year) === vehicle.year);
  if (!rows.length) return null;
  const prices = rows.map(row => Number(row.priceTry));
  const kms = rows.map(row => Number(row.km));
  return { count: rows.length, min: Math.min(...prices), max: Math.max(...prices), avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length), avgKm: Math.round(kms.reduce((a, b) => a + b, 0) / kms.length), latest: rows.map(row => row.recordedAt).sort().at(-1) };
}

const formatTry = amount => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(amount);

function card(vehicle, includeMarket = true) {
  const market = marketStats(vehicle);
  const lines = [
    `**${vehicle.year} ${vehicle.brand} ${vehicle.model} — ${vehicle.trim}**`,
    `- Motor / güç: ${vehicle.engine}, ${vehicle.power}, ${vehicle.torque}`,
    `- Yakıt / şanzıman: ${vehicle.fuel}, ${vehicle.transmission}`,
    `- Tüketim: ${vehicle.consumption}; bagaj: ${vehicle.trunk}`,
    `- Güvenlik: ${vehicle.safety}`,
    `- Not: ${vehicle.notes}`
  ];
  if (includeMarket && market) lines.push(`- Yüklenen ${market.count} piyasa kaydına göre: **${formatTry(market.min)} – ${formatTry(market.max)}**, ortalama ${formatTry(market.avg)} (ortalama ${market.avgKm.toLocaleString('tr-TR')} km; son kayıt ${market.latest}).`);
  return lines.join('\n');
}

function localAnswer(question, matches) {
  if (!matches.length) return 'Yüklenen bilgi bankasında bu soruya doğrudan karşılık gelen bir kayıt bulamadım. Marka, model ve yılı yazarak yeniden deneyin; örneğin “2021 Corolla özellikleri”.';
  const q = fold(question);
  const compare = /karsilastir|fark|versus| vs /.test(` ${q} `) || matches.length > 1 && /ile/.test(q);
  if (compare && matches.length > 1) return `Aşağıda veri setindeki karşılaştırılabilir bilgiler yer alıyor. Nihai seçimde ekspertiz, donanım paketi ve bakım geçmişini ayrıca doğrulayın.\n\n${matches.slice(0, 2).map(item => card(item.vehicle)).join('\n\n')}`;
  const vehicle = matches[0].vehicle;
  const market = marketStats(vehicle);
  let intro = `${vehicle.year} ${vehicle.brand} ${vehicle.model} ${vehicle.trim} için veri setindeki özet:`;
  if (/fiyat|piyasa|deger|değer/.test(q) && market) intro = `Bu, anlık piyasa fiyatı değil; yüklenen kayıtların özeti. ${vehicle.year} ${vehicle.brand} ${vehicle.model} için:`;
  return `${intro}\n\n${card(vehicle)}`;
}

async function answer(question) {
  const matches = retrieve(question);
  const generalMatches = retrieveGeneral(question);
  const vehicleScore = matches[0]?.score || 0;
  const generalScore = generalMatches[0]?.score || 0;
  if (generalScore > vehicleScore) {
    const selected = generalMatches[0].item;
    return {
      text: `**${selected.topic}**\n\n${selected.answer}\n\nBu bilgi genel amaçlıdır; aracının marka, model ve yılını yazarsan daha hedefli bir değerlendirme yapabilirim.`,
      matches: [], mode: 'Yerel otomotiv bilgi bankası',
      sources: [{ title: selected.topic, source: selected.source }]
    };
  }
  // A configured Foundry Local endpoint can replace the transparent fallback generator.
  if (process.env.FOUNDRY_LOCAL_URL && process.env.FOUNDRY_MODEL && matches.length) {
    try {
      const context = matches.map(item => card(item.vehicle)).join('\n\n');
      const response = await fetch(`${process.env.FOUNDRY_LOCAL_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.FOUNDRY_MODEL, temperature: 0.2, messages: [
          { role: 'system', content: 'Türkçe yanıtla. Yalnızca verilen bağlamı kullan. Bilinmeyen bilgiyi uydurma. Piyasa fiyatının yüklenen kayıtlara dayalı tahmin olduğunu belirt.' },
          { role: 'user', content: `Bağlam:\n${context}\n\nSoru: ${question}` }
        ] })
      });
      const payload = await response.json();
      if (response.ok && payload.choices?.[0]?.message?.content) return { text: payload.choices[0].message.content, matches, mode: 'Foundry Local', sources: matches.map(({ vehicle }) => ({ title: `${vehicle.year} ${vehicle.brand} ${vehicle.model} ${vehicle.trim}`, source: vehicle.source })) };
    } catch { /* Local retrieval still works when the optional LLM is offline. */ }
  }
  return { text: localAnswer(question, matches), matches, mode: 'Yerel arama', sources: matches.map(({ vehicle }) => ({ title: `${vehicle.year} ${vehicle.brand} ${vehicle.model} ${vehicle.trim}`, source: vehicle.source })) };
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    let body = ''; for await (const chunk of req) body += chunk;
    try {
      const { question } = JSON.parse(body);
      if (!question?.trim()) throw new Error('Soru gerekli');
      const result = await answer(question.trim());
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(result));
    } catch (error) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/vehicles') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(vehicles)); return; }
  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = normalize(join(publicDir, requestPath));
  if (!filePath.startsWith(publicDir)) { res.writeHead(403); res.end(); return; }
  try { const file = await readFile(filePath); res.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' }); res.end(file); }
  catch { res.writeHead(404); res.end('Bulunamadı'); }
}).listen(PORT, '127.0.0.1', () => console.log(`AutoRAG hazır: http://127.0.0.1:${PORT}`));
