import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, Eye, EyeOff, ArrowLeft } from "lucide-react";
import fagerborgLogo from "@/assets/fagerborg-logo.png";

type AuthMode = 'login' | 'forgot-password' | 'reset-password';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if this is a recovery flow
    const type = searchParams.get('type');
    if (type === 'recovery') {
      setMode('reset-password');
    }
  }, [searchParams]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Don't redirect if in reset-password mode
        if (session && mode !== 'reset-password') {
          navigate("/admin");
        }
        
        // Handle password recovery event
        if (event === 'PASSWORD_RECOVERY') {
          setMode('reset-password');
        }
      }
    );

    // THEN check for existing session (but not for recovery)
    if (mode !== 'reset-password') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          navigate("/admin");
        }
      });
    }

    return () => subscription.unsubscribe();
  }, [navigate, mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      toast({
        title: "Innlogging feilet",
        description: error.message === "Invalid login credentials" 
          ? "Feil e-post eller passord" 
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Velkommen!",
        description: "Du er nå logget inn",
      });
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth?type=recovery`,
    });

    if (error) {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "E-post sendt",
        description: "Sjekk innboksen din for en lenke til å tilbakestille passordet",
      });
      setMode('login');
    }

    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passordene er ulike",
        description: "Passord og bekreftelse må være like",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Passord for kort",
        description: "Passordet må være minst 6 tegn",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Passord oppdatert",
        description: "Du kan nå logge inn med ditt nye passord",
      });
      navigate("/admin");
    }

    setLoading(false);
  };

  const renderLogin = () => (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="din@epost.no"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Passord</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="remember" 
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
          />
          <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
            Husk meg
          </Label>
        </div>
        <button 
          type="button"
          onClick={() => setMode('forgot-password')}
          className="text-sm text-primary hover:underline"
        >
          Glemt passord?
        </button>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Logger inn..." : "Logg inn"}
      </Button>
    </form>
  );

  const renderForgotPassword = () => (
    <form onSubmit={handleForgotPassword} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="din@epost.no"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sender..." : "Send tilbakestillingslenke"}
      </Button>
      <button 
        type="button"
        onClick={() => setMode('login')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
      >
        <ArrowLeft className="h-4 w-4" />
        Tilbake til innlogging
      </button>
    </form>
  );

  const renderResetPassword = () => (
    <form onSubmit={handleResetPassword} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nytt passord</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Bekreft passord</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="pl-10"
            required
            minLength={6}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Oppdaterer..." : "Oppdater passord"}
      </Button>
    </form>
  );

  const getTitle = () => {
    switch (mode) {
      case 'forgot-password':
        return 'Glemt passord';
      case 'reset-password':
        return 'Sett nytt passord';
      default:
        return 'Admin-innlogging';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'forgot-password':
        return 'Skriv inn din e-post for å motta en tilbakestillingslenke';
      case 'reset-password':
        return 'Opprett et nytt passord for din konto';
      default:
        return 'Logg inn for å administrere nettsiden';
    }
  };

  return (
    <div className="min-h-screen bg-page-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src={fagerborgLogo} 
              alt="Fagerborg BK" 
              className="h-20 w-20 object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">{getTitle()}</CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'login' && renderLogin()}
          {mode === 'forgot-password' && renderForgotPassword()}
          {mode === 'reset-password' && renderResetPassword()}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
