/**
 * RSS-SOURCE-02B.2 — article images through RSS parse, filter, normalize, storage
 * and the public API. Fixtures follow real publisher markup (Guardian media:content,
 * WordPress `&#038;` enclosures, BBC media:thumbnail, The Conversation inline img).
 */
process.env.NODE_TEST_ENV = "true";
process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
process.env.NEWS_PROVIDER_ENABLED = "true";
process.env.NEWS_PROVIDER_NAME = "rss";
process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk";
delete process.env.MONGODB_URI;
// test-setup enables verification mode, which swaps in the mock provider.
delete process.env.HU_VERIFICATION_MODE;

import assert from "node:assert/strict";
import dnsPromises from "node:dns/promises";
import { after, before, beforeEach, describe, it, mock } from "node:test";

import type { MediaResource, NewsArticleRecord } from "@hu/types";

import {
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpBuildRequestQueueForTests,
  resetPublishedLocalizationPersistenceForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import { ensureMediaResourcesSeededOnce } from "../../../src/modules/media-resources/media-resource.service.js";
import {
  resetMediaResourcesMemoryForTests,
  upsertMediaResourceMemory,
} from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import { setMediaResourceForceMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import { resetPublicNewsRefreshLeaseForTests } from "../../../src/modules/public-news/public-news-refresh-lease.js";
import { sanitizePublicNewsImageUrl } from "../../../src/modules/public-news/public-news-image-url.js";
import { resetPublicNewsSourceHealthForTests } from "../../../src/modules/public-news/public-news-source-health.repository.js";
import { refreshApprovedNewsSourcesFromMediaResources } from "../../../src/modules/public-news/public-news.config.js";
import {
  setExternalFetchRetrySleepForTests,
  setExternalHttpTransportForTests,
} from "../../../src/modules/public-news/public-news.fetch.js";
import {
  normalizeExternalNewsArticle,
  toPublicNewsArticleItem,
} from "../../../src/modules/public-news/public-news.normalize.js";
import {
  findActivePublicNewsRecords,
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";
import { parseRssOrAtomFeed } from "../../../src/modules/public-news/public-news.rss-parser.js";
import {
  listPublicNewsArticles,
  refreshPublicNews,
} from "../../../src/modules/public-news/public-news.service.js";
import { toExternalHttpResponse } from "../../helpers/fake-external-http.js";

const FEED = "https://www.pravda.com.ua/rss/view_news/";
const ARTICLE = "https://www.pravda.com.ua/eng/news/2026/11/06/7512100/";
const GUARDIAN_IMAGE =
  "https://i.guim.co.uk/img/media/ed5b/351_0_4295_3437/master/4295.jpg?width=700&quality=85&auto=format&fit=max&s=a93b";

function item(extra: string, link = ARTICLE, title = "Image pipeline article title"): string {
  return `<item><title>${title}</title><link>${link}</link><description>Summary text for the image pipeline article.</description><pubDate>${new Date().toUTCString()}</pubDate>${extra}</item>`;
}

function feed(...items: string[]): string {
  return `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Feed</title>${items.join("")}</channel></rss>`;
}

const imageOf = (xml: string) => parseRssOrAtomFeed(feed(xml), FEED)[0]?.imageUrl;

describe("RSS-SOURCE-02B.2 — RSS image extraction", () => {
  it("1. media:content without medium/type (Guardian): decoded, widest rendition", () => {
    const tags = [140, 700, 460]
      .map(
        (width) =>
          `<media:content width="${width}" url="https://i.guim.co.uk/img/media/ed5b/351_0_4295_3437/master/4295.jpg?width=${width}&amp;quality=85&amp;auto=format&amp;fit=max&amp;s=a93b"><media:credit scheme="urn:ebu">Photo</media:credit></media:content>`,
      )
      .join("");
    assert.equal(imageOf(item(tags)), GUARDIAN_IMAGE);
  });

  it("2. media:thumbnail keeps priority; media:content with medium=image or image type", () => {
    assert.equal(
      imageOf(
        item(
          '<media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/ace/standard/240/a.jpg"/><media:content medium="image" url="https://ichef.bbci.co.uk/large.jpg"/>',
        ),
      ),
      "https://ichef.bbci.co.uk/ace/standard/240/a.jpg",
    );
    assert.equal(
      imageOf(
        item('<media:content type="image/png" url="https://static01.nyt.com/images/x/photo"/>'),
      ),
      "https://static01.nyt.com/images/x/photo",
    );
    assert.equal(
      imageOf(item('<media:content medium="video" url="https://cdn.example.org/clip.jpg"/>')),
      undefined,
      "explicit non-image media is ignored",
    );
  });

  it("3. image enclosure with WordPress-escaped query (&#038;) keeps every parameter", () => {
    assert.equal(
      imageOf(
        item(
          '<enclosure url="https://globalnews.ca/wp-content/uploads/2026/11/e37.jpg?quality=65&#038;strip=all&#038;w=720&#038;h=480&#038;crop=1" length="40616" type="image/jpeg"/>',
        ),
      ),
      "https://globalnews.ca/wp-content/uploads/2026/11/e37.jpg?quality=65&strip=all&w=720&h=480&crop=1",
    );
    assert.equal(
      imageOf(item('<enclosure url="https://cdn.example.org/audio.mp3" type="audio/mpeg"/>')),
      undefined,
    );
  });

  it("4. inline HTML img (The Conversation) and itunes:image; tracking pixels skipped", () => {
    assert.equal(
      imageOf(
        item(
          '<content:encoded><![CDATA[<img src="https://pixel.example.org/rss-pixel.gif"/><img src="https://images.theconversation.com/files/1/original.jpg?ixlib=rb&amp;w=1050"/>]]></content:encoded>',
        ),
      ),
      "https://images.theconversation.com/files/1/original.jpg?ixlib=rb&w=1050",
    );
    assert.equal(
      imageOf(item('<itunes:image href="https://cdn.example.org/cover.jpg?a=1&amp;b=2"/>')),
      "https://cdn.example.org/cover.jpg?a=1&b=2",
    );
  });

  it("5. item without any image has no imageUrl", () => {
    assert.equal(imageOf(item("")), undefined);
  });

  it("6. unsafe image URLs are dropped and the next safe candidate is used", () => {
    for (const unsafe of [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "http://cdn.example.org/a.jpg",
      "https://10.0.0.5/a.jpg",
      "https://[::1]/a.jpg",
      "https://localhost/a.jpg",
      "https://printer.local/a.jpg",
      "https://metadata.internal/a.jpg",
      "https://user:pw@cdn.example.org/a.jpg",
      "https://cdn.example.org:8443/a.jpg",
      "//cdn.example.org/a.jpg",
      `https://cdn.example.org/${"a".repeat(2100)}.jpg`,
    ]) {
      assert.equal(sanitizePublicNewsImageUrl(unsafe), undefined, unsafe);
      assert.equal(
        imageOf(
          item(
            `<media:content medium="image" url="${unsafe}"/><enclosure type="image/jpeg" url="https://cdn.example.org/safe.jpg"/>`,
          ),
        ),
        "https://cdn.example.org/safe.jpg",
        unsafe,
      );
    }
    assert.equal(
      sanitizePublicNewsImageUrl("https://cdn.example.org/a.jpg#frag"),
      "https://cdn.example.org/a.jpg",
    );
  });

  it("7. normalization keeps safe images and drops unsafe ones", () => {
    const base = {
      provider: "rss",
      sourceName: "Source",
      title: "Normalization image title",
      articleUrl: ARTICLE,
      publishedAt: new Date().toISOString(),
      language: "en",
    };
    assert.equal(
      normalizeExternalNewsArticle({ ...base, imageUrl: GUARDIAN_IMAGE }, 7).imageUrl,
      GUARDIAN_IMAGE,
    );
    for (const unsafe of [
      "http://cdn.example.org/a.jpg",
      "javascript:alert(1)",
      "https://127.0.0.1/a.jpg",
    ]) {
      assert.equal(
        normalizeExternalNewsArticle({ ...base, imageUrl: unsafe }, 7).imageUrl,
        undefined,
      );
    }
  });
});

describe("RSS-SOURCE-02B.2 — persistence and public API", () => {
  let feedXml = "";
  const source: MediaResource = {
    id: "pravda-ua",
    resourceType: "NEWS_SOURCE",
    scopeType: "COUNTRY",
    countryCode: "UA",
    name: "Українська правда",
    logoLabel: "УП",
    websiteUrl: "https://www.pravda.com.ua",
    rssUrl: FEED,
    language: "en",
    providerId: null,
    active: true,
    sortOrder: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };

  before(async () => {
    setMediaResourceForceMemoryForTests(true);
    setLanguageRegistryForceMemoryForTests(true);
    setPlpAutoBuildWorkForceMemoryForTests(true);
    setPublishedLocalizationPersistenceModeForTests("memory");
    await ensureMediaResourcesSeededOnce();
    mock.method(dnsPromises, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
    setExternalHttpTransportForTests(async () =>
      toExternalHttpResponse({ status: 200, body: feedXml }),
    );
    setExternalFetchRetrySleepForTests(async () => undefined);
  });

  beforeEach(async () => {
    resetPublicNewsMemoryStoreForTests();
    resetPublicNewsSourceHealthForTests();
    resetPublicNewsRefreshLeaseForTests();
    resetPlpAutoBuildWorkStoreForTests();
    resetPlpBuildRequestQueueForTests();
    resetPublishedLocalizationPersistenceForTests();
    resetMediaResourcesMemoryForTests();
    upsertMediaResourceMemory(source);
    await refreshApprovedNewsSourcesFromMediaResources();
  });

  after(() => {
    mock.restoreAll();
    setExternalHttpTransportForTests(null);
    setExternalFetchRetrySleepForTests(null);
    resetMediaResourcesMemoryForTests();
    resetPublicNewsMemoryStoreForTests();
    setMediaResourceForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    resetLanguageRegistryStoreForTests();
    setPlpAutoBuildWorkForceMemoryForTests(false);
  });

  const stored = () => findActivePublicNewsRecords({ limit: 50, language: "en" });
  const enclosure = (url: string) => `<enclosure type="image/jpeg" url="${url}"/>`;

  it("8. images survive the full refresh and reach the public API, each with its own article", async () => {
    const second = "https://www.pravda.com.ua/eng/news/2026/11/06/7512101/";
    feedXml = feed(
      item(enclosure("https://uimg.pravda.com.ua/images/one.jpeg")),
      item(
        enclosure("https://uimg.pravda.com.ua/images/two.jpeg"),
        second,
        "Second image article title",
      ),
      item(
        "",
        "https://www.pravda.com.ua/eng/news/2026/11/06/7512102/",
        "Article without any image",
      ),
    );
    await refreshPublicNews();
    const byUrl = Object.fromEntries((await stored()).map((record) => [record.articleUrl, record]));
    assert.equal(byUrl[ARTICLE]?.imageUrl, "https://uimg.pravda.com.ua/images/one.jpeg");
    assert.equal(byUrl[second]?.imageUrl, "https://uimg.pravda.com.ua/images/two.jpeg");
    assert.equal(
      byUrl["https://www.pravda.com.ua/eng/news/2026/11/06/7512102/"]?.imageUrl,
      undefined,
    );

    const listing = await listPublicNewsArticles({ limit: 6, sources: ["Українська правда"] });
    const items = Object.fromEntries(listing.items.map((entry) => [entry.articleUrl, entry]));
    assert.equal(items[ARTICLE]?.imageUrl, "https://uimg.pravda.com.ua/images/one.jpeg");
    assert.equal(items[second]?.imageUrl, "https://uimg.pravda.com.ua/images/two.jpeg");
    assert.equal(
      items["https://www.pravda.com.ua/eng/news/2026/11/06/7512102/"]?.imageUrl,
      undefined,
    );
  });

  it("9. upserts: same article stays one record; a missing image keeps the stored one; a new one replaces it", async () => {
    feedXml = feed(item(enclosure("https://uimg.pravda.com.ua/images/first.jpeg")));
    await refreshPublicNews();
    feedXml = feed(item(""));
    await refreshPublicNews();
    let records = await stored();
    assert.equal(records.length, 1);
    assert.equal(records[0]?.imageUrl, "https://uimg.pravda.com.ua/images/first.jpeg");

    feedXml = feed(item(enclosure("https://uimg.pravda.com.ua/images/updated.jpeg")));
    await refreshPublicNews();
    records = await stored();
    assert.equal(records.length, 1);
    assert.equal(records[0]?.imageUrl, "https://uimg.pravda.com.ua/images/updated.jpeg");
  });

  it("10. renaming the source (same mediaResourceId) keeps each article's image", async () => {
    feedXml = feed(item(enclosure("https://uimg.pravda.com.ua/images/kept.jpeg")));
    await refreshPublicNews();
    resetMediaResourcesMemoryForTests();
    upsertMediaResourceMemory({ ...source, name: "Ukrainska Pravda" });
    await refreshApprovedNewsSourcesFromMediaResources();
    feedXml = feed(item(""));
    await refreshPublicNews();
    const listing = await listPublicNewsArticles({ limit: 6, sources: ["Ukrainska Pravda"] });
    assert.equal(listing.items.length, 1);
    assert.equal(listing.items[0]?.sourceName, "Ukrainska Pravda");
    assert.equal(listing.items[0]?.imageUrl, "https://uimg.pravda.com.ua/images/kept.jpeg");
  });

  it("11. a stored unsafe image (legacy data) is never served by the public API", async () => {
    const now = new Date().toISOString();
    const legacy: NewsArticleRecord = {
      id: "news-legacy-image",
      provider: "rss",
      sourceName: "Українська правда",
      title: "Legacy record with an insecure image",
      summary: "Legacy summary.",
      articleUrl: ARTICLE,
      normalizedArticleUrl: ARTICLE,
      imageUrl: "http://insecure.example.org/a.jpg",
      publishedAt: now,
      fetchedAt: now,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      language: "en",
      status: "active",
      verificationStatus: "external-source",
      createdAt: now,
      updatedAt: now,
    };
    await upsertPublicNewsRecords([legacy]);
    assert.equal(toPublicNewsArticleItem(legacy).imageUrl, undefined);
    const listing = await listPublicNewsArticles({ limit: 6 });
    assert.equal(listing.items.find((entry) => entry.id === legacy.id)?.imageUrl, undefined);
  });
});
