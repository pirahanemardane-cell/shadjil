import { ScrollToTop } from "@/components/scroll-to-top";
import { BackToTop } from "@/components/layout/back-to-top";
import { NotificationsProvider } from "@/lib/notifications/notifications-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { FooterContact } from "@/components/layout/footer-contact";
import { SiteLoaderProvider } from "@/components/layout/site-loader";
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteLoaderProvider>
      <NotificationsProvider>
        <div className="flex min-h-screen flex-col">
<SiteHeader />
          <div className="flex-1">
            <div className="w-full max-w-none">
              <AppBreadcrumb />
              <ScrollToTop />
              <main id="main-content" tabIndex={-1} className="outline-none">
                {children}
              </main>
            </div>
          </div>
          <div className="border-border border-t">
            <FooterContact />
            <SiteFooter />
          </div>
          <BackToTop />
        </div>
      </NotificationsProvider>
    </SiteLoaderProvider>
  );
}
