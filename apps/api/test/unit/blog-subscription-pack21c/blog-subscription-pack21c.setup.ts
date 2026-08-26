/** Pack 21C unit-test isolation — must load before subscriber modules. */
process.env.BLOG_SUBSCRIBER_FORCE_MEMORY = "true";
process.env.EMAIL_PROVIDER = "mock";
process.env.NODE_ENV = "test";
process.env.PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL ?? "https://example.com";
delete process.env.MONGODB_URI;
delete process.env.MONGODB_DATABASE;
delete process.env.MONGODB_TEST_DATABASE;
