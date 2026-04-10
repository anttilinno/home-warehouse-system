import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface Toast {
  id: string;
  message: string;
  variant: "success" | "error" | "info";
}

interface ToastContextValue {
  addToast: (message: string, variant?: Toast["variant"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantBorderClass: Record<Toast["variant"], string> = {
  success: "border-l-[4px] border-l-retro-green",
  error: "border-l-[4px] border-l-retro-red",
  info: "border-l-[4px] border-l-retro-blue",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: Toast["variant"] = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-lg right-lg z-50 flex flex-col gap-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-[280px] border-retro-thick border-retro-ink bg-retro-cream shadow-retro-raised py-[12px] px-md relative animate-toast-slide-in ${variantBorderClass[toast.variant]}`}
          >
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
              className="absolute top-[4px] right-[4px] w-[20px] h-[20px] bg-retro-red border border-retro-ink flex items-center justify-center text-white text-[10px] font-bold leading-none cursor-pointer"
            >
              X
            </button>
            <p className="text-[14px] text-retro-ink pr-[24px]">
              {toast.message}
            </p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
