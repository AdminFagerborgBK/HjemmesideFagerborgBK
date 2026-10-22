import { useRef, useState, useEffect, useCallback } from 'react';
import { useSiteSponsors, useTrackSponsorClick } from '@/hooks/useSiteSponsors';

const SponsorCarousel = () => {
  const { data: sponsors, isLoading } = useSiteSponsors();
  const trackClick = useTrackSponsorClick();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  // Drag state
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    animOffset: 0,
    didDrag: false,
  });
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [animDelay, setAnimDelay] = useState(0);

  const captureAnimOffset = useCallback(() => {
    const track = trackRef.current;
    if (!track || trackWidth === 0) return 0;
    const style = getComputedStyle(track);
    const matrix = new DOMMatrix(style.transform);
    return matrix.m41;
  }, [trackWidth]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (trackWidth === 0) return;
    const offset = captureAnimOffset();
    dragState.current = {
      isDragging: true,
      startX: e.clientX,
      animOffset: offset,
      didDrag: false,
    };
  }, [trackWidth, captureAnimOffset]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.isDragging) return;

    const delta = e.clientX - dragState.current.startX;

    if (!dragState.current.didDrag && Math.abs(delta) > 6) {
      dragState.current.didDrag = true;
      setIsPaused(true);
      setIsDragging(true);
      setDragOffset(dragState.current.animOffset);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    if (!dragState.current.didDrag) return;

    e.preventDefault();
    setDragOffset(dragState.current.animOffset + delta);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.isDragging) return;

    const wasDragging = dragState.current.didDrag;
    dragState.current.isDragging = false;

    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }

    if (!wasDragging) {
      return;
    }

    if (trackWidth > 0) {
      const currentPos = dragOffset;
      const normalized = (((-currentPos) % trackWidth) + trackWidth) % trackWidth;
      const delaySeconds = (normalized / trackWidth) * (trackWidth / 40);
      setAnimDelay(-delaySeconds);
    }

    setIsDragging(false);
    setIsPaused(false);
  }, [dragOffset, trackWidth]);

  // Filter by tier
  const mainSponsors = sponsors?.filter(s => s.tier === 'main') || [];
  const partners = sponsors?.filter(s => s.tier === 'partner') || [];

  // Calculate how many sets we'll use
  const minSetsVal = partners.length > 0 ? Math.max(2, Math.ceil(10 / partners.length)) : 2;
  const totalSets = minSetsVal * 2;

  // Measure one set of partners width
  useEffect(() => {
    if (!trackRef.current || partners.length === 0) return;

    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      // One "half" = total scrollWidth / 2, since we want to scroll exactly half
      const halfWidth = track.scrollWidth / 2;
      setTrackWidth(halfWidth);
    };

    const images = trackRef.current.querySelectorAll('img');
    let loaded = 0;
    const total = images.length;

    if (total === 0) { measure(); return; }

    const onLoad = () => { loaded++; if (loaded >= total) measure(); };

    images.forEach(img => {
      if (img.complete) loaded++;
      else { img.addEventListener('load', onLoad); img.addEventListener('error', onLoad); }
    });

    if (loaded >= total) measure();

    return () => {
      images.forEach(img => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onLoad);
      });
    };
  }, [partners.length, totalSets]);

  // Duplicate partners enough times to always overflow the viewport
  const minSets = partners.length > 0 ? Math.max(2, Math.ceil(10 / partners.length)) : 2;
  const displayPartners = Array.from({ length: minSets * 2 }, () => partners).flat();

  // Calculate animation duration based on width (slower = smoother)
  const duration = trackWidth > 0 ? trackWidth / 40 : 20; // ~40px per second

  if (isLoading) {
    return (
      <section className="py-12 md:py-16 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          Laster sponsorer...
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-background to-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Hovedsponsor - only shown when active main sponsors exist */}
        {mainSponsors.length > 0 && (
          <div className="text-center mb-12">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-4">Hovedsponsor</p>
            <a 
              href={mainSponsors[0].website_url || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => trackClick(mainSponsors[0].id)}
              className="inline-block bg-white rounded-2xl p-8 shadow-elevated hover:shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              {mainSponsors[0].logo_url ? (
                <img
                  src={mainSponsors[0].logo_url}
                  alt={`${mainSponsors[0].name} - Hovedsponsor`}
                  className="h-24 md:h-32 w-auto object-contain"
                />
              ) : (
                <span className="text-2xl font-bold text-foreground">{mainSponsors[0].name}</span>
              )}
            </a>
            <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto mt-6">
              Vi er stolte av å ha {mainSponsors[0].name} som vår hovedsponsor. Sammen bygger vi fremtiden for Fagerborg BK.
            </p>
            {mainSponsors[0].website_url && (
              <a 
                href={mainSponsors[0].website_url} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={() => trackClick(mainSponsors[0].id)}
                className="inline-flex items-center justify-center mt-6 px-8 py-3 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors"
              >
                Besøk {mainSponsors[0].name}
              </a>
            )}
          </div>
        )}

        {/* Partners section */}
        {partners.length > 0 && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                Våre partnere
              </h2>
            </div>
            
            {/* Scrolling sponsor logos - CSS animation based */}
            <div className="relative">
              {/* Gradient overlays */}
              <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
              
              <div
                className="overflow-hidden py-6 touch-pan-y"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDragStart={(e) => e.preventDefault()}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <div 
                  ref={trackRef}
                  className="flex gap-8 w-max select-none"
                  style={isDragging ? {
                    transform: `translateX(${dragOffset}px)`,
                    willChange: 'transform',
                  } : {
                    animation: trackWidth > 0 ? `sponsor-scroll ${duration}s linear infinite` : 'none',
                    animationDelay: `${animDelay}s`,
                    animationPlayState: isPaused ? 'paused' : 'running',
                  }}
                >
                  {displayPartners.map((sponsor, index) => (
                    <a
                      key={`${sponsor.id}-${index}`}
                      href={sponsor.website_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { if (dragState.current.didDrag) { e.preventDefault(); return; } trackClick(sponsor.id); }}
                      onMouseEnter={() => { if (!isDragging) setIsPaused(true); }}
                      onMouseLeave={() => { if (!isDragging) setIsPaused(false); }}
                      className="flex-shrink-0 bg-gradient-to-br from-white to-muted/50 rounded-xl px-8 py-5 shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 group min-w-[180px] border border-border/50"
                    >
                      <div className="h-16 md:h-20 flex items-center justify-center">
                        {sponsor.logo_url ? (
                          <img
                            src={sponsor.logo_url}
                            alt={sponsor.name}
                            className="h-full w-auto max-w-[140px] object-contain pointer-events-none"
                            draggable={false}
                          />
                        ) : (
                          <span className="text-base md:text-lg font-bold text-foreground text-center leading-tight tracking-tight group-hover:text-primary transition-colors">
                            {sponsor.name}
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default SponsorCarousel;