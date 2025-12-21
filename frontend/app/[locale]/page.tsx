import { getTranslations } from 'next-intl/server';
import { Package, MapPin, Users, TrendingUp, Shield, Zap } from "lucide-react";
import { Header } from "@/components/header";
import { Link } from "@/navigation";
import { RedirectIfAuthenticated } from "@/components/auth-redirect";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function Home({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing' });
  return (
    <RedirectIfAuthenticated>
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background to-muted/20 pt-20">
        <div className="container mx-auto px-4 py-20 sm:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground mb-6">
              {t('title')}
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <button className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors">
                  {t('getStarted')}
                </button>
              </Link>
              <button className="px-8 py-3 border border-border rounded-lg font-semibold hover:bg-muted transition-colors">
                {t('learnMore')}
              </button>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 right-0 -z-10">
          <div className="w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        </div>
        <div className="absolute bottom-0 left-0 -z-10">
          <div className="w-96 h-96 bg-secondary/5 rounded-full blur-3xl"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              {t('featuresTitle')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('featuresSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-card p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <Package className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('inventoryManagement')}</h3>
              <p className="text-muted-foreground">
                {t('inventoryDesc')}
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <MapPin className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('locationTracking')}</h3>
              <p className="text-muted-foreground">
                {t('locationDesc')}
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <Users className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('loanManagement')}</h3>
              <p className="text-muted-foreground">
                {t('loanDesc')}
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <TrendingUp className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('smartAnalytics')}</h3>
              <p className="text-muted-foreground">
                {t('analyticsDesc')}
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <Shield className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('securePrivate')}</h3>
              <p className="text-muted-foreground">
                {t('secureDesc')}
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <Zap className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('fastResponsive')}</h3>
              <p className="text-muted-foreground">
                {t('fastDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                {t('benefitsTitle')}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t('benefitsSubtitle')}
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-4">{t('neverLose')}</h3>
                <p className="text-muted-foreground mb-6">
                  {t('neverLoseDesc')}
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                    {t('neverLoseItem1')}
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                    {t('neverLoseItem2')}
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                    {t('neverLoseItem3')}
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-2xl font-bold mb-4">{t('stayOrganized')}</h3>
                <p className="text-muted-foreground mb-6">
                  {t('stayOrganizedDesc')}
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                    {t('stayOrganizedItem1')}
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                    {t('stayOrganizedItem2')}
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                    {t('stayOrganizedItem3')}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {t('ctaTitle')}
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            {t('ctaSubtitle')}
          </p>
          <Link href="/register">
            <button className="px-8 py-3 bg-background text-foreground rounded-lg font-semibold hover:bg-background/90 transition-colors">
              {t('startManaging')}
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-foreground mb-2">{t('footerTitle')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('footerDesc')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('footerNote')}
            </p>
          </div>
        </div>
      </footer>
    </div>
    </RedirectIfAuthenticated>
  );
}