interface StatusBannerProps {
  title: string;
  message: string;
}

export function StatusBanner({ title, message }: StatusBannerProps) {
  return (
    <div className="hu-status-banner" role="status">
      <p className="hu-status-banner__title">{title}</p>
      <p className="hu-status-banner__message">{message}</p>
    </div>
  );
}
