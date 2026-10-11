import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchFreebies,
  fetchCategories,
  sendNotification,
  subscribeDigest,
  createAlert,
  listAlerts,
  deleteAlert,
} from "../lib/api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function okJson(data) {
  return { ok: true, json: async () => data };
}

describe("fetchFreebies", () => {
  it("builds correct URL with all params", async () => {
    mockFetch.mockResolvedValue(okJson({ freebies: [] }));
    await fetchFreebies({ category: "samples", query: "coffee", location: "Herndon", limit: 5 });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("/freebies?");
    expect(url).toContain("category=samples");
    expect(url).toContain("query=coffee");
    expect(url).toContain("location=Herndon");
    expect(url).toContain("limit=5");
  });

  it("omits empty query and location", async () => {
    mockFetch.mockResolvedValue(okJson({ freebies: [] }));
    await fetchFreebies({ category: "trials", query: "", location: "" });
    const url = mockFetch.mock.calls[0][0];
    expect(url).not.toContain("query=");
    expect(url).not.toContain("location=");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchFreebies({})).rejects.toThrow("API error: 500");
  });
});

describe("fetchCategories", () => {
  it("calls /categories", async () => {
    mockFetch.mockResolvedValue(okJson({ categories: [] }));
    await fetchCategories();
    expect(mockFetch.mock.calls[0][0]).toContain("/categories");
  });
});

describe("sendNotification", () => {
  it("POSTs email and freebies to /notify", async () => {
    mockFetch.mockResolvedValue(okJson({ status: "sent" }));
    const freebies = [{ title: "Free Coffee", url: "https://x.com", category: "samples" }];
    await sendNotification("a@b.com", freebies);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/notify");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.email).toBe("a@b.com");
    expect(body.freebies).toHaveLength(1);
  });

  it("surfaces backend error detail", async () => {
    mockFetch.mockResolvedValue({
      ok: false, status: 400,
      json: async () => ({ detail: "No freebies selected" }),
    });
    await expect(sendNotification("a@b.com", [])).rejects.toThrow("No freebies selected");
  });
});

describe("subscribeDigest", () => {
  it("POSTs to /subscribe", async () => {
    mockFetch.mockResolvedValue(okJson({ status: "subscribed" }));
    await subscribeDigest("a@b.com", ["samples", "food"]);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/subscribe");
    const body = JSON.parse(opts.body);
    expect(body.categories).toEqual(["samples", "food"]);
  });
});

describe("alerts", () => {
  it("createAlert POSTs to /alerts", async () => {
    mockFetch.mockResolvedValue(okJson({ status: "alert_created" }));
    await createAlert("a@b.com", "coffee");
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/alerts");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body).keyword).toBe("coffee");
  });

  it("listAlerts GETs with encoded email", async () => {
    mockFetch.mockResolvedValue(okJson({ alerts: [] }));
    await listAlerts("a@b.com");
    expect(mockFetch.mock.calls[0][0]).toContain("/alerts?email=a%40b.com");
  });

  it("deleteAlert sends DELETE", async () => {
    mockFetch.mockResolvedValue(okJson({ status: "alert_deleted" }));
    await deleteAlert("a@b.com", "coffee");
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe("DELETE");
  });
});
