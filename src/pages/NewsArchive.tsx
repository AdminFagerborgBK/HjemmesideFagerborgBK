import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import { useNews, useNewsCategories } from '@/hooks/useNews';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { formatDistanceToNow, format } from 'date-fns';
import { nb } from 'date-fns/locale';

const NewsPlaceholder = () => (
  <div className="w-full h-full bg-fagerborg-navy/10 flex items-center justify-center">
    <img src={fagerborgLogo} alt="" className="w-20 h-20 opacity-30" />
  </div>
);

const NewsImage = ({ src, alt }: { src: string; alt: string }) => {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Hide the broken image and show placeholder instead
    e.currentTarget.style.display = 'none';
    e.currentTarget.parentElement?.querySelector('.news-placeholder')?.classList.remove('hidden');
  };

  return (
    <>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={handleError}
      />
      <div className="news-placeholder hidden absolute inset-0">
        <NewsPlaceholder />
      </div>
    </>
  );
};

const NewsArchive = () => {
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data: news, isLoading } = useNews(selectedCategory, searchQuery);
  const { data: categories } = useNewsCategories();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Nyheter og nyhetsarkiv | Fagerborg BK"
        description="Les de siste nyhetene, kampreferatene og klubbmeldingene fra Fagerborg BK i Oslo."
        path="/nyheter"
      />
      <Header />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-fagerborg-gradient py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Nyhetsarkiv</h1>
            <p className="text-white/80 text-lg max-w-2xl">
              Hold deg oppdatert med de siste nyhetene fra Fagerborg BK
            </p>
          </div>
        </section>

        {/* Search and Filter */}
        <section className="py-8 bg-card border-b border-border">
          <div className="container mx-auto px-4">
            <h2 className="sr-only">Søk og filtrer nyheter</h2>
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Search */}
              <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Søk i nyheter..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button type="submit">Søk</Button>
              </form>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                {categories?.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === category
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* News Grid */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            <h2 className="sr-only">Nyhetsartikler</h2>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Laster nyheter...</div>
            ) : !news || news.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Ingen nyheter funnet</p>
                <Button variant="outline" onClick={() => { setSearchQuery(''); setSelectedCategory('Alle'); }}>
                  Nullstill filter
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {news.map((item) => (
                  <Link
                    key={item.id}
                    to={`/nyheter/${item.slug}`}
                    className="group bg-card rounded-xl overflow-hidden shadow-card hover:shadow-elevated transition-all"
                  >
                    <div className="relative overflow-hidden aspect-video">
                      {item.image_url ? (
                        <NewsImage src={item.image_url} alt={item.title} />
                      ) : (
                        <NewsPlaceholder />
                      )}
                      <span className="absolute top-3 left-3 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide rounded">
                        {item.category}
                      </span>
                    </div>
                    <div className="p-6">
                      <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-3">
                        {item.title}
                      </h3>
                      {item.excerpt && (
                        <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                          {item.excerpt}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(item.published_at), 'd. MMMM yyyy', { locale: nb })}</span>
                        </div>
                        <span className="flex items-center gap-1 text-primary font-medium">
                          Les mer <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default NewsArchive;
