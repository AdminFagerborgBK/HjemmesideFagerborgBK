 import { useEffect } from 'react';
 import { useLocation } from 'react-router-dom';
 
 const ScrollToTop = () => {
  const { pathname, hash, search } = useLocation();
 
   useEffect(() => {
    if (hash) {
      setTimeout(() => {
        const element = document.getElementById(hash.substring(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      // Don't force scroll-to-top when highlight param is present (Matches page handles its own scroll)
      const params = new URLSearchParams(search);
      if (!params.has('highlight')) {
        window.scrollTo(0, 0);
      }
    }
  }, [pathname, hash, search]);
 
   return null;
 };
 
 export default ScrollToTop;