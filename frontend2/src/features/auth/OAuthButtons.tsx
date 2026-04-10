import { useLingui } from "@lingui/react/macro";

export function OAuthButtons() {
  const { t } = useLingui();

  const buttonClass =
    "w-full h-[44px] border-retro-thick border-retro-ink bg-retro-cream shadow-retro-raised hover:shadow-retro-pressed flex items-center px-md gap-sm text-[14px] font-bold uppercase text-retro-ink cursor-pointer";

  return (
    <div className="mt-md">
      {/* OR divider */}
      <div className="flex items-center gap-sm my-md">
        <div className="flex-1 border-t border-retro-gray" />
        <span className="text-retro-gray text-[14px]">{t`OR`}</span>
        <div className="flex-1 border-t border-retro-gray" />
      </div>

      {/* OAuth buttons */}
      <div className="flex flex-col gap-sm">
        <button
          type="button"
          className={buttonClass}
          aria-label={t`Sign in with Google`}
          onClick={() => {
            window.location.href = "/api/auth/oauth/google";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M18.17 10.2c0-.63-.06-1.25-.16-1.84H10v3.48h4.58a3.92 3.92 0 01-1.7 2.57v2.13h2.74c1.61-1.48 2.53-3.65 2.53-6.34z"
              fill="#4285F4"
            />
            <path
              d="M10 18.5c2.29 0 4.21-.76 5.62-2.06l-2.74-2.13c-.76.51-1.73.81-2.88.81-2.22 0-4.1-1.5-4.77-3.52H2.4v2.2A8.5 8.5 0 0010 18.5z"
              fill="#34A853"
            />
            <path
              d="M5.23 11.6a5.1 5.1 0 010-3.22V6.18H2.4a8.5 8.5 0 000 7.64l2.83-2.22z"
              fill="#FBBC05"
            />
            <path
              d="M10 4.86c1.25 0 2.38.43 3.27 1.28l2.45-2.45A8.5 8.5 0 0010 1.5a8.5 8.5 0 00-7.6 4.68l2.83 2.2C5.9 6.36 7.78 4.86 10 4.86z"
              fill="#EA4335"
            />
          </svg>
          {t`SIGN IN WITH GOOGLE`}
        </button>

        <button
          type="button"
          className={buttonClass}
          aria-label={t`Sign in with GitHub`}
          onClick={() => {
            window.location.href = "/api/auth/oauth/github";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10 1.5A8.5 8.5 0 001.5 10c0 3.76 2.44 6.95 5.83 8.07.43.08.58-.18.58-.41 0-.2-.01-.87-.01-1.58-2.37.52-2.87-1.01-2.87-1.01-.39-.99-.95-1.25-.95-1.25-.78-.53.06-.52.06-.52.86.06 1.31.88 1.31.88.76 1.31 2 .93 2.49.71.08-.55.3-.93.54-1.15-1.9-.21-3.89-.95-3.89-4.22 0-.93.33-1.69.88-2.29-.09-.21-.38-1.08.08-2.26 0 0 .72-.23 2.35.88a8.2 8.2 0 014.28 0c1.63-1.1 2.35-.88 2.35-.88.46 1.18.17 2.05.08 2.26.55.6.88 1.36.88 2.29 0 3.28-2 4-3.9 4.21.31.26.58.78.58 1.57 0 1.14-.01 2.05-.01 2.33 0 .23.16.49.59.41A8.5 8.5 0 0018.5 10 8.5 8.5 0 0010 1.5z"
              fill="#1A1A1A"
            />
          </svg>
          {t`SIGN IN WITH GITHUB`}
        </button>
      </div>
    </div>
  );
}
