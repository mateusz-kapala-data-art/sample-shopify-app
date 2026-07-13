// [SLIDE D1] Compliance-topic handler (HOOK-06): customers/data_request,
// customers/redact, shop/redact all route here from the worker's switch.
//
// Phase 1 scope: accept and log the event LOUDLY so the audience can see the
// topic reach a dedicated code path without error. Real export/redaction
// logic (actually deleting/exporting customer data) is out of scope for this
// phase and is a fast-follow, not silently faked here.
//
// Never swallow errors silently in this file: these are legal-compliance-
// critical paths (GDPR/CCPA-style requests) where a silent failure is worse
// than a visible one (RESEARCH Security Domain — Information Disclosure).
export async function handleComplianceEvent(
  topic: string,
  shop: string,
  payload: string,
) {
  // Log topic + shop only — never dump the raw payload, which may carry PII.
  console.log(`[compliance] ${topic} received for ${shop}`);

  try {
    // TODO (fast-follow, out of scope for Phase 1): implement actual
    // export/redaction logic per topic. For now this is a routing/visibility
    // stub — the requirement (HOOK-06) is that these topics reach this
    // dedicated handler, not that redaction is fully implemented.
    void payload;
  } catch (err) {
    // Fail LOUDLY — do not swallow. A silent failure here could leave PII
    // un-redacted with no trace that anything went wrong.
    console.error(`[compliance] FAILED to handle ${topic} for ${shop}`, err);
    throw err;
  }
}
