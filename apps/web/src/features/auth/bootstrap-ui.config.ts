export function isBootstrapUiAllowed(): boolean {
  return process.env.NEXT_PUBLIC_ALLOW_BOOTSTRAP_UI === "true";
}
