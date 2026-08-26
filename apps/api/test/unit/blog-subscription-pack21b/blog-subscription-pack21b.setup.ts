/** Pack 21B unit-test isolation — must load before subscriber / settings modules. */
process.env.BLOG_SUBSCRIBER_FORCE_MEMORY = "true";
process.env.EMAIL_PROVIDER = "mock";
process.env.NODE_ENV = "test";
process.env.PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL ?? "https://example.com";
// Keep MailDeliveryService / Admin audit on in-memory seams (no Atlas DNS in unit tests).
delete process.env.MONGODB_URI;
delete process.env.MONGODB_DATABASE;
delete process.env.MONGODB_TEST_DATABASE;
