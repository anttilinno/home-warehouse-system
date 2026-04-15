interface RetroTabsProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

const tabBase =
  "flex-shrink-0 min-w-[120px] h-[36px] text-[14px] font-bold uppercase border-retro-thick border-retro-ink cursor-pointer outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber";

function RetroTabs({ tabs, activeTab, onTabChange, className }: RetroTabsProps) {
  return (
    <div className={`flex overflow-x-auto ${className || ""}`}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            type="button"
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`${tabBase} ${isActive ? "bg-retro-cream border-b-0" : "bg-retro-gray"}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export { RetroTabs };
export type { RetroTabsProps };
