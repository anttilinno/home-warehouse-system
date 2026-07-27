import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/api";
import { formErrorMessage } from "./formError";

describe("formErrorMessage", () => {
  it("shows the backend detail for a 4xx (duplicate short code)", () => {
    const err = new HttpError(400, "short code already exists");
    expect(formErrorMessage(err, "Couldn't save this location.")).toBe(
      "short code already exists",
    );
  });

  it("falls back for a 5xx", () => {
    const err = new HttpError(500, "sql: connection refused");
    expect(formErrorMessage(err, "Couldn't save this location.")).toBe(
      "Couldn't save this location.",
    );
  });

  it("falls back for a non-HTTP error (offline / parse failure)", () => {
    expect(formErrorMessage(new TypeError("Failed to fetch"), "fallback")).toBe(
      "fallback",
    );
  });
});
