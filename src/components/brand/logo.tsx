import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  priority?: boolean;
  size?: "sm" | "md" | "lg" | "footer";
  /** When false, render the image only (e.g. nested inside an existing link). */
  link?: boolean;
};

/** Square illustrated mark — keep height within the nav bar, not crushing links. */
const sizes = {
  sm: { width: 36, height: 36, className: "h-9 w-9" },
  md: { width: 44, height: 44, className: "h-10 w-10 sm:h-11 sm:w-11" },
  lg: { width: 52, height: 52, className: "h-12 w-12" },
  footer: {
    width: 80,
    height: 80,
    className: "h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20",
  },
};

const LOGO_SRC = "/brand/logo.webp";

export function Logo({ className, priority, size = "md", link = true }: Props) {
  const s = sizes[size];

  const image = (
    <Image
      src={LOGO_SRC}
      alt="شادجیل"
      width={s.width}
      height={s.height}
      className={cn(s.className, "object-contain")}
      priority={priority}
    />
  );

  if (!link) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        {image}
      </span>
    );
  }

  return (
    <Link
      href="/"
      className={cn("inline-flex shrink-0 items-center", className)}
      aria-label="شادجیل"
    >
      {image}
    </Link>
  );
}
