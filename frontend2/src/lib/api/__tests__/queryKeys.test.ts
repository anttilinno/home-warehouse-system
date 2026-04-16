import { describe, it, expect } from "vitest";
import { itemKeys } from "../items";
import { itemPhotoKeys } from "../itemPhotos";
import { loanKeys } from "../loans";
import { borrowerKeys } from "../borrowers";
import { categoryKeys } from "../categories";
import { locationKeys } from "../locations";
import { containerKeys } from "../containers";

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

describe("itemKeys.list with Phase 60 params", () => {
  it("discriminates by search param", () => {
    expect(itemKeys.list({ search: "a" })).not.toEqual(itemKeys.list({ search: "b" }));
  });

  it("discriminates by archived flag", () => {
    expect(itemKeys.list({ archived: true })).not.toEqual(itemKeys.list({ archived: false }));
  });

  it("discriminates by category_id", () => {
    expect(itemKeys.list({ category_id: "aaa" })).not.toEqual(
      itemKeys.list({ category_id: "bbb" }),
    );
  });

  it("discriminates by sort + sort_dir combo", () => {
    expect(itemKeys.list({ sort: "name", sort_dir: "asc" })).not.toEqual(
      itemKeys.list({ sort: "name", sort_dir: "desc" }),
    );
    expect(itemKeys.list({ sort: "name", sort_dir: "asc" })).not.toEqual(
      itemKeys.list({ sort: "created_at", sort_dir: "asc" }),
    );
  });

  it("full-filter key is deeply equal to an identical reconstruction", () => {
    const params = {
      page: 2,
      limit: 25,
      search: "drill",
      category_id: "cat-1",
      archived: true,
      sort: "updated_at" as const,
      sort_dir: "desc" as const,
    };
    expect(itemKeys.list(params)).toEqual(itemKeys.list({ ...params }));
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

describe("loanKeys factory", () => {
  it("all equals ['loans']", () => {
    expect(loanKeys.all).toEqual(["loans"]);
  });

  it("lists() equals ['loans', 'list']", () => {
    expect(loanKeys.lists()).toEqual(["loans", "list"]);
  });

  it("list(params) equals ['loans', 'list', params]", () => {
    expect(loanKeys.list({ active: true })).toEqual(["loans", "list", { active: true }]);
  });

  it("details() equals ['loans', 'detail']", () => {
    expect(loanKeys.details()).toEqual(["loans", "detail"]);
  });

  it("detail(id) equals ['loans', 'detail', id]", () => {
    expect(loanKeys.detail("loan-1")).toEqual(["loans", "detail", "loan-1"]);
  });
});

describe("borrowerKeys factory", () => {
  it("all equals ['borrowers']", () => {
    expect(borrowerKeys.all).toEqual(["borrowers"]);
  });

  it("lists() equals ['borrowers', 'list']", () => {
    expect(borrowerKeys.lists()).toEqual(["borrowers", "list"]);
  });

  it("list(params) equals ['borrowers', 'list', params]", () => {
    expect(borrowerKeys.list({})).toEqual(["borrowers", "list", {}]);
  });

  it("details() equals ['borrowers', 'detail']", () => {
    expect(borrowerKeys.details()).toEqual(["borrowers", "detail"]);
  });

  it("detail(id) equals ['borrowers', 'detail', id]", () => {
    expect(borrowerKeys.detail("borrower-1")).toEqual(["borrowers", "detail", "borrower-1"]);
  });

  it("list distinguishes archived filter from default (active-only)", () => {
    const active = borrowerKeys.list({ page: 1, limit: 100 });
    const all = borrowerKeys.list({ page: 1, limit: 100, archived: true });
    expect(active).not.toEqual(all);
  });
});

describe("categoryKeys factory", () => {
  it("all equals ['categories']", () => {
    expect(categoryKeys.all).toEqual(["categories"]);
  });

  it("lists() equals ['categories', 'list']", () => {
    expect(categoryKeys.lists()).toEqual(["categories", "list"]);
  });

  it("list(params) equals ['categories', 'list', params]", () => {
    expect(categoryKeys.list({})).toEqual(["categories", "list", {}]);
  });

  it("details() equals ['categories', 'detail']", () => {
    expect(categoryKeys.details()).toEqual(["categories", "detail"]);
  });

  it("detail(id) equals ['categories', 'detail', id]", () => {
    expect(categoryKeys.detail("cat-1")).toEqual(["categories", "detail", "cat-1"]);
  });
});

describe("locationKeys factory", () => {
  it("all equals ['locations']", () => {
    expect(locationKeys.all).toEqual(["locations"]);
  });

  it("lists() equals ['locations', 'list']", () => {
    expect(locationKeys.lists()).toEqual(["locations", "list"]);
  });

  it("list(params) equals ['locations', 'list', params]", () => {
    expect(locationKeys.list({})).toEqual(["locations", "list", {}]);
  });

  it("details() equals ['locations', 'detail']", () => {
    expect(locationKeys.details()).toEqual(["locations", "detail"]);
  });

  it("detail(id) equals ['locations', 'detail', id]", () => {
    expect(locationKeys.detail("loc-1")).toEqual(["locations", "detail", "loc-1"]);
  });
});

describe("containerKeys factory", () => {
  it("all equals ['containers']", () => {
    expect(containerKeys.all).toEqual(["containers"]);
  });

  it("lists() equals ['containers', 'list']", () => {
    expect(containerKeys.lists()).toEqual(["containers", "list"]);
  });

  it("list(params) equals ['containers', 'list', params]", () => {
    expect(containerKeys.list({})).toEqual(["containers", "list", {}]);
  });

  it("details() equals ['containers', 'detail']", () => {
    expect(containerKeys.details()).toEqual(["containers", "detail"]);
  });

  it("detail(id) equals ['containers', 'detail', id]", () => {
    expect(containerKeys.detail("cont-1")).toEqual(["containers", "detail", "cont-1"]);
  });
});
