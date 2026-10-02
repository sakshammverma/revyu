import { requireCron } from "@/server/auth/cron";
import { getDb } from "@/server/db";
import { handler, HttpError } from "@/server/http";
import { JOBS, runJob } from "@/server/services/jobs";

// Jobs walk every outlet; give them the longest window the plan allows.
export const maxDuration = 300;

type Context = { params: Promise<{ job: string }> };

// Vercel Cron issues GET; pg_cron / manual triggers can POST. Same behaviour.
const run = handler(async (request: Request, { params }: Context) => {
  requireCron(request);
  const { job: key } = await params;
  const job = JOBS.find((j) => j.key === key);
  if (!job) throw new HttpError(404, "UNKNOWN_JOB");
  const outcome = await runJob(getDb(), job);
  return Response.json({ job: job.key, ...outcome });
});

export const GET = run;
export const POST = run;
