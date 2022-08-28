import fs from "fs";
import assert from "assert";

import method from "../src/index.mjs";

const config = {
  projectId: process.env.INFURA_PROJECT_ID,
  projectSecret: process.env.INFURA_PROJECT_SECRET,
  host: process.env.INFURA_HOST,
  port: process.env.INFURA_PORT,
  protocol: process.env.INFURA_PROTOCOL,
  apiPath: process.env.INFURA_API_PATH,
};

const currentTestVectors = JSON.parse(
  fs.readFileSync("./data/test-vectors.json").toString()
);

describe("herd privacy", () => {
  it("patch URLs can contain fragments", async () => {
    const base = {
      patches: [
        "https://a.example/patches/0",
        "https://b.example/patches/1#0",
        "https://c.example/patches/2#2",
      ],
    };
    const did = method.create({
      ...config,
      // simulate client side filtering on patches by fragment id
      documentLoader: (iri) => {
        if (iri === "https://a.example/patches/0") {
          return { document: currentTestVectors.patches[0] };
        }
        if (iri === "https://b.example/patches/1#0") {
          return { document: currentTestVectors.patches[1] };
        }
        if (iri === "https://c.example/patches/2#2") {
          return { document: currentTestVectors.patches[1] };
        }
        const message = "Unsuported IRI " + iri;
        throw new Error(message);
      },
    });
    const id = await did.operations.create(base, { ipfs: false });
    const { didDocument, didDocumentMetadata } = await did.operations.resolve(
      id,
      {
        accept: "application/did+json",
      }
    );
    assert(didDocument.id === id);
    assert.deepEqual(didDocumentMetadata, {
      valid: true,
      disputed: false,
      deactivated: false,
      immutable: false,
    });
  });
});
