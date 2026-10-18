import { permanentRedirect } from "next/navigation";

/** Local HU-MEM-04B URL. The block now lives on Admin Diagnostics. */
export default function AdminSystemHealthRedirectPage() {
  permanentRedirect("/admin/diagnostics#web-memory-critical-loads");
}
