import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMediaOwnerRef } from "../lib/media-ownership";

/**
 * P0.2 — media path ownership parsing. The media route resolves every request
 * through this parser before touching the filesystem; unrecognised shapes are
 * served as 404, never as "public" files.
 */

describe("parseMediaOwnerRef", () => {
  it("attributes rendition paths to their asset", () => {
    assert.deepEqual(parseMediaOwnerRef("renditions/asset-1/thumbnail.webp"), {
      kind: "asset",
      assetId: "asset-1",
    });
  });

  it("attributes direct-upload object keys to their asset", () => {
    assert.deepEqual(parseMediaOwnerRef("assets/asset-2/design final.png"), {
      kind: "asset",
      assetId: "asset-2",
    });
  });

  it("attributes root-level originals to their version id prefix", () => {
    assert.deepEqual(parseMediaOwnerRef("ver-asset-3-1-hero.png"), {
      kind: "version",
      fileBase: "ver-asset-3-1-hero.png",
    });
  });

  it("normalizes backslashes and leading slashes", () => {
    assert.deepEqual(parseMediaOwnerRef("\\renditions\\asset-9\\preview.webp"), {
      kind: "asset",
      assetId: "asset-9",
    });
    assert.deepEqual(parseMediaOwnerRef("/renditions/asset-9/preview.webp"), {
      kind: "asset",
      assetId: "asset-9",
    });
  });

  it("rejects empty and id-less paths", () => {
    assert.equal(parseMediaOwnerRef(""), null);
    assert.equal(parseMediaOwnerRef("/"), null);
    assert.equal(parseMediaOwnerRef("renditions/"), null);
    assert.equal(parseMediaOwnerRef("assets"), null);
  });
});
