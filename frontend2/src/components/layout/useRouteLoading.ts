import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router";

export function useRouteLoading() {
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    setIsLoading(true);
    setProgress(90);

    let t2: ReturnType<typeof setTimeout>;
    const t1 = setTimeout(() => {
      setProgress(100);
      t2 = setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 200);
    }, 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [location.pathname]);

  return { isLoading, progress };
}
