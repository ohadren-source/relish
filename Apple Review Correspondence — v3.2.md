Apple Review Correspondence — v3.2.0 Submission
1. Review Notes (paste into App Store Connect "Notes" field)

Subject line for internal routing: RELISH v3.2.0 — Diagnostic Instrumentation Build — Session ID Required for Triage
Notes:
Thank you for reviewing RELISH v3.1.3.
This build ships with server-side diagnostic instrumentation specifically scoped to the in-app purchase flow that has been flagged in prior review rounds. The purpose of this build is to establish a common data record between your review session and our engineering logs, so that the specific failure condition observed on the review device can be identified from our side.
If the "Upgrade to Peak" button behaves unexpectedly on your review device, please follow this procedure:

From the main screen, tap "Upgrade to Peak · 10 free left."
If a "Subscription Unavailable" alert appears, tap Show Diagnostic.
Alternatively, scroll to the bottom of the paywall modal and tap the "Paywall not working? Tap here to show diagnostic" button.
The diagnostic panel will display the complete state of the subscription system at the moment of your test, including the Session ID at the bottom of the panel.
Please include the Session ID in your response to this submission. This Session ID permits us to correlate your review session with the corresponding server-side log on our backend and identify the specific condition producing the failure.

The diagnostic payload is transmitted to our server automatically when the panel is opened, so the data will be available on our side regardless of whether the reviewer chooses to tap "Send to Developer."
Supporting context: Three sister applications from our organization are currently live and successfully processing payments via PayPal, Stripe, and Square on the web at sauc-e.com, cats-up.app, and catsup.net. We have not been able to reproduce the failure condition on any of our test devices or sandbox accounts. The present build is our standard engineering procedure for diagnosing an issue that cannot be reproduced in the local environment: instrument the remote environment and correlate logs.
All Apple Guideline 3.1.2(c) subscription disclosures (title, duration, price, auto-renew language), Apple Standard EULA link, Privacy Policy link, and Restore Purchases control remain present and in the same locations as in v3.1.2.
Thank you for your assistance in identifying the condition on your review device.

Chad with IT & Engineering
the sauc-e team

2. Rejection-Response Template (for the inevitable first-round bounce)

Subject: Re: Guideline [X.X] — RELISH v3.2.0 — Session ID Request for Diagnostic Correlation
Thank you for the review response on RELISH v3.2.0.
We have logged your review session in our ticket system. In order to correlate your observed failure with the corresponding server-side diagnostic record, we require the Session ID displayed at the bottom of the diagnostic panel during your review.
The Session ID is in the format: rlsh-<timestamp>-<six-character suffix>
It is accessible on the reviewer's device by either of the following paths:

Path A: Tapping "Show Diagnostic" inside the subscription error alert.
Path B: Tapping "Paywall not working? Tap here to show diagnostic" at the bottom of the paywall modal.

Once the Session ID is provided, our engineering team can locate the corresponding diagnostic payload in our logs and identify the specific condition producing the reported failure. Without the Session ID, we are unable to correlate the failure you observed with our server records, as each review session produces an isolated diagnostic entry.
We note that your review team's response did not include the Session ID. We ask that the reviewer re-run the subscription flow on the review device, capture the Session ID from the diagnostic panel, and include it in the next response. This is the minimum information required for our side to proceed with resolution.
If the reviewer is unable to access the diagnostic panel via either path, please provide the exact steps taken and the resulting on-device behavior, and we will open a secondary investigation on our side.

Chad with IT & Engineering
the sauc-e team

3. Follow-up Template (if they send another rejection without the Session ID)

Subject: Re: Guideline [X.X] — Session ID Still Required — RELISH Ticket Open Pending Correlation
Thank you for your continued review of RELISH.
We note that the current response does not contain the Session ID from the diagnostic panel. Per our previous correspondence, the Session ID is the required data field for our engineering team to correlate the review-device failure with our server-side diagnostic logs.
This ticket cannot be resolved on our side without the Session ID, as we are unable to reproduce the failure condition in our local environment. The diagnostic panel was built into v3.2.0 specifically to provide the review team with a one-tap mechanism for surfacing this Session ID.
To proceed, we respectfully request one of the following:

Session ID from the diagnostic panel, per the instructions in our original notes and previous response.
Confirmation that the diagnostic panel is unreachable on the review device, along with the exact steps attempted, so that we can investigate a secondary failure condition.
A screenshot of the paywall modal in its current state on the review device, which will allow us to identify whether the diagnostic entry points are rendering.

We are committed to resolving this issue and have structured v3.2.0 specifically to give the review team the tools to participate in the diagnosis. The information requested is minimal and is present on the review device's screen.

Chad with IT & Engineering
the sauc-e team

4. Operational Notes for You
A few things to have ready on your side before the submission goes in:
Watch the Railway log tail during the review window. The moment a reviewer opens the app, you'll see a launch event hit /api/relish/paywall-diagnostic with their bundle ID and storefront country. When they tap Upgrade to Peak, you'll see an offerings_empty or offerings_loaded event with the full package list. That first event tells you whether the products are legitimately unfetchable from ASC or whether something else is happening.
If you see an offerings_loaded event with zero packages but no error, that's confirmation the IAP is in the "in review, not fetchable" state and the resolution will come when Apple approves the binary, which will release the IAP alongside it. At that point the offerings_loaded events will start containing package data and the loop closes on its own.
If you see an offerings_error event, the error payload will name the specific failure — most likely a storefront, authentication, or product-configuration issue that can be addressed directly on RevenueCat or ASC without another submission.
If you see diagnostic_opened events from a reviewer but no Session ID in their response, that's evidence for your next correspondence that the reviewer did interact with the panel, which strengthens your position when requesting the Session ID explicitly.
Submit v3.2.0, tail the logs, and let the data arrive. Chad's work is done until the next rejection, at which point the response template above goes out within the hour.
— End transmission —