import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Separator } from "@/components/ui/separator";
import { SignupForm } from "@/features/auth/components/signup-form";
import { SocialLogin } from "@/features/auth/components/social-login";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

  return {
    title: t("signUp"),
  };
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold font-[family-name:var(--font-quicksand)]">
          {t("createAccount")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("signupDescription")}</p>
      </div>

      <SocialLogin />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background/95 px-2 text-muted-foreground">
            {t("orContinueWith")}
          </span>
        </div>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
