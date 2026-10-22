import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLatestNews } from '@/hooks/useNews';
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';

const NewsPlaceholder = () => (
  <div className="w-full h-full bg-fagerborg-navy/10 flex items-center justify-center">
    <img src={fagerborgLogo} alt="" className="w-16 h-16 opacity-30" />
  </div>
);

const LatestNews = () => {
  const { data: news, isLoading } = useLatestNews(4);

  const getTimeAgo = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: nb });
  };

  return (
    <section className="py-12 bg-muted" id="nyheter">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Siste Nyheter
          </h2>
          <Link 
            to="/nyheter" 
            className="text-primary hover:text-primary/80 font-semibold flex items-center gap-1 transition-colors"
          >
            Se alle nyheter
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Laster nyheter...</div>
        ) : !news || news.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Ingen nyheter funnet</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {news.map((item, index) => (
              <Link 
                to={`/nyheter/${item.slug}`}
                key={item.id}
                className="group bg-card rounded-xl overflow-hidden shadow-card hover:shadow-elevated transition-shadow cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative overflow-hidden aspect-[4/3]">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <NewsPlaceholder />
                  )}
                  <span className="absolute top-3 left-3 px-2 py-1 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide rounded">
                    {item.category}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-3">
                    {item.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.category}</span>
                    <span>{getTimeAgo(item.published_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default LatestNews;
