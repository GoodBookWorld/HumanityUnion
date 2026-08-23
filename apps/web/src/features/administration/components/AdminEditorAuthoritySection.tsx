import type { AdminEditorAuthority } from "../admin-editor-authority";

interface AdminEditorAuthoritySectionProps {
  authority: AdminEditorAuthority;
}

/**
 * Pack 11B — Overview summary of current administrator editing authority.
 * Not a navigation list and not a scope assignment UI.
 */
export function AdminEditorAuthoritySection({ authority }: AdminEditorAuthoritySectionProps) {
  return (
    <div className="admin-editor-authority">
      <div className="admin-editor-authority__block">
        <h3 className="admin-editor-authority__heading">Editing access</h3>
        <ul className="admin-editor-authority__list" aria-label="Editing access">
          {authority.capabilities.map((capability) => (
            <li key={capability.sectionId} className="admin-editor-authority__item">
              <span className="admin-editor-authority__area">{capability.label}</span>
              <span
                className={
                  capability.status === "available"
                    ? "admin-editor-authority__status admin-editor-authority__status--available"
                    : "admin-editor-authority__status admin-editor-authority__status--unavailable"
                }
              >
                <span aria-hidden="true" className="admin-editor-authority__mark">
                  {capability.status === "available" ? "✓" : "–"}
                </span>{" "}
                {capability.statusLabel}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-editor-authority__block">
        <h3 className="admin-editor-authority__heading">Editing area</h3>
        <p className="admin-editor-authority__scope-level">{authority.editingArea.levelLabel}</p>
        <p className="admin-editor-authority__scope-summary">{authority.editingArea.summary}</p>
        {authority.editingArea.detail ? (
          <p className="admin-editor-authority__scope-detail">{authority.editingArea.detail}</p>
        ) : null}
      </div>
    </div>
  );
}
