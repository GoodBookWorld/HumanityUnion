/**
 * Reset 03C.1 — deprecated separate PLP page.
 * Structural parity requires the shared CivicMediaCenterPageContent renderer.
 * This module remains only as a fail-closed redirect helper for tests that
 * previously imported the dual-page architecture.
 */

export { CivicMediaCenterPageContent as CivicMediaCenterPlpContent } from "../../civic-media-center/components/CivicMediaCenterPageContent";
