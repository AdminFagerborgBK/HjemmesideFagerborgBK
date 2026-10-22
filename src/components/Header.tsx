import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogIn, ChevronRight, ArrowRight } from 'lucide-react';
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSiteSetting } from '@/hooks/useSiteSettings';
import { useUpcomingMatches } from '@/hooks/useMatches';
import { useOpponentLogos, findOpponentLogo } from '@/hooks/useOpponentLogos';
import { formatOsloDateLong, formatOsloTime } from '@/lib/osloTime';

interface NavChild {
  label: string;
  href: string;
  featureKey?: string;
}

interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
  showNextMatch?: boolean;
}

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const location = useLocation();
  const { isAdmin } = useAdminAuth();
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { value: showPodcast } = useSiteSetting('show_podcast');
  const { value: showLivestream } = useSiteSetting('show_livestream');
  const { data: upcomingMatches } = useUpcomingMatches(1);
  const { data: logoMap } = useOpponentLogos();
  const nextMatch = upcomingMatches?.[0];

  const navItems: NavItem[] = [
    { label: 'Nyheter', href: '/nyheter' },
    {
      label: 'Kamper',
      href: '/kamper',
      showNextMatch: true,
      children: [
        { label: 'A-laget', href: '/kamper?lag=A-laget' },
        { label: 'B-laget', href: '/kamper?lag=B-laget' },
      ],
    },
    { label: 'Tabell', href: '/tabell' },
    {
      label: 'Se',
      href: '/videoer',
      children: [
        { label: 'Siste videoer', href: '/videoer' },
        { label: 'Høydepunkter', href: '/videoer/hoydepunkter' },
        { label: 'Full kamp', href: '/videoer/full-kamp' },
        { label: 'Podcast', href: '/videoer/podcast', featureKey: 'show_podcast' },
        { label: 'Direktesendinger', href: '/videoer/direktesendinger', featureKey: 'show_livestream' },
      ],
    },
    { label: 'Spillerstall', href: '/spillerstall' },
    { label: 'Bli medlem', href: '/bli-medlem', children: [
      { label: 'Bli støttemedlem', href: '/bli-medlem' },
      { label: 'Bli spiller', href: '/bli-spiller' },
    ] },
    {
      label: 'Om klubben',
      href: '/om-klubben',
      children: [
        { label: 'Om oss', href: '/om-klubben' },
        { label: 'Styret', href: '/styret' },
        { label: 'Bli partner', href: '/bli-partner' },
        { label: 'Målklubben', href: '/malklubben' },
        { label: 'Kontakt', href: '/kontakt' },
        { label: 'Personvern', href: '/personvern' },
        { label: 'Vilkår', href: '/vilkar' },
      ],
    },
  ];

  const isActive = (href: string) => location.pathname === href;
  const isChildActive = (item: NavItem) =>
    item.children?.some((child) => location.pathname === child.href);

  useEffect(() => {
    setOpenDropdown(null);
    setIsMenuOpen(false);
    setMobileExpanded(null);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  const handleMouseEnter = (label: string) => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setOpenDropdown(label);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 200);
  };

  const isChildVisible = (child: NavChild) => {
    if (!child.featureKey) return true;
    if (child.featureKey === 'show_podcast') return showPodcast === true;
    if (child.featureKey === 'show_livestream') return showLivestream !== false;
    return true;
  };

  useEffect(() => {
    const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setIsMenuOpen(false);setOpenDropdown(null);}};
    document.addEventListener('keydown',close);
    return ()=>document.removeEventListener('keydown',close);
  },[]);

  const getOpponentLogo = () => {
    if (!nextMatch || !logoMap) return null;
    return findOpponentLogo(logoMap, nextMatch.opponent, (nextMatch as any).opponent_logo_url);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-fagerborg-navy">
      {/* Admin bar */}
      {isAdmin && (
        <div className="bg-fagerborg-navy/80 border-b border-white/5">
          <div className="container mx-auto px-4">
            <Link
              to="/admin"
              className="flex items-center gap-1.5 py-1 text-xs text-white/40 hover:text-white/70 transition-colors w-fit"
            >
              <LogIn className="w-3 h-3" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      )}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20 md:h-24">
          {/* Logo and Club Name */}
          <Link to="/" className="flex items-center gap-4">
            <img
              src={fagerborgLogo}
              alt="Fagerborg BK"
              className="h-14 md:h-16 w-auto"
            />
            <div className="hidden sm:block">
              <div className="text-white font-bold text-xl md:text-2xl tracking-tight">
                Fagerborg BK
              </div>
              <p className="text-white/60 text-xs uppercase tracking-widest">
                Stiftet 1914
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const visibleChildren = item.children?.filter(isChildVisible);
              const hasChildren = visibleChildren && visibleChildren.length > 0;

              return (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => hasChildren ? handleMouseEnter(item.label) : undefined}
                  onMouseLeave={hasChildren ? handleMouseLeave : undefined}
                  onFocus={() => hasChildren && handleMouseEnter(item.label)}
                  onBlur={e => {if (!e.currentTarget.contains(e.relatedTarget)) setOpenDropdown(null);}}
                  onKeyDown={e => {if(e.key==='Escape') setOpenDropdown(null);}}
                >
                  <Link
                    to={item.href}
                    className={`flex items-center gap-1 px-4 py-2 font-medium text-sm uppercase tracking-wide transition-colors ${
                      isActive(item.href) || isChildActive(item)
                        ? 'text-secondary'
                        : 'text-white/90 hover:text-secondary'
                    }`}
                  >
                    {item.label}
                  </Link>

                  {/* Active indicator bar */}
                  {(isActive(item.href) || isChildActive(item)) && (
                    <div className="absolute bottom-0 left-4 right-4 h-[3px] bg-secondary rounded-t" />
                  )}

                  {/* Desktop Dropdown - Chelsea style */}
                  {hasChildren && openDropdown === item.label && (
                    <div className="absolute top-full left-0 pt-0 z-50">
                      <div className={`bg-fagerborg-navy border-t-[3px] border-t-secondary shadow-2xl ${item.showNextMatch ? 'flex min-w-[600px]' : 'min-w-[240px]'}`}>
                        {/* Links column */}
                        <div className={`py-6 ${item.showNextMatch ? 'flex-1 px-8' : 'px-6'}`}>
                          {visibleChildren?.map((child) => (
                            <Link
                              key={child.href + child.label}
                              to={child.href}
                              className={`block py-3 text-base font-bold transition-colors ${
                                isActive(child.href)
                                  ? 'text-secondary'
                                  : 'text-white hover:text-secondary'
                              }`}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>

                        {/* Next Match widget - only for Kamper */}
                        {item.showNextMatch && nextMatch && (
                          <div className="w-[280px] bg-white/5 p-6 flex flex-col justify-center border-l border-white/10">
                            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4">
                              Neste kamp
                            </p>
                            <div className="flex items-center gap-3 mb-3">
                              {getOpponentLogo() ? (
                                <img
                                  src={getOpponentLogo() ?? undefined}
                                  alt={nextMatch.opponent}
                                  className="w-10 h-10 object-contain"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                                  <span className="text-white font-bold text-sm">{nextMatch.opponent.charAt(0)}</span>
                                </div>
                              )}
                              <div>
                                <p className="text-white font-bold text-lg leading-tight">{nextMatch.opponent}</p>
                                <p className="text-white/60 text-xs">
                                  {nextMatch.is_home ? `på ${nextMatch.venue}` : `bortekamp`}
                                </p>
                              </div>
                            </div>
                            <p className="text-white/80 text-sm mb-1">
                              {formatOsloDateLong(nextMatch.match_date)}
                              {!(nextMatch as any).time_tbd && ` - ${formatOsloTime(nextMatch.match_date)}`}
                            </p>
                            <p className="text-white/50 text-xs uppercase font-semibold mb-4">{nextMatch.competition}</p>
                            <Link
                              to="/kamper"
                              className="text-secondary text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all"
                            >
                              Kampoversikt <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Mobile menu button */}
          <Button
            variant="ghost" size="icon"
            className="lg:hidden text-primary-foreground h-11 w-11"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Meny" aria-expanded={isMenuOpen} aria-controls="mobile-navigation"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation - Full screen overlay */}
      {isMenuOpen && (
        <div id="mobile-navigation" className="lg:hidden fixed inset-0 top-20 bg-fagerborg-navy z-40 overflow-y-auto">
          <nav className="container mx-auto px-4 py-6">
            {/* Mobile Club Name */}
            <div className="sm:hidden pb-4 mb-4 border-b border-white/10">
              <div className="text-white font-bold text-lg">Fagerborg BK</div>
              <p className="text-white/60 text-xs uppercase tracking-widest">Stiftet 1914</p>
            </div>
            {navItems.map((item) => {
              const visibleChildren = item.children?.filter(isChildVisible);
              const hasChildren = visibleChildren && visibleChildren.length > 0;
              const isExpanded = mobileExpanded === item.label;

              return (
                <div key={item.label} className="border-b border-white/10 last:border-0">
                  <div className="flex items-center justify-between">
                    <Link
                      to={item.href}
                      className={`flex-1 py-4 font-bold text-lg uppercase tracking-wide transition-colors ${
                        isActive(item.href) || isChildActive(item)
                          ? 'text-secondary'
                          : 'text-white hover:text-secondary'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                    {hasChildren && (
                      <Button variant="ghost" size="icon"
                        aria-label={`${isExpanded ? 'Skjul' : 'Vis'} undermeny for ${item.label}`}
                        aria-expanded={isExpanded}
                        className="h-11 w-11 text-primary-foreground"
                        onClick={() =>
                          setMobileExpanded(isExpanded ? null : item.label)
                        }
                      >
                        <ChevronRight
                          className={`w-5 h-5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                      </Button>
                    )}
                  </div>
                  {hasChildren && isExpanded && (
                    <div className="pl-4 pb-4 space-y-1">
                      {visibleChildren?.map((child) => (
                        <Link
                          key={child.href + child.label}
                          to={child.href}
                          className={`block py-2.5 text-base font-medium transition-colors ${
                            isActive(child.href)
                              ? 'text-secondary'
                              : 'text-white/70 hover:text-secondary'
                          }`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
