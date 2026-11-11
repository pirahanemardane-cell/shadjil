import type { Metadata } from "next";
import { About3 } from "@/components/ui/about-3";

export const metadata: Metadata = {
  title: "درباره ما | شادجیل",
  description:
    "فروشگاه تخصصی شادجیل — آجیل، خشکبار، خرما و سوغات با بسته‌بندی شفاف و پشتیبانی واقعی",
};

export default function AboutPage() {
  return (
    <About3
      title="درباره شادجیل"
      description="ما روی یک چیز تمرکز کرده‌ایم: آجیل، خشکبار، خرما و سوغات تازه و باکیفیت، با تجربه خرید شفاف. هدفمان این است که وزن بسته را با اطمینان انتخاب کنید و بعد از خرید پشتیبانی واقعی داشته باشید."
      breakout={{
        src: "/brand/logo.webp",
        alt: "شادجیل",
        title: "تازه، شفاف، قابل اعتماد",
        description:
          "جزئیات وزن بسته، مرجوعی آسان و پشتیبانی واقعی — برای خریدی مطمئن قبل و بعد از سفارش.",
        buttonText: "مشاهده محصولات",
        buttonUrl: "/products",
      }}
      companiesTitle="تمرکز ما"
      companies={[]}
      achievementsTitle="آنچه برای شما می‌سازیم"
      achievementsDescription="فروشگاه تخصصی، نه همه‌چیزفروشی."
      achievements={[
        { label: "تمرکز", value: "آجیل" },
        { label: "بسته‌بندی", value: "شفاف" },
        { label: "مرجوعی", value: "آسان" },
        { label: "پشتیبانی", value: "واقعی" },
      ]}
    />
  );
}
