import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Variants, Easing } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFeaturedNews } from '@/hooks/useNews';
import fagerborgLogo from '@/assets/fagerborg-logo.png';

const FeaturedPlaceholder = () => (
  <div className="w-full h-full bg-fagerborg-navy flex items-center justify-center">
    <img src={fagerborgLogo} alt="" className="w-32 h-32 md:w-48 md:h-48 opacity-40" />
  </div>
);

const easeOut: Easing = [0.33, 1, 0.68, 1];

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.5 },
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.3 },
    },
  }),
};

const contentVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: easeOut,
      staggerChildren: 0.1,
    },
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const HeroCarousel = () => {
  const { data: featuredNews, isLoading } = useFeaturedNews(3);
  const [[currentSlide, direction], setSlide] = useState([0, 0]);
  const slideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slides = featuredNews?.map((news) => ({
    id: news.id,
    image: news.image_url,
    title: news.title,
    subtitle: news.category.toUpperCase(),
    description: news.excerpt || '',
    slug: news.slug,
    imageFocalY: (news as any).image_focal_y ?? 50,
  })) || [];

  const slideCount = slides.length || 1;

  const clearTimer = useCallback(() => {
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
      slideTimeoutRef.current = null;
    }
  }, []);

  const paginate = useCallback((newDirection: number) => {
    setSlide(([prev]) => [
      (prev + newDirection + slideCount) % slideCount,
      newDirection,
    ]);
  }, [slideCount]);

  const goToSlide = (index: number) => {
    const newDirection = index > currentSlide ? 1 : -1;
    setSlide([index, newDirection]);
  };

  // Auto-advance: one timeout per slide, always re-armed after each change
  useEffect(() => {
    if (slides.length <= 1) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    slideTimeoutRef.current = setTimeout(() => {
      setSlide(([prev]) => [(prev + 1) % slideCount, 1]);
    }, 4000);
    return clearTimer;
  }, [currentSlide, slideCount, slides.length, clearTimer]);

  // Preload each slide image once and keep the references alive, so cycling
  // through the carousel does not re-download the same files.
  const preloadedRef = useRef<HTMLImageElement[]>([]);
  const imageKey = slides.map((s) => s.image).join('|');
  useEffect(() => {
    preloadedRef.current = slides
      .map((s) => s.image)
      .filter((src): src is string => !!src)
      .map((src) => {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
        return img;
      });
  }, [imageKey]);

  // Restart timer when returning to the page (iOS Safari kills intervals in background)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && slides.length > 1) {
        clearTimer();
        slideTimeoutRef.current = setTimeout(() => {
          setSlide(([prev]) => [(prev + 1) % slideCount, 1]);
        }, 4000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [slides.length, slideCount, clearTimer]);

  if (isLoading || slides.length === 0) {
    return (
      <section className="relative h-[70vh] md:h-[85vh] bg-fagerborg-navy flex items-center justify-center">
        <div className="text-white/60">Laster nyheter...</div>
      </section>
    );
  }

  const currentNews = slides[currentSlide];

  return (
    <section className="relative h-[70vh] md:h-[85vh] overflow-hidden bg-navy-900">
      {/* Background slide */}
      <AnimatePresence custom={direction} mode="popLayout">
        <motion.div
          key={currentSlide}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0"
        >
          {currentNews.image ? (
            <motion.img
              key={`img-${currentSlide}`}
              src={currentNews.image}
              alt={currentNews.title}
              className="w-full h-full object-cover"
              style={{
                objectPosition: `center ${currentNews.imageFocalY}%`,
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
              initial={{ scale: 1.25 }}
              animate={{ scale: 1, transition: { duration: 8, ease: 'linear' } }}
              exit={{ scale: 1 }}
            />
          ) : (
            <FeaturedPlaceholder />
          )}
          <div className="absolute inset-0 hero-gradient-overlay" />
        </motion.div>
      </AnimatePresence>

      {/* Title overlay */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          className="absolute bottom-20 md:bottom-36 left-0 right-0 p-6 md:p-12 lg:p-16 z-10"
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="container mx-auto">
            <Link to={`/nyheter/${currentNews.slug}`}>
              <motion.h2
                variants={itemVariants}
                className="text-2xl md:text-5xl lg:text-6xl font-bold text-white mb-4 max-w-3xl leading-tight hover:text-secondary/90 transition-colors line-clamp-3"
              >
                {currentNews.title}
              </motion.h2>
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      <div className="absolute bottom-20 md:bottom-36 right-6 md:right-12 lg:right-16 z-20 flex gap-1">
        <motion.button
          onClick={() => paginate(-1)}
          className="p-2.5 bg-primary hover:bg-primary/80 transition-colors"
          aria-label="Forrige"
          whileTap={{ scale: 0.95 }}
        >
          <ChevronLeft className="w-5 h-5 text-primary-foreground" />
        </motion.button>
        <motion.button
          onClick={() => paginate(1)}
          className="p-2.5 bg-primary hover:bg-primary/80 transition-colors"
          aria-label="Neste"
          whileTap={{ scale: 0.95 }}
        >
          <ChevronRight className="w-5 h-5 text-primary-foreground" />
        </motion.button>
      </div>

      {/* Bottom news cards - Chelsea style */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          {/* Desktop: show all 3 cards */}
          <div className="hidden md:grid md:grid-cols-3 gap-0">
            {slides.slice(0, 3).map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`text-left px-5 py-4 transition-all duration-300 border-b-[3px] ${
                  index === currentSlide
                    ? 'bg-white/15 backdrop-blur-md border-primary'
                    : 'bg-black/40 backdrop-blur-sm border-transparent hover:bg-white/10'
                }`}
              >
                <span className={`text-xs font-bold uppercase tracking-wider block mb-1.5 ${
                  index === currentSlide ? 'text-primary' : 'text-white/60'
                }`}>
                  {slide.subtitle}
                </span>
                <span className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                  {slide.title}
                </span>
              </button>
            ))}
          </div>
          {/* Mobile: dots + compact active title */}
          <div className="md:hidden flex items-center gap-3 px-2 py-3 bg-black/50 backdrop-blur-sm">
            <div className="flex gap-1.5">
              {slides.slice(0, 5).map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`rounded-full transition-all ${
                    index === currentSlide ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-white/40'
                  }`}
                  aria-label={`Slide ${index + 1}`}
                />
              ))}
            </div>
            <Link to={`/nyheter/${currentNews.slug}`} className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-white line-clamp-1">
                {currentNews.title}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;
