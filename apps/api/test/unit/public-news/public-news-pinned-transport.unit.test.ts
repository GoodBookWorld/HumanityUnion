/**
 * RSS-SOURCE-02B.1 — the pinned node:https transport on real sockets: TLS validates
 * the certificate against the hostname (not the pinned IP), SNI carries the hostname,
 * and Happy Eyeballs falls back between the pinned addresses only.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TLSSocket } from "node:tls";
import tls from "node:tls";
import { after, before, describe, it } from "node:test";

import {
  pinnedNodeTransport,
  type ExternalHttpRequest,
} from "../../../src/modules/public-news/public-news.fetch.js";

const HOST = "feed.pinned-02b.test";

function hasOpenssl(): boolean {
  try {
    execFileSync("openssl", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function issueCertificates(dir: string): { ca: string; key: string; cert: string } {
  const run = (args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
  writeFileSync(
    path.join(dir, "ca.ext"),
    "basicConstraints=critical,CA:TRUE\nkeyUsage=keyCertSign,cRLSign\n",
  );
  writeFileSync(path.join(dir, "srv.ext"), `subjectAltName=DNS:${HOST}\n`);
  run(["genrsa", "-out", "ca.key", "2048"]);
  run(["req", "-new", "-key", "ca.key", "-subj", "/CN=HU 02B test CA", "-out", "ca.csr"]);
  run([
    "x509",
    "-req",
    "-in",
    "ca.csr",
    "-signkey",
    "ca.key",
    "-days",
    "2",
    "-extfile",
    "ca.ext",
    "-out",
    "ca.pem",
  ]);
  run(["genrsa", "-out", "srv.key", "2048"]);
  run(["req", "-new", "-key", "srv.key", "-subj", `/CN=${HOST}`, "-out", "srv.csr"]);
  run([
    "x509",
    "-req",
    "-in",
    "srv.csr",
    "-CA",
    "ca.pem",
    "-CAkey",
    "ca.key",
    "-CAcreateserial",
    "-days",
    "2",
    "-extfile",
    "srv.ext",
    "-out",
    "srv.pem",
  ]);
  const read = (name: string) => readFileSync(path.join(dir, name), "utf8");
  return { ca: read("ca.pem"), key: read("srv.key"), cert: read("srv.pem") };
}

async function readBody(
  response: Awaited<ReturnType<typeof pinnedNodeTransport>>,
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of response.body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function request(url: string, addresses: ExternalHttpRequest["addresses"]): ExternalHttpRequest {
  return {
    url: new URL(url),
    address: addresses[0]!.address,
    family: addresses[0]!.family,
    addresses,
    headers: {},
    signal: AbortSignal.timeout(5_000),
  };
}

const listen = (server: Server, host: string) =>
  new Promise<number>((resolve) =>
    server.listen(0, host, () => resolve((server.address() as AddressInfo).port)),
  );
const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

describe("RSS-SOURCE-02B.1 — pinned transport TLS validation", { skip: !hasOpenssl() }, () => {
  let dir = "";
  let server: Server;
  let port = 0;
  let seenServername: TLSSocket["servername"] | undefined;
  const originalCas = tls.getCACertificates("default");

  before(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "hu-02b-tls-"));
    const { ca, key, cert } = issueCertificates(dir);
    tls.setDefaultCACertificates([...originalCas, ca]);
    server = createHttpsServer({ key, cert }, (req, res) => {
      seenServername = (req.socket as TLSSocket).servername;
      res.writeHead(200, { "Content-Type": "application/rss+xml" });
      res.end("<rss>tls</rss>");
    });
    port = await listen(server, "127.0.0.1");
  });

  after(async () => {
    await close(server);
    tls.setDefaultCACertificates(originalCas);
    rmSync(dir, { recursive: true, force: true });
  });

  it("1. certificate is validated for the hostname while connecting to the pinned IP", async () => {
    const response = await pinnedNodeTransport(
      request(`https://${HOST}:${port}/rss`, [{ address: "127.0.0.1", family: 4 }]),
    );
    assert.equal(response.status, 200);
    assert.equal(await readBody(response), "<rss>tls</rss>");
    assert.equal(seenServername, HOST, "SNI carries the hostname, not the IP");
  });

  it("2. a hostname the certificate does not cover is refused even at the same IP", async () => {
    await assert.rejects(
      pinnedNodeTransport(
        request(`https://other.pinned-02b.test:${port}/rss`, [{ address: "127.0.0.1", family: 4 }]),
      ),
      (error: NodeJS.ErrnoException) => {
        assert.equal(error.code, "ERR_TLS_CERT_ALTNAME_INVALID");
        return true;
      },
    );
  });

  it("3. an untrusted certificate is refused", async () => {
    tls.setDefaultCACertificates(originalCas);
    try {
      await assert.rejects(
        pinnedNodeTransport(
          request(`https://${HOST}:${port}/rss`, [{ address: "127.0.0.1", family: 4 }]),
        ),
        /certificate/i,
      );
    } finally {
      tls.setDefaultCACertificates([
        ...originalCas,
        readFileSync(path.join(dir, "ca.pem"), "utf8"),
      ]);
    }
  });
});

describe("RSS-SOURCE-02B.1 — pinned transport address fallback", () => {
  let server: Server;
  let port = 0;

  before(async () => {
    server = createHttpServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/rss+xml" });
      res.end("<rss>v4</rss>");
    });
    port = await listen(server, "127.0.0.1");
  });

  after(() => close(server));

  it("4. IPv6 first, unreachable: falls back to the pinned IPv4 address", async () => {
    const response = await pinnedNodeTransport(
      request(`http://dual.pinned-02b.test:${port}/rss`, [
        { address: "::1", family: 6 },
        { address: "127.0.0.1", family: 4 },
      ]),
    );
    assert.equal(response.status, 200);
    assert.equal(await readBody(response), "<rss>v4</rss>");
  });

  it("5. never leaves the pinned set: no reachable pinned address means failure", async () => {
    await assert.rejects(
      pinnedNodeTransport(
        request(`http://dual.pinned-02b.test:${port}/rss`, [{ address: "::1", family: 6 }]),
      ),
      /ECONNREFUSED|EADDRNOTAVAIL|ENETUNREACH/,
    );
  });
});
