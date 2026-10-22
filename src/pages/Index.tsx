import Header from '@/components/Header';
import Seo from '@/components/Seo';
import { lazy, Suspense } from 'react';
import MatchCenter from '@/components/MatchCenter';
import LeagueTable from '@/components/LeagueTable';
import LatestVideos from '@/components/LatestVideos';
import InstagramFeed from '@/components/InstagramFeed';
import { HOMEPAGE_VIDEO_LIMIT } from '@/lib/homepageMedia';

import SponsorCarousel from '@/components/SponsorCarousel';
import Footer from '@/components/Footer';
import { FeatureGate } from '@/components/FeatureGate';

const HeroCarousel = lazy(() => import('@/components/HeroCarousel'));

const Index = () => {
  return (
    <div className="min-h-screen bg-page-gradient">
      <Seo
        title="Fagerborg BK – offisiell hjemmeside"
        description="Nyheter, kamper, tabeller og videoer fra Fagerborg BK, fotballklubben i Oslo stiftet i 1914."
        path="/"
      />
      <Header />
      
      <main>
        <h1 className="sr-only">Fagerborg BK – fotball i Oslo siden 1914</h1>
        {/* Hero Section with News Carousel */}
        <Suspense fallback={<section className="relative h-[70vh] md:h-[85vh] bg-fagerborg-navy" aria-busy="true" aria-label="Laster klubbnyheter" />}>
          <HeroCarousel />
        </Suspense>
        
        {/* Match Center - A-laget & B-laget */}
        <MatchCenter />
        
        {/* League Table */}
        <LeagueTable />
        
        {/* Latest Videos */}
        <LatestVideos limit={HOMEPAGE_VIDEO_LIMIT} homepage />
        <InstagramFeed />
        
        {/* Sponsor Carousel - Only shown when sponsors_enabled is true */}
        <FeatureGate feature="sponsors_enabled">
          <SponsorCarousel />
        </FeatureGate>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;