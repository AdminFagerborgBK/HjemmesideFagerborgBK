import stormElektroLogo from '@/assets/storm-elektro-logo.jpeg';

const PromoVideo = () => {
  return (
    <section className="py-12 bg-fagerborg-navy">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <span className="inline-block px-3 py-1 bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wider rounded mb-4">
              Hovedsponsor
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
              Storm Elektro AS - 100 år siden 1926
            </h2>
            <p className="text-white/70 text-lg mb-6">
              Vi er stolte av å ha Storm Elektro AS som vår hovedsponsor. 
              Sammen bygger vi fremtiden for Fagerborg BK.
            </p>
            <a 
              href="https://stormelektro.no" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-secondary/90 transition-colors"
            >
              Besøk Storm Elektro
            </a>
          </div>

          {/* Logo/Image */}
          <div className="flex-1 flex justify-center">
            <div className="bg-white rounded-2xl p-8 shadow-elevated max-w-md w-full">
              <img
                src={stormElektroLogo}
                alt="Storm Elektro AS - 100 år siden 1926"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromoVideo;
