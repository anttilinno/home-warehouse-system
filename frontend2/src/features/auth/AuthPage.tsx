import { useState } from "react";
import { Navigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "./AuthContext";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { OAuthButtons } from "./OAuthButtons";
import { RetroTabs, RetroPanel } from "@/components/retro";

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

  return (
    <div className="min-h-dvh bg-retro-charcoal flex items-start justify-center pt-[10vh] px-lg pb-lg">
      <div className="w-full max-w-[420px] max-sm:mx-md">
        {/* Tabs */}
        <RetroTabs
          tabs={[
            { key: "login", label: t`LOGIN` },
            { key: "register", label: t`REGISTER` },
          ]}
          activeTab={activeTab}
          onTabChange={(key) => switchTab(key as Tab)}
        />

        {/* Panel */}
        <RetroPanel showHazardStripe showClose onClose={() => {}}>
          {/* Form */}
          {activeTab === "login" ? <LoginForm /> : <RegisterForm />}

          {/* OAuth */}
          <OAuthButtons />
        </RetroPanel>
      </div>
    </div>
  );
}
