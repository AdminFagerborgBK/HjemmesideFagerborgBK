const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

interface ImportedArticle {
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
    const { startPage = 1, endPage = 100, updateExisting = false } = await req.json();

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

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[migrate-news] Starting migration from page ${startPage} to ${endPage}...`);

    // Get existing slugs
    const { data: existingNews } = await supabase.from('news').select('slug');
    const existingSlugs = new Set((existingNews || []).map(n => n.slug));
    console.log(`[migrate-news] ${existingSlugs.size} existing articles`);

    const newArticles: ImportedArticle[] = [];
    const updatedArticles: ImportedArticle[] = [];
    const errors: string[] = [];
    let totalLinksFound = 0;

    // Iterate through archive pages
    for (let page = startPage; page <= endPage; page++) {
      const archiveUrl = page === 1 
        ? 'https://www.fagerborgbk.no/next/home/archive'
        : `https://www.fagerborgbk.no/next/home/archive?p=${page}`;

      console.log(`[migrate-news] Scraping archive page ${page}...`);

      try {
        // Scrape the archive page to get article links
        const archiveResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: archiveUrl,
            formats: ['html', 'links'],
            waitFor: 2000,
          }),
        });

        if (!archiveResponse.ok) {
          console.error(`[migrate-news] Failed to scrape archive page ${page}`);
          continue;
        }

        const archiveData = await archiveResponse.json();
        const links: string[] = archiveData.data?.links || archiveData.links || [];
        
        // Filter for blog post URLs
        const articleLinks = links.filter((link: string) => 
          link.includes('/next/blog/post/') || 
          (link.includes('/next/home/') && !link.includes('archive') && !link.endsWith('/home'))
        );

        if (articleLinks.length === 0) {
          console.log(`[migrate-news] No more articles on page ${page}, stopping...`);
          break;
        }

        totalLinksFound += articleLinks.length;
        console.log(`[migrate-news] Found ${articleLinks.length} article links on page ${page}`);

        // Scrape each article
        for (const articleUrl of articleLinks) {
          // Generate slug from URL
          const urlParts = articleUrl.split('/');
          let slug = urlParts[urlParts.length - 1];
          // Clean up slug - remove query params and normalize
          slug = slug.split('?')[0].toLowerCase()
            .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
            .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

          const alreadyExists = existingSlugs.has(slug);
          if (alreadyExists && !updateExisting) {
            console.log(`[migrate-news] Skipping existing: ${slug}`);
            continue;
          }

          console.log(`[migrate-news] Scraping article: ${slug}`);

          try {
            const articleResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${firecrawlApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: articleUrl,
                formats: ['markdown'],
                onlyMainContent: true,
                waitFor: 2000,
              }),
            });

            if (!articleResponse.ok) {
              errors.push(`Failed to scrape ${slug}`);
              continue;
            }

            const articleData = await articleResponse.json();
            const markdown = articleData.data?.markdown || articleData.markdown;
            const metadata = articleData.data?.metadata || articleData.metadata || {};

            if (!markdown || markdown.length < 50) {
              errors.push(`No content for ${slug}`);
              continue;
            }

            // Parse article content
            let title = metadata.title || '';
            const titleMatch = markdown.match(/^#\s+(.+)$/m);
            if (titleMatch) {
              title = titleMatch[1].trim();
            }
            if (!title) {
              title = slug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
            }
            // Clean title of site suffix
            title = title.replace(/\s*[-–|]\s*Fagerborg.*$/i, '').trim();

            // Get first paragraph as excerpt
            const cleanContent = markdown.replace(/^#.+\n+/m, '').trim();
            const paragraphs = cleanContent.split('\n\n').filter((p: string) => p.trim() && !p.startsWith('#') && !p.startsWith('!'));
            const excerpt = paragraphs[0]?.slice(0, 250) || null;

            // Find image
            const imgMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
            const image_url = imgMatch ? imgMatch[1] : (metadata.ogImage || null);

            // Parse date
            let published_at: string | null = null;
            // Match patterns like "26. Jan 2019" or "3. februar 2020"
            const dateMatch = markdown.match(/(\d{1,2})\.\s*(jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)[a-z]*\.?\s*(\d{4})/i);
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

            const article: ImportedArticle = {
              title: title.slice(0, 255),
              slug,
              excerpt,
              content: cleanContent,
              image_url,
              published_at,
              category: 'Generelt',
              author: 'Fagerborg BK',
            };

            if (alreadyExists) {
              updatedArticles.push(article);
            } else {
              newArticles.push(article);
              existingSlugs.add(slug);
            }

            console.log(`[migrate-news] Extracted: ${title} (${cleanContent.length} chars)`);

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (e) {
            errors.push(`Error scraping ${slug}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        // Rate limiting between pages
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (e) {
        errors.push(`Error on page ${page}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Insert new articles
    let inserted = 0;
    for (const article of newArticles) {
      const { error } = await supabase.from('news').insert({
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
        if (error.code !== '23505') {
          errors.push(`Insert error ${article.slug}: ${error.message}`);
        }
      } else {
        inserted++;
      }
    }

    // Update existing articles if requested
    let updated = 0;
    if (updateExisting) {
      for (const article of updatedArticles) {
        const { error } = await supabase.from('news')
          .update({
            content: article.content,
            excerpt: article.excerpt,
            image_url: article.image_url,
            published_at: article.published_at,
          })
          .eq('slug', article.slug);

        if (error) {
          errors.push(`Update error ${article.slug}: ${error.message}`);
        } else {
          updated++;
        }
      }
    }

    console.log(`[migrate-news] Done: ${inserted} inserted, ${updated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        totalLinksFound,
        articlesScraped: newArticles.length + updatedArticles.length,
        inserted,
        updated,
        errors: errors.slice(0, 20), // Limit error output
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[migrate-news] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
