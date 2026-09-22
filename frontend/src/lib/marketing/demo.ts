/**
 * Demo data for the marketing site. Tags and phrase fragments are copied from
 * backend/app/verticals/*.json so the homepage demo runs the real draft
 * assembler (FR-77) on the same inputs a real outlet ships with.
 *
 * Business names below are fictional examples, labelled as such wherever they
 * render. Never add review sentences here (CR-1) — only tag phrase fragments.
 */

import type { DraftTag } from "@/lib/flow/draft";

export interface DemoTag extends DraftTag {
  label: string;
}

export interface DemoVertical {
  key: string;
  label: string;
  exampleBusiness: string;
  exampleLocality: string;
  tags: DemoTag[];
}

export const DEMO_VERTICALS: DemoVertical[] = [
  {
    key: "general",
    label: "Shops & local businesses",
    exampleBusiness: "Sharma General Store",
    exampleLocality: "Indiranagar, Bengaluru",
    tags: [
      { id: "general-0", label: "friendly staff", phrases: ["the staff were friendly", "warm and welcoming team", "everyone was courteous", "felt well looked after"] },
      { id: "general-1", label: "clean space", phrases: ["the place was clean", "well-maintained space", "tidy and well kept", "a pleasant environment"] },
      { id: "general-2", label: "quality products", phrases: ["good quality products", "well-chosen range", "everything I bought was good quality", "products that live up to the price"] },
      { id: "general-3", label: "great service", phrases: ["service was excellent", "attentive from start to finish", "got the help I needed", "really went the extra mile"] },
      { id: "general-4", label: "fair pricing", phrases: ["pricing was fair", "reasonable cost", "good value for money", "transparent about charges"] },
      { id: "general-5", label: "quick and easy", phrases: ["quick and hassle-free", "no long wait", "everything was smooth", "easy from start to finish"] },
      { id: "general-6", label: "knowledgeable team", phrases: ["the team knew their stuff", "explained things clearly", "gave honest advice", "helpful recommendations"] },
      { id: "general-7", label: "would come back", phrases: ["I'll definitely be back", "would happily return", "a place I'd recommend to friends", "glad I found this place"] },
    ],
  },
  {
    key: "dental",
    label: "Dental clinics",
    exampleBusiness: "Sharma Dental Care",
    exampleLocality: "Indiranagar, Bengaluru",
    tags: [
      { id: "dental-0", label: "clean clinic", phrases: ["the clinic was spotless", "very clean space", "the place was well maintained", "hygienic environment"] },
      { id: "dental-1", label: "painless treatment", phrases: ["the treatment was painless", "barely felt a thing", "much less painful than expected", "a comfortable procedure"] },
      { id: "dental-2", label: "explained clearly", phrases: ["everything was explained clearly", "the doctor explained each step", "clear communication throughout", "walked me through the procedure"] },
      { id: "dental-3", label: "on time", phrases: ["seen right on time", "no long wait", "the appointment started on schedule", "minimal waiting"] },
      { id: "dental-4", label: "friendly staff", phrases: ["the staff were friendly", "everyone was welcoming", "warm and courteous team", "felt taken care of by the staff"] },
      { id: "dental-5", label: "fair pricing", phrases: ["pricing was fair", "reasonable cost for the treatment", "transparent about charges", "good value for the treatment"] },
      { id: "dental-6", label: "modern equipment", phrases: ["modern equipment used", "up-to-date technology", "well-equipped clinic", "advanced tools for the treatment"] },
      { id: "dental-7", label: "good follow-up", phrases: ["good follow-up after the visit", "checked in afterward", "attentive aftercare", "followed up to see how I was doing"] },
    ],
  },
  {
    key: "salon",
    label: "Salons",
    exampleBusiness: "Studio Nine Salon",
    exampleLocality: "Koregaon Park, Pune",
    tags: [
      { id: "salon-0", label: "skilled stylist", phrases: ["the stylist was skilled", "clearly experienced with hair", "great technique", "knew exactly what to do"] },
      { id: "salon-1", label: "clean", phrases: ["the salon was clean", "hygienic setup", "well-maintained space", "kept spotless"] },
      { id: "salon-2", label: "friendly staff", phrases: ["the staff were friendly", "warm and welcoming team", "everyone was courteous", "felt well looked after"] },
      { id: "salon-3", label: "on time", phrases: ["seen right on time", "no long wait for my appointment", "punctual service", "minimal waiting"] },
      { id: "salon-4", label: "good products", phrases: ["good quality products used", "used products that suited me", "well-chosen products", "quality products throughout"] },
      { id: "salon-5", label: "fair pricing", phrases: ["fair pricing for the service", "reasonable cost", "good value for the service", "transparent about charges"] },
      { id: "salon-6", label: "relaxing", phrases: ["a relaxing experience", "a calm, pleasant visit", "felt genuinely relaxing", "a soothing atmosphere"] },
      { id: "salon-7", label: "listened to me", phrases: ["the stylist listened to what I wanted", "took my preferences seriously", "understood exactly what I asked for", "attentive to my requests"] },
    ],
  },
  {
    key: "gym",
    label: "Gyms",
    exampleBusiness: "IronHouse Fitness",
    exampleLocality: "Sector 18, Noida",
    tags: [
      { id: "gym-0", label: "clean", phrases: ["the gym was clean", "well-maintained space", "hygienic facility", "kept tidy throughout"] },
      { id: "gym-1", label: "good equipment", phrases: ["good range of equipment", "well-maintained machines", "modern equipment available", "enough equipment for everyone"] },
      { id: "gym-2", label: "helpful trainers", phrases: ["the trainers were helpful", "attentive training staff", "trainers who actually help you", "supportive coaching"] },
      { id: "gym-3", label: "not crowded", phrases: ["never felt too crowded", "enough space to work out", "manageable crowd levels", "rarely had to wait for equipment"] },
      { id: "gym-4", label: "good hours", phrases: ["convenient operating hours", "open when I need it", "good hours for my schedule", "flexible timings"] },
      { id: "gym-5", label: "fair pricing", phrases: ["fair membership pricing", "reasonable cost for what's offered", "good value membership", "transparent pricing"] },
      { id: "gym-6", label: "good atmosphere", phrases: ["a great atmosphere", "motivating environment", "good energy in the gym", "an enjoyable place to train"] },
      { id: "gym-7", label: "changing rooms", phrases: ["clean changing rooms", "well-kept changing facilities", "decent locker rooms", "good changing room facilities"] },
    ],
  },
  {
    key: "physiotherapy",
    label: "Physiotherapy",
    exampleBusiness: "MoveWell Physio",
    exampleLocality: "Anna Nagar, Chennai",
    tags: [
      { id: "physiotherapy-0", label: "clear guidance", phrases: ["clear guidance throughout", "explained the exercises well", "gave clear instructions", "easy to understand advice"] },
      { id: "physiotherapy-1", label: "felt better", phrases: ["felt noticeably better after sessions", "real improvement in how I feel", "made real progress", "recovered faster than expected"] },
      { id: "physiotherapy-2", label: "patient therapist", phrases: ["the therapist was patient", "took time with me", "never felt rushed", "attentive and patient throughout"] },
      { id: "physiotherapy-3", label: "on time", phrases: ["sessions started on time", "no long wait for appointments", "punctual scheduling", "minimal waiting between sessions"] },
      { id: "physiotherapy-4", label: "clean facility", phrases: ["the facility was clean", "well-maintained space", "hygienic setup", "a tidy, clean clinic"] },
      { id: "physiotherapy-5", label: "good equipment", phrases: ["good equipment available", "well-equipped for the exercises", "modern therapy equipment", "proper equipment for treatment"] },
      { id: "physiotherapy-6", label: "fair pricing", phrases: ["fair pricing for the sessions", "reasonable cost", "good value for the treatment", "transparent about fees"] },
      { id: "physiotherapy-7", label: "personalised plan", phrases: ["a personalised treatment plan", "tailored to my specific needs", "a plan built around my recovery", "customised exercises for me"] },
    ],
  },
  {
    key: "coaching",
    label: "Coaching centres",
    exampleBusiness: "Pathway Classes",
    exampleLocality: "Vijay Nagar, Indore",
    tags: [
      { id: "coaching-0", label: "clear teaching", phrases: ["clear teaching throughout", "concepts explained well", "easy to follow lessons", "explained clearly at every step"] },
      { id: "coaching-1", label: "helpful faculty", phrases: ["the faculty were helpful", "supportive teaching staff", "faculty who genuinely help", "attentive teachers"] },
      { id: "coaching-2", label: "good material", phrases: ["good quality study material", "well-prepared material", "useful reference material", "comprehensive study material"] },
      { id: "coaching-3", label: "small batches", phrases: ["small batch sizes", "manageable class sizes", "enough individual attention", "not overcrowded batches"] },
      { id: "coaching-4", label: "regular tests", phrases: ["regular tests to track progress", "frequent practice tests", "consistent assessments", "good testing routine"] },
      { id: "coaching-5", label: "fair fees", phrases: ["fair fees for what's offered", "reasonable cost", "good value for the course", "transparent about fees"] },
      { id: "coaching-6", label: "doubt solving", phrases: ["doubts were resolved quickly", "happy to answer questions", "good doubt-clearing sessions", "always available to clarify doubts"] },
      { id: "coaching-7", label: "good results", phrases: ["good results from the course", "noticeable improvement", "results that speak for themselves", "delivered real results"] },
    ],
  },
];

export function getDemoVertical(key: string): DemoVertical {
  return DEMO_VERTICALS.find((v) => v.key === key) ?? DEMO_VERTICALS[0];
}
