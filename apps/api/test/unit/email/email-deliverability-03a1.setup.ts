/** EMAIL DELIVERABILITY 03A.1 — unit-test isolation before subscriber/email modules. */
process.env.BLOG_SUBSCRIBER_FORCE_MEMORY = "true";
process.env.EMAIL_PROVIDER = "mock";
process.env.NODE_ENV = "test";
process.env.NODE_TEST_ENV = "true";
process.env.WEB_ORIGIN = process.env.WEB_ORIGIN ?? "https://example.com";
process.env.PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL ?? "https://example.com";
delete process.env.MONGODB_URI;
delete process.env.MONGODB_DATABASE;
delete process.env.MONGODB_TEST_DATABASE;
