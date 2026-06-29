# Humanity Union Technology Stack Decision

## Decision

Humanity Union will be built using a modern JavaScript/TypeScript-oriented architecture.

This decision establishes the official technology foundation for the MVP and all related implementation work. Frontend, backend, data, authentication, progressive web capabilities, and deployment practices must align with the approved stack defined below.

## Approved Stack

### Frontend

HTML5, CSS3, JavaScript, gradual TypeScript adoption, Vite.

The client layer uses standards-based markup and styling, with JavaScript as the initial implementation language and TypeScript introduced incrementally as modules mature. Vite serves as the development and build tool for fast local iteration and optimized production bundles.

### Backend

Node.js, Express.js.

The server layer uses Node.js as the runtime and Express.js as the HTTP application framework, providing a lightweight and well-understood foundation for REST-style APIs and platform services.

### Database

MongoDB Atlas.

Persistent data is stored in MongoDB Atlas, a managed document database suitable for flexible schemas, cloud hosting, and operational scalability without self-managed infrastructure during early project phases.

### Authentication

JWT access tokens and secure refresh tokens.

User sessions are secured with short-lived JWT access tokens for authorized API requests and refresh tokens stored and rotated according to security best practices to maintain authenticated access without excessive re-login friction.

### PWA

Web App Manifest and Service Worker.

The platform is delivered as a Progressive Web Application using a Web App Manifest for installability and metadata, and a Service Worker for caching, offline support, and improved performance on supported devices.

### Deployment

Local development first, then staging, then production.

Environments progress from local development for daily work, to staging for integration and pre-release validation, to production for live platform operation. Each stage must be validated before promotion to the next.

## Reasoning

This stack was selected because it allows Humanity Union to use one main language family across frontend and backend, reducing cognitive overhead and context switching for contributors—particularly those new to full-stack development.

JavaScript and TypeScript provide a unified ecosystem for building user interfaces, API services, and shared data models. Node.js with Express.js offers a proven, minimal foundation for scalable API development without introducing unnecessary framework complexity during the MVP phase.

MongoDB Atlas aligns naturally with a JavaScript-oriented backend through document-based data modeling, managed cloud operations, and straightforward integration patterns. It supports evolving schemas as governance, publication, and verification features are defined in detail.

The same stack supports a future-ready PWA delivery model. Vite, modern browser APIs, a Web App Manifest, and Service Worker capabilities allow the platform to function as an installable web application while remaining accessible through standard browsers.

Together, these choices balance developer accessibility, architectural clarity, and a credible path from MVP to a production-grade humanitarian platform.

## Rejected Option

A PHP backend was considered but rejected for the MVP because it would require maintaining two separate programming ecosystems.

PHP would introduce a distinct server-side language, tooling chain, and deployment conventions alongside the JavaScript frontend stack. That separation increases maintenance cost, slows onboarding, and fragments shared conventions for validation, types, and API contracts. For the MVP, a single language family across client and server is the preferred trade-off.

## Rule

All future implementation tasks must follow this stack unless a new architectural decision explicitly changes it.

Any proposed deviation from this document—such as an alternate runtime, database, authentication model, or build system—must be recorded as a formal architectural decision and approved before implementation begins. Until such a decision is made, this stack remains binding for Humanity Union MVP work.

This decision is mandatory for the Humanity Union MVP architecture.
