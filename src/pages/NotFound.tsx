import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Helmet>
        <title>Siden finnes ikke | Fagerborg BK</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404 – siden finnes ikke</h1>
        <p className="mb-4 text-xl text-muted-foreground">Beklager, vi fant ikke siden du lette etter.</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Tilbake til forsiden
        </a>
      </div>
    </div>
  );
};

export default NotFound;
