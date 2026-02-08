import PQueue from "p-queue";
import { env } from "../config/env.js";

export const partnerQueue: InstanceType<typeof PQueue> = new PQueue({ concurrency: env.MAX_BROWSER_CONCURRENCY });
