import { describe, it, expect } from "vitest";
import { itemKeys } from "../items";
import { itemPhotoKeys } from "../itemPhotos";

describe("itemKeys factory", () => {
  it("all equals ['items']", () => {
    expect(itemKeys.all).toEqual(["items"]);
  });

  it("lists() equals ['items', 'list']", () => {
    expect(itemKeys.lists()).toEqual(["items", "list"]);
  });

  it("list(params) equals ['items', 'list', params]", () => {
    expect(itemKeys.list({ page: 1 })).toEqual(["items", "list", { page: 1 }]);
  });

  it("details() equals ['items', 'detail']", () => {
    expect(itemKeys.details()).toEqual(["items", "detail"]);
  });

  it("detail(id) equals ['items', 'detail', id]", () => {
    expect(itemKeys.detail("abc")).toEqual(["items", "detail", "abc"]);
  });
});

describe("itemPhotoKeys factory", () => {
  it("all equals ['itemPhotos']", () => {
    expect(itemPhotoKeys.all).toEqual(["itemPhotos"]);
  });

  it("lists() equals ['itemPhotos', 'list']", () => {
    expect(itemPhotoKeys.lists()).toEqual(["itemPhotos", "list"]);
  });

  it("list(itemId) equals ['itemPhotos', 'list', itemId]", () => {
    expect(itemPhotoKeys.list("item-1")).toEqual(["itemPhotos", "list", "item-1"]);
  });

  it("details() equals ['itemPhotos', 'detail']", () => {
    expect(itemPhotoKeys.details()).toEqual(["itemPhotos", "detail"]);
  });

  it("detail(id) equals ['itemPhotos', 'detail', id]", () => {
    expect(itemPhotoKeys.detail("photo-abc")).toEqual(["itemPhotos", "detail", "photo-abc"]);
  });
});
