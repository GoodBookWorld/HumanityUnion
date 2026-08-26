/** Pack 21A unit-test isolation — must load before subscriber modules. */
process.env.BLOG_SUBSCRIBER_FORCE_MEMORY = "true";
process.env.EMAIL_PROVIDER = "mock";
// Pack 21B welcome path uses MailDeliveryService audit — keep memory seams in unit tests.
delete process.env.MONGODB_URI;
delete process.env.MONGODB_DATABASE;
delete process.env.MONGODB_TEST_DATABASE;
