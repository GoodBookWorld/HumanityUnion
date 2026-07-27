import { PublicHomeV2Page } from "../../public-home-v2/components/PublicHomeV2Page";

export async function GlobalExperiencePage() {
  return (
    <div className="global-experience-page">
      <main className="global-experience-page__main">
        <div className="global-experience-page__content">
          <PublicHomeV2Page />
        </div>
      </main>
    </div>
  );
}
