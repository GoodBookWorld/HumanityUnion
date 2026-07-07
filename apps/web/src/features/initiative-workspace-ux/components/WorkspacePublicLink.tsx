import Link from "next/link";

export function WorkspacePublicLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="workspace-public-link" href={href}>
      {label}
    </Link>
  );
}
