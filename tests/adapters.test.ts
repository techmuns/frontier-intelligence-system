import { describe, it, expect, vi, afterEach } from "vitest";
// @ts-expect-error — plain .mjs module, shared with the enrich script
import { collect } from "../scripts/adapters/github.mjs";

const companies = [
  { slug: "acme", name: "Acme", website: "https://acme.com" },
  { slug: "beta", name: "Beta", website: "https://beta.dev" },
];

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GITHUB_TOKEN;
  vi.restoreAllMocks();
});

const reply = (status: number, body: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response;

describe("github adapter — a failed lookup must never become data", () => {
  // The bug this guards: a GITHUB_TOKEN that was present but invalid returned
  // 401 for every call, and the adapter recorded 1,318 null readings. A null
  // means "we looked and it is genuinely not there". Recording "we never
  // looked" that way turns a broken credential into the finding that no YC
  // company has open source — and nothing about the data looks wrong.
  it("records NOTHING when the token is rejected", async () => {
    process.env.GITHUB_TOKEN = "invalid";
    // The body carries a healthy rate-limit budget alongside the 401, so the
    // budget guard cannot be what rescues this.
    //
    // Two independent guards produce this outcome — the preflight status check
    // and the mid-run abort — and mutation testing confirms either one alone
    // holds it: deleting one keeps the test green, deleting both fails it.
    // That is defence in depth rather than missing coverage, and worth knowing
    // before anyone "simplifies" one of them away.
    globalThis.fetch = vi.fn(async () =>
      reply(401, { message: "Bad credentials", resources: { core: { remaining: 5000 } } }),
    ) as never;

    const out = await collect(companies);
    expect(out).toEqual([]);
  });

  it("records nothing when no token is configured at all", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as never;

    expect(await collect(companies)).toEqual([]);
    // It must not even reach the network — a 60/hr budget cannot cover this.
    expect(spy).not.toHaveBeenCalled();
  });

  // A run that starts with budget and exhausts it partway would write nulls
  // for whatever is left in the list: the same false statement, smaller.
  it("records nothing when too little rate-limit budget remains", async () => {
    process.env.GITHUB_TOKEN = "valid-but-spent";
    globalThis.fetch = vi.fn(async () =>
      reply(200, { resources: { core: { remaining: 12 } } }),
    ) as never;

    expect(await collect(companies)).toEqual([]);
  });

  it("discards the whole run when GitHub starts refusing part-way through", async () => {
    process.env.GITHUB_TOKEN = "valid";
    let call = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      call++;
      if (String(url).includes("/rate_limit")) {
        return reply(200, { resources: { core: { remaining: 5000 } } });
      }
      // First company resolves cleanly, then credentials stop working.
      if (call > 2) return reply(403, { message: "rate limit exceeded" });
      return reply(200, { items: [] });
    }) as never;

    expect(await collect(companies)).toEqual([]);
  });

  it("collects normally when credentials and budget are fine", async () => {
    process.env.GITHUB_TOKEN = "valid";
    globalThis.fetch = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/rate_limit")) return reply(200, { resources: { core: { remaining: 5000 } } });
      if (u.includes("/search/users")) return reply(200, { items: [{ login: "acme-oss" }] });
      if (u.includes("/orgs/acme-oss/repos")) {
        return reply(200, [{ stargazers_count: 40 }, { stargazers_count: 2 }]);
      }
      if (u.includes("/orgs/")) return reply(200, { login: "acme-oss", blog: "https://acme.com" });
      return reply(404, {});
    }) as never;

    const out = await collect(companies);
    expect(out.length).toBeGreaterThan(0);
    const stars = out.find((o: any) => o.companySlug === "acme" && o.metric === "github_stars");
    // Verified by domain, so the org's repos are safe to attribute.
    expect(stars.value).toBe(42);
  });

  // The verification step is the whole reason this adapter is trustworthy:
  // searching GitHub for "Moda" returns modal-labs (a different YC company),
  // a Taiwanese government org and a New York City government org.
  it("refuses an org whose website does not match the company's domain", async () => {
    process.env.GITHUB_TOKEN = "valid";
    globalThis.fetch = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/rate_limit")) return reply(200, { resources: { core: { remaining: 5000 } } });
      if (u.includes("/search/users")) return reply(200, { items: [{ login: "modal-labs" }] });
      if (u.includes("/repos")) return reply(200, [{ stargazers_count: 9999 }]);
      if (u.includes("/orgs/")) return reply(200, { login: "modal-labs", blog: "https://modal.com" });
      return reply(404, {});
    }) as never;

    const out = await collect([companies[0]]);
    const stars = out.find((o: any) => o.metric === "github_stars");
    // Null, not 9999 — an unverified org's stars belong to someone else.
    expect(stars.value).toBeNull();
  });
});
