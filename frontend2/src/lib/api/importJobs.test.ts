import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importJobsApi } from "./importJobs";

// Phase 14 Plan 05 Task 1 — importJobsApi unit tests. Stub `global.fetch`
// directly (mirrors photos.test.ts) so we can assert: the jobs envelope key is
// `jobs` (NOT items/changes); the errors envelope; and that uploadImport POSTs
// MULTIPART (FormData with `entity_type` + a `file` part) to /imports/upload —
// the async importjob path that creates the job feeding the history table. NO
// base64 — multipart carries raw bytes.

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const JOB = {
  id: "job-1",
  entity_type: "items",
  status: "completed",
  file_name: "items.csv",
  file_size_bytes: 1234,
  total_rows: 10,
  processed_rows: 10,
  success_count: 9,
  error_count: 1,
  progress: 100,
  created_at: "2026-06-13T00:00:00Z",
  completed_at: "2026-06-13T00:01:00Z",
};

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("importJobsApi.listJobs", () => {
  it("requests /imports/jobs and resolves the bare `jobs` envelope (NOT items/changes)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ jobs: [JOB], total: 1, page: 1, total_pages: 1 }),
    );

    const res = await importJobsApi.listJobs("ws-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/imports/jobs");
    expect((init as RequestInit).method).toBe("GET");
    expect(Array.isArray(res.jobs)).toBe(true);
    expect(res.jobs[0].id).toBe("job-1");
    expect(res.total).toBe(1);
  });

  it("forwards page + limit query params when given", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ jobs: [], total: 0, page: 2, total_pages: 0 }),
    );
    await importJobsApi.listJobs("ws-1", { page: 2, limit: 50 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("limit=50");
  });
});

describe("importJobsApi.jobErrors", () => {
  it("requests /imports/jobs/{id}/errors and resolves the `errors` envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errors: [
          {
            id: "e-1",
            row_number: 3,
            field_name: "sku",
            error_message: "duplicate sku",
            created_at: "2026-06-13T00:00:00Z",
          },
        ],
        total: 1,
      }),
    );

    const res = await importJobsApi.jobErrors("ws-1", "job-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/imports/jobs/job-1/errors");
    expect(res.errors[0].error_message).toBe("duplicate sku");
    expect(res.total).toBe(1);
  });
});

describe("importJobsApi.uploadImport", () => {
  it("POSTs multipart /imports/upload with entity_type + file, returning the created job", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(JOB, 201));
    const file = new File(["sku,name\n1,Drill"], "items.csv", {
      type: "text/csv",
    });

    const job = await importJobsApi.uploadImport("ws-1", "items", file);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/imports/upload");
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as RequestInit).body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("entity_type")).toBe("items");
    expect(body.get("file")).toBeInstanceOf(File);
    // No JSON Content-Type header — the browser sets the multipart boundary.
    const headers = (init as RequestInit).headers as
      | Record<string, string>
      | undefined;
    expect(headers?.["Content-Type"]).toBeUndefined();
    expect(job.id).toBe("job-1");
    expect(job.entity_type).toBe("items");
  });

  it("throws on a non-2xx upload response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: "forbidden" }, 403),
    );
    const file = new File(["x"], "items.csv", { type: "text/csv" });
    await expect(
      importJobsApi.uploadImport("ws-1", "items", file),
    ).rejects.toThrow();
  });
});
