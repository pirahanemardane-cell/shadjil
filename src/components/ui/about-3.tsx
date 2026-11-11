import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

interface About3Props {
  title?: string;
  description?: string;
  mainImage?: { src: string; alt: string };
  secondaryImage?: { src: string; alt: string };
  breakout?: {
    src: string;
    alt: string;
    title?: string;
    description?: string;
    buttonText?: string;
    buttonUrl?: string;
  };
  companiesTitle?: string;
  companies?: Array<{ src: string; alt: string }>;
  achievementsTitle?: string;
  achievementsDescription?: string;
  achievements?: Array<{ label: string; value: string }>;
}

const defaultAchievements = [
  { label: "تمرکز تخصصی", value: "آجیل" },
  { label: "راهنمای بسته‌بندی", value: "شفاف" },
  { label: "مرجوعی آسان", value: "آسوده" },
  { label: "پشتیبانی", value: "واقعی" },
];

export function About3({
  title = "درباره ما",
  description = "شادجیل؛ فروشگاه تخصصی آجیل، خشکبار، خرما و سوغات — با تمرکز روی تازگی، بسته‌بندی شفاف و تجربه خرید مطمئن.",
  mainImage: _mainImage = {
    src: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=1200&q=80",
    alt: "شادجیل",
  },
  secondaryImage: _secondaryImage = {
    src: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
    alt: "خشکبار و آجیل",
  },
  breakout = {
    src: "/brand/logo.webp",
    alt: "شادجیل",
    title: "تازه، شفاف، قابل اعتماد",
    description:
      "از راهنمای بسته‌بندی شفاف تا مرجوعی آسان — هدف ما اعتماد قبل از خرید است.",
    buttonText: "مشاهده محصولات",
    buttonUrl: "/products",
  },
  companiesTitle = "تمرکز ما",
  companies = [],
  achievementsTitle = "آنچه برای خریدار مهم است",
  achievementsDescription = "تازگی محصول، راهنمای بسته‌بندی شفاف، ارسال مطمئن و پشتیبانی واقعی.",
  achievements = defaultAchievements,
}: About3Props = {}) {
  return (
    <section className="py-8 md:py-12" dir="rtl">
      <div className="mx-auto w-full max-w-none px-4">
        <div className="mb-8 text-right">
          <h1 className="text-2xl md:text-3xl font-iranyekan-heavy text-primary">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground mt-1 text-sm">
              {description}
            </p>
          ) : null}
        </div>

        <div className="mx-auto max-w-xl">
          <div className="bg-secondary/10 border-secondary/20 flex flex-col justify-between gap-6 rounded-xl border p-7">
            <div>
              <p className="text-foreground mb-3 text-lg font-semibold">
                {breakout.title}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={breakout.src || "/brand/logo.webp"}
                alt={breakout.alt || "شادجیل"}
                className="mb-3 h-16 w-16 object-contain"
              />
              {breakout.description ? (
                <p className="text-muted-foreground">{breakout.description}</p>
              ) : null}
            </div>
            <Link
              href={breakout.buttonUrl || "/products"}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "border-secondary text-secondary hover:bg-secondary/10 ml-auto",
              )}
            >
              {breakout.buttonText}
            </Link>
          </div>
        </div>

        {companies.length > 0 ? (
          <div className="py-20">
            <p className="text-center">{companiesTitle}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-8">
              {companies.map((company, idx) => (
                <div className="flex items-center gap-3" key={company.src + idx}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={company.src}
                    alt={company.alt}
                    className="h-6 w-auto md:h-8"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">{companiesTitle}</p>
            <p className="text-secondary mt-2 text-lg font-medium">
              آجیل ·  ·  · 
            </p>
          </div>
        )}

        <div className="bg-secondary/10 relative overflow-hidden rounded-xl p-10 md:p-16">
          <div className="flex flex-col gap-4 text-center md:text-right">
            <h2 className="text-secondary text-3xl font-thin md:text-4xl">
              {achievementsTitle}
            </h2>
            <p className="text-muted-foreground max-w-screen-sm">
              {achievementsDescription}
            </p>
          </div>
          <div className="mt-10 flex flex-wrap justify-between gap-10 text-center">
            {achievements.map((item, idx) => (
              <div className="flex flex-col gap-2" key={item.label + idx}>
                <p className="text-muted-foreground text-sm">{item.label}</p>
                <span className="text-secondary text-3xl font-semibold md:text-4xl">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default About3;
