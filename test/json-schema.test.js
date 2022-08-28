import fs from "fs";

import assert from "assert";
import method from "../src/index.mjs";
const currentTestVectors = JSON.parse(
  fs.readFileSync("./data/test-vectors.json").toString()
);

describe("json schema", () => {
  describe("valid", () => {
    it("empty", async () => {
      const valid = method.utils.validateDidDocument({ id: "did:example:123" });
      assert.equal(valid, true);
    });
  });

  describe("invalid", () => {
    it("verification method missing controller", async () => {
      const validDidDocument = currentTestVectors.resolutions[1].didDocument;
      const invalidDidDocument = JSON.parse(JSON.stringify(validDidDocument));
      delete invalidDidDocument.verificationMethod[0].controller;
      const valid = method.utils.validateDidDocument(invalidDidDocument);
      assert.equal(valid, false);
    });
  });
});
