import { FOOTER_SOCIAL_LINKS } from "../footer-links";

const SOCIAL_ICON_PATHS: Record<(typeof FOOTER_SOCIAL_LINKS)[number]["label"], string> = {
  Facebook: "/icons/civic/icons8-facebook.svg",
  YouTube: "/icons/civic/icons8-youtube.svg",
  LinkedIn: "/icons/civic/icons8-linkedin.svg",
  Instagram: "/icons/civic/icons8-instagram.svg",
  X: "/icons/civic/icons8-x.svg",
};

export function FooterSocialLinks() {
  return (
    <ul className="public-experience-footer__social-list">
      {FOOTER_SOCIAL_LINKS.map((social) => (
        <li key={social.label}>
          <a href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label}>
            <img
              src={SOCIAL_ICON_PATHS[social.label]}
              alt=""
              className="public-experience-footer__social-icon"
              width={24}
              height={24}
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
