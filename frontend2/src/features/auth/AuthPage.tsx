import { useState } from "react";
import { Navigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "./AuthContext";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { OAuthButtons } from "./OAuthButtons";

type Tab = "login" | "register";

export function AuthPage() {
  const { t } = useLingui();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("login");

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
  };

  const tabBase =
    "min-w-[120px] h-[36px] text-[14px] font-bold uppercase border-retro-thick border-retro-ink cursor-pointer";
  const activeTabClass = `${tabBase} bg-retro-cream border-b-0`;
  const inactiveTabClass = `${tabBase} bg-retro-gray`;

  return (
    <div className="min-h-dvh bg-retro-charcoal flex items-start justify-center pt-[10vh] px-lg pb-lg">
      <div className="w-full max-w-[420px] max-sm:mx-md">
        {/* Tabs */}
        <div className="flex">
          <button
            type="button"
            className={activeTab === "login" ? activeTabClass : inactiveTabClass}
            onClick={() => switchTab("login")}
          >
            {t`LOGIN`}
          </button>
          <button
            type="button"
            className={
              activeTab === "register" ? activeTabClass : inactiveTabClass
            }
            onClick={() => switchTab("register")}
          >
            {t`REGISTER`}
          </button>
        </div>

        {/* Panel */}
        <div className="bg-retro-cream border-retro-thick border-retro-ink shadow-retro-raised p-lg relative">
          {/* Decorative X button */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={(e) => e.preventDefault()}
            className="absolute top-sm right-sm w-[24px] h-[24px] bg-retro-red border-retro-thick border-retro-ink flex items-center justify-center text-white text-[12px] font-bold leading-none"
          >
            X
          </button>

          {/* Hazard stripe */}
          <div className="bg-hazard-stripe h-[8px] mb-md" />

          {/* Form */}
          {activeTab === "login" ? <LoginForm /> : <RegisterForm />}

          {/* OAuth */}
          <OAuthButtons />
        </div>
      </div>
    </div>
  );
}
