import Image from "next/image";
import Link from "next/link";

// Kinds of shop the product is for, shown with real photographs from Wikimedia
// Commons (licences on /credits). Only photos without a readable shop name are
// used here, and the caption says plainly that these are not customers.
const SHOPS = [
  { label: "Kirana and grocery", image: "/images/shop-kirana-interior.jpg", alt: "Inside a small grocery shop, shelves stacked to the ceiling", focus: "object-center" },
  { label: "Boutiques", image: "/images/shop-saree-boutique.jpg", alt: "A shopkeeper at his counter in front of a wall of colourful sarees", focus: "object-[70%_center]" },
  { label: "Salons", image: "/images/shop-salon-varanasi.jpg", alt: "A barber reading a newspaper in his wood-panelled salon", focus: "object-[75%_center]" },
  { label: "Cafés and restaurants", image: "/images/shop-cafe-interior.jpg", alt: "Tables laid out in a small café with a painted wall", focus: "object-center" },
  { label: "Cloth stores", image: "/images/shop-cloth-counter.jpg", alt: "Two shopkeepers unrolling white fabric across a counter", focus: "object-[60%_center]" },
  { label: "Mobile shops", image: "/images/shop-mobile-display.jpg", alt: "A glass display case filled with rows of mobile phones", focus: "object-center" },
];

/**
 * A row of shop photographs for the base of the hero: who this is for, in
 * pictures. A grid on desktop, a swipeable row on phones.
 */
export function ShopStrip() {
  return (
    <div className="mx-auto max-w-[1296px] px-5 pb-10 sm:px-10 sm:pb-14">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line pt-6">
        <p className="text-sm font-semibold text-ink">Made for the shops on your street</p>
        <p className="text-xs text-text-muted">
          Real Indian shops, photographed for Wikimedia Commons. Not Revyu customers.{" "}
          <Link href="/credits" className="text-text-2 underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
            Photo credits
          </Link>
        </p>
      </div>

      <ul
        aria-label="Kinds of shop Revyu is made for"
        // Keyboard users must be able to scroll the row on phones (axe: scrollable-region-focusable).
        tabIndex={0}
        className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {SHOPS.map((shop) => (
          <li
            key={shop.label}
            className="group relative aspect-[4/5] w-[44%] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-bg sm:w-[28%] lg:w-auto"
          >
            <Image
              src={shop.image}
              alt={shop.alt}
              fill
              sizes="(min-width: 1024px) 200px, (min-width: 640px) 28vw, 44vw"
              className={`object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none ${shop.focus}`}
            />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-night/95 to-transparent" />
            <span className="absolute inset-x-3 bottom-3 text-[13px] font-semibold leading-tight text-white">{shop.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
