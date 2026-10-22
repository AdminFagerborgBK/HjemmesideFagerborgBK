import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSiteSetting } from '@/hooks/useSiteSettings';
import { usePendingMembersCount } from '@/hooks/usePendingMembersCount';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Video, 
  Users, 
  FileEdit, 
  LogOut, 
  Home,
  Settings,
  LayoutDashboard,
  UserCog,
  Star,
  Award,
  Calendar,
  Menu,
  BarChart3,
  Shield,
  Mail,
  Radio,
  Target,
  Activity,
  Instagram,
  Sprout
} from 'lucide-react';

import fagerborgLogo from '@/assets/fagerborg-logo.png';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, signOut, roles } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { value: sponsorsEnabled } = useSiteSetting('sponsors_enabled');
  const { data: pendingCount } = usePendingMembersCount();
  const isSuperAdmin = roles.includes('superadmin');
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { path: '/admin', label: 'Oversikt', icon: LayoutDashboard },
    { path: '/admin/posts', label: 'Nyheter', icon: FileText },
    { path: '/admin/videos', label: 'Videoer', icon: Video },
    { path: '/admin/matches', label: 'Kamper', icon: Calendar },
    { path: '/admin/livestream-stats', label: 'Direktesending', icon: Radio },
    { path: '/admin/roster', label: 'Spillerstall', icon: Users },
    { path: '/admin/members', label: 'Medlemmer', icon: UserCog },
    { path: '/admin/player-enrollment', label: 'Spillerinnmelding', icon: Users },
    { path: '/admin/goal-club', label: 'Målklubben', icon: Target },
    { path: '/admin/grasrot', label: 'Grasrotandelen', icon: Sprout },
    { path: '/admin/board', label: 'Styret', icon: Award },
    { path: '/admin/standings', label: 'Tabellhistorikk', icon: BarChart3 },
    { path: '/admin/pages', label: 'Sider', icon: FileEdit },
    { path: '/admin/instagram', label: 'Rundt laget', icon: Instagram },
    ...(sponsorsEnabled === true ? [{ path: '/admin/sponsors', label: 'Sponsorer', icon: Star }] : []),
    { path: '/admin/gdpr', label: 'Personvern', icon: Shield },
    { path: '/admin/newsletters', label: 'Nyhetsbrev', icon: Mail },
    { path: '/admin/settings', label: 'Innstillinger', icon: Settings },
    { path: '/admin/sync-status', label: 'Sync-status', icon: Activity },
    ...(isSuperAdmin ? [{ path: '/admin/users', label: 'Admins', icon: Users }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-primary-foreground/10 flex-shrink-0">
        <Link to="/admin" className="flex items-center gap-3" onClick={handleNavClick}>
          <img src={fagerborgLogo} alt="Fagerborg BK" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="font-bold text-lg">Fagerborg BK</h1>
            <p className="text-xs text-primary-foreground/70">Admin</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path || 
            (path !== '/admin' && location.pathname.startsWith(path));
          
          return (
            <Link
              key={path}
              to={path}
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive 
                  ? 'bg-primary-foreground/20 text-primary-foreground' 
                  : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1">{label}</span>
              {path === '/admin/members' && pendingCount != null && pendingCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs flex items-center justify-center">
                  {pendingCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-primary-foreground/10 space-y-2 flex-shrink-0">
        <Link
          to="/"
          onClick={handleNavClick}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground transition-colors"
        >
          <Home className="h-5 w-5" />
          Gå til forsiden
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground transition-colors w-full text-left"
        >
          <LogOut className="h-5 w-5" />
          Logg ut
        </button>
        <div className="px-3 py-2 text-xs text-primary-foreground/50 truncate">
          {user?.email}
        </div>
      </div>
    </>
  );

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Admin | Fagerborg BK</title>
      </Helmet>
      <div className="min-h-screen bg-muted/30 flex">
        {/* Mobile Header */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-primary text-primary-foreground flex items-center px-4 z-50 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-primary text-primary-foreground border-none">
              <div className="flex flex-col h-full">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 ml-2">
            <img src={fagerborgLogo} alt="Fagerborg BK" className="h-8 w-8 object-contain" />
            <span className="font-bold">Admin</span>
          </div>
        </header>

        {/* Desktop Sidebar */}
        <aside className="w-64 bg-primary text-primary-foreground flex-col fixed inset-y-0 left-0 z-40 hidden lg:flex">
          <SidebarContent />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto lg:ml-64 pt-14 lg:pt-0">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </>
  );
};

export { AdminLayout };
