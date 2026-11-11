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

async function run() {
  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items.slice(0, 5)) { // 5 derniers titres par source
        await supabase.from('news_items').upsert({
          source: feed.source,
          title: item.title,
          link: item.link,
          summary: (item.contentSnippet || '').slice(0, 200), // résumé court uniquement
          published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
        }, { onConflict: 'link' });
      }
      console.log(`OK: ${feed.source}`);
    } catch (err) {
      console.error(`Erreur sur ${feed.source}:`, err.message);
    }
  }
}

run();
