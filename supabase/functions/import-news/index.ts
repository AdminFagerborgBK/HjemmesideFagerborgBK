const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const ARCHIVE_URL = 'https://www.fagerborgbk.no/next/home/archive';

interface NewsArticle {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  image_url: string | null;
  published_at: string | null;
  category: string;
  author: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[import-news] Starting news import...');
    
    // Get Firecrawl API key
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Map the archive page to find all article links
    console.log('[import-news] Mapping archive page...');
    const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://www.fagerborgbk.no',
        search: 'archive',
        limit: 500,
        includeSubdomains: false,
      }),
    });

    if (!mapResponse.ok) {
      const error = await mapResponse.text();
      console.error('[import-news] Map failed:', error);
      return new Response(
        JSON.stringify({ success: false, error: `Map failed: ${error}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mapData = await mapResponse.json();
    console.log('[import-news] Map result:', JSON.stringify(mapData).slice(0, 500));

    // Extract article URLs from the mapped links
    const allLinks: string[] = mapData.links || [];
    const articleLinks = allLinks.filter((link: string) => 
      link.includes('/next/home/') && 
      !link.endsWith('/archive') &&
      !link.endsWith('/home') &&
      !link.includes('?')
    );

    console.log(`[import-news] Found ${articleLinks.length} potential article links`);

    // Get existing slugs to avoid duplicates
    const { data: existingNews } = await supabase
      .from('news')
      .select('slug');
    
    const existingSlugs = new Set((existingNews || []).map(n => n.slug));
    console.log(`[import-news] ${existingSlugs.size} existing articles in database`);

    // Step 2: Scrape each article that doesn't already exist
    const newArticles: NewsArticle[] = [];
    const errors: string[] = [];

    for (const articleUrl of articleLinks) {
      // Extract slug from URL
      const urlParts = articleUrl.split('/');
      const slug = urlParts[urlParts.length - 1];
      
      if (existingSlugs.has(slug)) {
        console.log(`[import-news] Skipping existing: ${slug}`);
        continue;
      }

      console.log(`[import-news] Scraping: ${articleUrl}`);
      
      try {
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: articleUrl,
            formats: ['markdown', 'html'],
            onlyMainContent: true,
            waitFor: 3000,
          }),
        });

        if (!scrapeResponse.ok) {
          errors.push(`Failed to scrape ${articleUrl}`);
          continue;
        }

        const scrapeData = await scrapeResponse.json();
        const data = scrapeData.data || scrapeData;
        
        if (!data.markdown) {
          errors.push(`No content for ${articleUrl}`);
          continue;
        }

        // Extract article data
        const markdown = data.markdown as string;
        const metadata = data.metadata || {};
        
        // Try to extract title from metadata or first heading
        let title = metadata.title || '';
        const titleMatch = markdown.match(/^#\s+(.+)$/m);
        if (titleMatch && !title) {
          title = titleMatch[1].trim();
        }
        if (!title) {
          title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }

        // Extract first paragraph as excerpt
        const paragraphs = markdown.split('\n\n').filter(p => p.trim() && !p.startsWith('#'));
        const excerpt = paragraphs[0]?.slice(0, 300) || null;

        // Try to find image
        const imgMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
        const image_url = imgMatch ? imgMatch[1] : (metadata.ogImage || null);

        // Try to parse date from content or use current
        let published_at: string | null = null;
        const dateMatch = markdown.match(/(\d{1,2})\.\s*(jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)[a-z]*\s*(\d{4})/i);
        if (dateMatch) {
          const months: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', mai: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', des: '12'
          };
          const day = dateMatch[1].padStart(2, '0');
          const month = months[dateMatch[2].toLowerCase().slice(0, 3)] || '01';
          const year = dateMatch[3];
          published_at = `${year}-${month}-${day}T12:00:00Z`;
        }

        newArticles.push({
          title: title.slice(0, 255),
          slug,
          excerpt,
          content: markdown,
          image_url,
          published_at,
          category: 'Generelt',
          author: 'Fagerborg BK',
        });

        console.log(`[import-news] Extracted: ${title}`);

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        errors.push(`Error scraping ${articleUrl}: ${errorMsg}`);
      }
    }

    console.log(`[import-news] Scraped ${newArticles.length} new articles`);

    // Step 3: Insert new articles into database
    let inserted = 0;
    for (const article of newArticles) {
      const { error } = await supabase
        .from('news')
        .insert({
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          content: article.content,
          image_url: article.image_url,
          published_at: article.published_at,
          category: article.category,
          author: article.author,
          is_published: true,
          is_featured: false,
        });

      if (error) {
        if (error.code === '23505') {
          console.log(`[import-news] Duplicate slug: ${article.slug}`);
        } else {
          errors.push(`Insert error for ${article.slug}: ${error.message}`);
        }
      } else {
        inserted++;
      }
    }

    console.log(`[import-news] Inserted ${inserted} articles`);

    return new Response(
      JSON.stringify({
        success: true,
        articlesFound: articleLinks.length,
        articlesScraped: newArticles.length,
        articlesInserted: inserted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[import-news] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
