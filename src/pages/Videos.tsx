import { useState } from 'react';
import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';
import LatestVideos from '@/components/LatestVideos';

const filterTabs = [
  { label: 'Alle', slug: '' },
  { label: 'Høydepunkter', slug: 'hoydepunkter' },
  { label: 'Full kamp', slug: 'full-kamp' },
  { label: 'Match Day', slug: 'match-day' },
  { label: 'Inside', slug: 'inside' },
];

const Videos = () => {
  const [activeFilter, setActiveFilter] = useState('');

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Videoer: høydepunkter, full kamp og Match Day | Fagerborg BK"
        description="Se høydepunkter, fulle kamper og Match Day-videoer fra Fagerborg BK sine kamper."
        path="/videoer"
      />
      <Header />

      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-fagerborg-gradient py-8 md:py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl md:text-5xl font-bold text-white mb-2 md:mb-4">Se</h1>
            <p className="text-white/80 text-sm md:text-lg">
              Se høydepunkter, intervjuer og mer fra Fagerborg BK
            </p>
          </div>
        </section>

        {/* Filter Tabs */}
        <div className="bg-background border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex gap-2 py-4 overflow-x-auto">
              {filterTabs.map((tab) => (
                <button
                  key={tab.slug}
                  onClick={() => setActiveFilter(tab.slug)}
                  className={
                    'px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ' +
                    (activeFilter === tab.slug
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80')
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Videos Section - vis alle */}
        <LatestVideos
          category={activeFilter || undefined}
          limit={undefined}
          paginate
          pageSize={12}
          title={activeFilter ? undefined : 'Alle videoer'}
          hideAllLink
        />
      </main>

      <Footer />
    </div>
  );
};

export default Videos;