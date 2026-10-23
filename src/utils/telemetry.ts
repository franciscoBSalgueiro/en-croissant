import posthog from "posthog-js";

let initialized = false;

export function setTelemetryEnabled(enabled: boolean) {
    if (!enabled) {
        if (initialized) posthog.opt_out_capturing();
        return;
    }

    if (!initialized) {
        posthog.init("phc_kgEBtifs0EgWlrl4ROYEbnsQ1b7BS2W5BKLNyXe7f8z", {
            api_host: "https://app.posthog.com",
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            disable_session_recording: true,
        });
        initialized = true;
    }

    // The app preference is authoritative, including after a previous SDK opt-out.
    posthog.opt_in_capturing({ captureEventName: false });
}
