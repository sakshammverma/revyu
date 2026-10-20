import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Photo Credits — Revyu",
};

// Every photo on the marketing site comes from Wikimedia Commons. CC BY and
// CC BY-SA require this attribution; keep the list in sync with public/images.
// The photos were resized and recompressed, nothing else.
const PHOTOS = [
  { file: "shop-kirana-interior.jpg", title: "Inside of a grocery store in West Bengal", author: "Billjones94", license: "CC BY-SA 4.0" },
  { file: "shop-saree-boutique.jpg", title: "Shopkeeper selling traditional clothes 01", author: "Bhaiyaji Smile 123", license: "CC BY-SA 4.0" },
  { file: "shop-cafe-interior.jpg", title: "Aliyans Cafe T. Dasarahalli Bangalore (5)", author: "Prof tpms", license: "CC0" },
  { file: "shop-mobile-display.jpg", title: "Bangalore Cellphones for sale November 2011 -26", author: "Victorgrigas", license: "CC BY-SA 3.0" },
  { file: "shop-salon-varanasi.jpg", title: "India - Varanasi hairdresser shop - 1075", author: "Jorge Royan", license: "CC BY-SA 3.0" },
  { file: "shop-supermart-front.jpg", title: "Kirana shop", author: "Renzilde", license: "CC BY-SA 3.0" },
  { file: "shop-supermarket-evening.jpg", title: "Ushodaya Super Market, Poranki", author: "Saishna96", license: "CC BY-SA 4.0" },
  { file: "shop-medical-counter.jpg", title: "Pharmacy, Gangtok, India (8083933798)", author: "flowcomm", license: "CC BY 2.0" },
  { file: "street-mumbai-shops.jpg", title: "Mumbai cellphone store November 2011 -48", author: "Victorgrigas", license: "CC BY-SA 3.0" },
  { file: "street-kirana-row.jpg", title: "Jai Daiya Bhagwati Kirana Stores", author: "नमन भगत", license: "CC BY-SA 4.0" },
  { file: "portrait-shopkeeper.jpg", title: "Shopkeeper - Indian Market", author: "RioRiyoRio", license: "CC BY 4.0" },
  { file: "shop-cloth-counter.jpg", title: "Shopkeeper selling traditional clothes 03", author: "Bhaiyaji Smile 123", license: "CC BY-SA 4.0" },
];

const LICENSE_URLS: Record<string, string> = {
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
};

function commonsUrl(title: string) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replaceAll(" ", "_"))}.jpg`;
}

export default function CreditsPage() {
  return (
    <LegalPage title="Photo Credits" subtitle="Real shops, credited to the people who photographed them">
      <p>
        The shop photos on this site are real photographs of Indian
        businesses, shared on Wikimedia Commons by the people below. They are
        used under the licence listed next to each one and were resized for
        the web. None of these businesses is a Revyu customer.
      </p>

      <ul>
        {PHOTOS.map((p) => (
          <li key={p.file}>
            <a href={commonsUrl(p.title)}>{p.title}</a> by {p.author},{" "}
            <a href={LICENSE_URLS[p.license]}>{p.license}</a>
          </li>
        ))}
      </ul>
    </LegalPage>
  );
}
