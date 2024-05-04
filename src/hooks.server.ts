import {sequence} from "@sveltejs/kit/hooks";
import * as Sentry from "@sentry/sveltekit";
import { dbConnect } from "$lib/db";

Sentry.init({
    dsn: "https://2d59ea8dc270b68ae5300743a2adfeae@o879779.ingest.us.sentry.io/4507160073601024",
    tracesSampleRate: 1
})

dbConnect();
export const handleError = Sentry.handleErrorWithSentry();
export const handle = sequence(Sentry.sentryHandle());