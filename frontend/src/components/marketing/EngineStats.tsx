import { ThreeEngineLogo } from "./ThreeEngineLogo";
import { CurlyCardConnectors } from "./CurlyCardConnectors";

export function EngineStats() {
  return (
    <section className="max-w-[1296px] mx-auto px-4 sm:px-8 pt-0 pb-16 sm:pb-24 text-center">
      {/* Curly organic random lines coming from above 3 cards joining to the 3D Engine Logo */}
      <CurlyCardConnectors />

      {/* Interactive 3D Three.js Spirograph Gyroscope with Revyu Brand Logo */}
      <ThreeEngineLogo />

      {/* Two-Tone Serif Headline */}
      <h2 className="heading-h2 font-display text-2xl sm:text-4xl lg:text-[42px] max-w-3xl mx-auto leading-tight text-[#6e797b]">
        The business down the road doesn&rsquo;t have better service. It{" "}
        <span className="text-[#1a1e23] font-normal">
          asks every customer. You ask the ones you like
        </span>
        .
      </h2>

      <p className="mt-4 text-base text-[#515a63] max-w-lg mx-auto">
        Most happy customers never review because nobody asked and the blank Google box is a chore. A printed QR asks everyone the same way, and the tags give them a place to start.
      </p>

      {/* 3 Serif Stats split by 1px vertical rules */}
      <div className="mt-14 pt-10 border-t border-[#e8ecec] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#e8ecec]">
        {/* Stat 1 */}
        <div className="py-6 sm:py-0 px-4">
          <p className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#1a1e23] tracking-tight">
            0
          </p>
          <p className="text-sm font-medium text-[#515a63] mt-2">
            Apps, accounts or logins for your customer
          </p>
          <p className="text-xs text-[#9aa1a3] mt-0.5">
            Their own phone camera, on their own time
          </p>
        </div>

        {/* Stat 2 */}
        <div className="py-6 sm:py-0 px-4">
          <p className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#397dff] tracking-tight">
            1 tap
          </p>
          <p className="text-sm font-medium text-[#515a63] mt-2">
            From your counter to Google’s review box
          </p>
          <p className="text-xs text-[#9aa1a3] mt-0.5">
            Nothing to install, nothing to learn
          </p>
        </div>

        {/* Stat 3 */}
        <div className="py-6 sm:py-0 px-4">
          <p className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#449127] tracking-tight">
            ₹499
          </p>
          <p className="text-sm font-medium text-[#515a63] mt-2">
            Per month, one flat price
          </p>
          <p className="text-xs text-[#9aa1a3] mt-0.5">
            Every business type, every feature
          </p>
        </div>
      </div>
    </section>
  );
}
