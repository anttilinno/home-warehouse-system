import { Link } from "react-router";

interface SettingsRowProps {
  to: string;
  label: string;
  preview?: string;
}

export function SettingsRow({ to, label, preview }: SettingsRowProps) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between w-full h-[48px] border-retro-thick border-retro-ink bg-retro-cream px-md py-sm shadow-retro-raised hover:bg-retro-amber active:shadow-retro-pressed cursor-pointer font-bold uppercase text-[14px] text-retro-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-retro-amber"
    >
      <span>{label}</span>
      <span className="flex items-center gap-sm text-retro-gray">
        {preview && (
          <span className="font-normal normal-case font-mono">{preview}</span>
        )}
        <span>&gt;</span>
      </span>
    </Link>
  );
}
