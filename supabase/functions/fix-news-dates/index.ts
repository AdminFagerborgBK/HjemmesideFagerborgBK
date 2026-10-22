import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { requireAdminOrSecret } from '../_shared/adminAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-zæøå0-9]/g, '')
    .slice(0, 30);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const unauth = await requireAdminOrSecret(req);
  if (unauth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'list', startIndex = 0, batchSize = 10 } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get article URLs from old site
    const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://www.fagerborgbk.no/next/blog/post',
        limit: 500,
        includeSubdomains: false,
      }),
    });

    const mapData = await mapResponse.json();
    const allLinks: string[] = mapData.links || [];
    const articleUrls = allLinks.filter(link => 
      link.includes('/next/blog/post/') && 
      /\/\d+\//.test(link)
    );

    if (action === 'list') {
      return new Response(
        JSON.stringify({ success: true, totalArticles: articleUrls.length, articleUrls }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'process') {
      const batch = articleUrls.slice(startIndex, startIndex + batchSize);
      console.log(`[fix-dates] Processing batch ${startIndex}-${startIndex + batch.length} of ${articleUrls.length}`);

      const updates: { title: string; oldDate: string; newDate: string; status: string }[] = [];
      const { data: dbArticles } = await supabase.from('news').select('id, title, slug, published_at');

      // Create a map of normalized titles for matching
      const dbTitleMap = new Map<string, typeof dbArticles[0]>();
      for (const article of dbArticles || []) {
        dbTitleMap.set(normalizeTitle(article.title), article);
        // Also map by slug
        dbTitleMap.set(article.slug.replace(/-/g, ''), article);
      }

      for (const url of batch) {
        try {
          console.log(`[fix-dates] Scraping ${url}`);
          
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url,
              formats: ['markdown'],
              onlyMainContent: true,
              waitFor: 2000,
            }),
          });

          if (!scrapeResponse.ok) continue;

          const scrapeData = await scrapeResponse.json();
          const markdown = scrapeData.data?.markdown || '';
          const metadata = scrapeData.data?.metadata || {};
          const urlSlug = url.split('/').pop()?.replace(/\?.*$/, '') || '';

          // Extract title
          let title = metadata.title || '';
          const titleMatch = markdown.match(/^#\s+(.+)$/m);
          if (titleMatch) title = titleMatch[1].trim();
          // Clean up common patterns
          title = title.replace(/\s*\|\s*Fagerborg.*$/i, '').trim();

          console.log(`[fix-dates] Title: "${title}", URL slug: "${urlSlug}"`);

          // Extract date
          const dateMatch = markdown.match(/(\d{1,2})[.\s]+(jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)[a-zæøå]*[.\s]+(\d{4})/i);
          if (!dateMatch) {
            console.log(`[fix-dates] No date found in ${url}`);
            continue;
          }

          const months: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', mai: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', des: '12'
          };
          const day = dateMatch[1].padStart(2, '0');
          const month = months[dateMatch[2].toLowerCase().slice(0, 3)] || '01';
          const year = dateMatch[3];
          const newDate = `${year}-${month}-${day}T12:00:00Z`;

          console.log(`[fix-dates] Date found: ${year}-${month}-${day}`);

          // Find matching article
          let dbArticle = dbTitleMap.get(normalizeTitle(title));
          if (!dbArticle) {
            dbArticle = dbTitleMap.get(urlSlug.replace(/-/g, ''));
          }
          // Try partial match
          if (!dbArticle && title) {
            for (const [key, article] of dbTitleMap) {
              if (key.includes(normalizeTitle(title).slice(0, 15)) || 
                  normalizeTitle(title).includes(key.slice(0, 15))) {
                dbArticle = article;
                break;
              }
            }
          }

          if (dbArticle) {
            const oldDate = dbArticle.published_at?.slice(0, 10) || 'null';
            
            if (oldDate !== `${year}-${month}-${day}`) {
              const { error: updateError } = await supabase
                .from('news')
                .update({ published_at: newDate })
                .eq('id', dbArticle.id);

              updates.push({
                title: dbArticle.title,
                oldDate: dbArticle.published_at || 'null',
                newDate,
                status: updateError ? `Error: ${updateError.message}` : 'Updated',
              });

              console.log(`[fix-dates] ✓ Updated: ${dbArticle.title} (${oldDate} -> ${year}-${month}-${day})`);
            } else {
              console.log(`[fix-dates] Already correct: ${dbArticle.title}`);
            }
          } else {
            console.log(`[fix-dates] ✗ No match found for: "${title}"`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (e) {
          console.error(`[fix-dates] Error:`, e);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: batch.length,
          nextIndex: startIndex + batch.length,
          hasMore: startIndex + batch.length < articleUrls.length,
          totalArticles: articleUrls.length,
          updates,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fix-dates] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
