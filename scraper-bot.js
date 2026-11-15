// Bot d'actus Feniks News
// Va chercher les derniers titres via les flux RSS officiels des grands médias
// (les flux RSS sont conçus pour être agrégés : titre + résumé court + lien,
// jamais l'article complet — on reste dans les clous niveau droits d'auteur)

const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');

const parser = new Parser();

// Remplace par tes vraies clés Supabase (Project Settings > API)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // clé "service_role", jamais côté site public
);

// Liste de flux RSS de grands médias internationaux (à adapter selon tes besoins)
const FEEDS = [
  { source: 'Reuters World', url: 'https://www.reutersagency.com/feed/?best-topics=world' },
  { source: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { source: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml' },
  { source: 'France 24', url: 'https://www.france24.com/fr/rss' },
  { source: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
];

// Traduit un texte en français via l'API publique MyMemory
// (gratuite, sans clé, limite ~500 requêtes/jour sans clé — largement
// suffisant ici). Si ça échoue, on retombe sur le texte original.
async function translateToFr(text) {
  if (!text) return text;
  try {
    const q = encodeURIComponent(text.slice(0, 450)); // limite de l'API
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${q}&langpair=en|fr`);
    const data = await res.json();
    const translated = data && data.responseData && data.responseData.translatedText;
    return translated || text;
  } catch (err) {
    return text; // on garde l'original si la traduction échoue
  }
}

// Pour ne pas traduire inutilement un texte déjà en français
function looksFrench(source) {
  return source === 'Le Monde' || source === 'France 24';
}

async function run() {
  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items.slice(0, 5)) { // 5 derniers titres par source
        const summary = (item.contentSnippet || '').slice(0, 200); // résumé court uniquement
        const alreadyFr = looksFrench(feed.source);
        const title_fr = alreadyFr ? item.title : await translateToFr(item.title);
        const summary_fr = alreadyFr ? summary : await translateToFr(summary);
        await supabase.from('news_items').upsert({
          source: feed.source,
          title: item.title,
          title_fr,
          link: item.link,
          summary,
          summary_fr,
          published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
        }, { onConflict: 'link' });
      }
      console.log(`OK: ${feed.source}`);
    } catch (err) {
      console.error(`Erreur sur ${feed.source}:`, err.message);
    }
  }
}

run().then(() => {
  console.log('Termine.');
  process.exit(0);
}).catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
