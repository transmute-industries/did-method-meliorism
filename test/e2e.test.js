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

const REGENERATE_TEST_VECTORS = true;

const testVectors = {
  keys: [],
  documents: [],
  identifiers: [],
  patches: [],
  resolutions: [],
};

const currentTestVectors = JSON.parse(
  fs.readFileSync("./data/test-vectors.json").toString()
);

describe(method.name, () => {
  describe(`.utils`, () => {
    describe(`#generateKey`, () => {
      const supportedKeyTypes = ["EdDSA"];
      supportedKeyTypes.forEach((keyType) => {
        it(keyType, async () => {
          const vm = await method.utils.generateKey(keyType);
          testVectors.keys.push(vm);
        });
      });
    });

    describe(`.patches`, () => {
      describe(`#addVerificationMethod`, () => {
        currentTestVectors.keys.forEach((tvk) => {
          it(tvk.publicKeyJwk.crv, async () => {
            const patchKey = tvk;
            const jws = await method.utils.patches.addVerificationMethod(
              {
                id: "#key-0",
                type: "JsonWebKey2020",
                controller:
                  "did:meliorism:QmPNzsLMBsz36Bhi13B2KaWNWexdoofaZKVrEbmvsLzmiA",
                publicKeyJwk: patchKey.publicKeyJwk,
              },
              [
                "authentication",
                "assertionMethod",
                "capabilityInvocation",
                "capabilityDelegation",
                "keyAgreement",
              ],
              patchKey.privateKeyJwk
            );
            testVectors.patches.push(jws);
          });
        });
      });
      describe(`#addNothing`, () => {
        currentTestVectors.keys.forEach((tvk) => {
          it(tvk.publicKeyJwk.crv, async () => {
            const patchKey = tvk;
            const jws = await method.utils.patches.addNothing(
              patchKey.privateKeyJwk
            );
            testVectors.patches.push(jws);
          });
        });
      });
    });
  });

  describe(`.operations`, () => {
    describe(`#create`, () => {
      it("should publish to ipfs", async () => {
        const did = method.create(config);
        const document = {
          patches: [
            "https://a.example/patches/0",
            "https://b.example/patches/1",
            "https://c.example/patches/2",
          ],
        };
        testVectors.documents.push(document);
        const id = await did.operations.create(document);
        testVectors.identifiers.push(id);
        assert.deepEqual(currentTestVectors.identifiers[0], id);
      });

      it("should encode json", async () => {
        const did = method.create(config);
        const document = {
          patches: [
            "https://a.example/patches/0",
            "https://b.example/patches/1",
            "https://c.example/patches/2",
          ],
        };
        testVectors.documents.push(document);
        const id = await did.operations.create(document, { ipfs: false });
        testVectors.identifiers.push(id);
        assert.deepEqual(currentTestVectors.identifiers[1], id);
      });
    });
    describe(`#resolve`, () => {
      it("should resolve from ipfs", async () => {
        const did = method.create(config);
        const { didDocument, didDocumentMetadata } =
          await did.operations.resolve(testVectors.identifiers[0], {
            accept: "application/did+json",
          });
        assert(didDocument.id === testVectors.identifiers[0]);
        assert.deepEqual(didDocumentMetadata, {
          valid: true,
          deactivated: true,
          immutable: false,
          disputed: true,
        });
      });

      it("deactivated", async () => {
        const did = method.create({
          ...config,
          // simulate deactivated
          documentLoader: (iri) => {
            if (iri.startsWith("ipfs://")) {
              return { document: testVectors.documents[0] };
            }
            const message = "Unsuported IRI " + iri;
            throw new Error(message);
          },
        });
        const { didDocument, didDocumentMetadata } =
          await did.operations.resolve(testVectors.identifiers[0], {
            accept: "application/did+json",
          });
        assert(didDocument.id === testVectors.identifiers[0]);
        assert.deepEqual(didDocumentMetadata, {
          valid: true,
          deactivated: true,
          immutable: false,
          disputed: true,
        });
        testVectors.resolutions.push({ didDocument, didDocumentMetadata });
      });

      it("disputed", async () => {
        const did = method.create({
          ...config,
          // simulate disputed
          documentLoader: (iri) => {
            if (iri.startsWith("ipfs://")) {
              return { document: testVectors.documents[0] };
            }
            if (iri === "https://a.example/patches/0") {
              return { document: testVectors.patches[0] };
            }
            const message = "Unsuported IRI " + iri;
            throw new Error(message);
          },
        });
        const { didDocument, didDocumentMetadata } =
          await did.operations.resolve(testVectors.identifiers[0], {
            accept: "application/did+json",
          });
        assert(didDocument.id === testVectors.identifiers[0]);
        assert.deepEqual(didDocumentMetadata, {
          valid: true,
          disputed: true,
          immutable: false,
          deactivated: false,
        });
        testVectors.resolutions.push({ didDocument, didDocumentMetadata });
      });

      it("undisputed", async () => {
        const did = method.create({
          ...config,
          // simulate undisputed
          documentLoader: (iri) => {
            if (iri.startsWith("ipfs://")) {
              return { document: testVectors.documents[0] };
            }
            if (["https://a.example/patches/0"].includes(iri)) {
              return { document: testVectors.patches[0] };
            }
            if (
              [
                "https://b.example/patches/1",
                "https://c.example/patches/2",
              ].includes(iri)
            ) {
              return { document: testVectors.patches[1] };
            }
            const message = "Unsuported IRI " + iri;
            throw new Error(message);
          },
        });
        const { didDocument, didDocumentMetadata } =
          await did.operations.resolve(testVectors.identifiers[0], {
            accept: "application/did+json",
          });
        assert(didDocument.id === testVectors.identifiers[0]);
        assert.deepEqual(didDocumentMetadata, {
          valid: true,
          immutable: false,
          disputed: false,
          deactivated: false,
        });
        testVectors.resolutions.push({ didDocument, didDocumentMetadata });
      });
    });

    describe(`#update`, () => {
      it("should reflect availability and agreement of json patches", async () => {
        const resolutionBeforeUpdate = await method
          .create({
            ...config,
            // simulate deactivated
            documentLoader: (iri) => {
              if (iri.startsWith("ipfs://")) {
                return { document: testVectors.documents[0] };
              }
              const message = "Unsuported IRI " + iri;
              throw new Error(message);
            },
          })
          .operations.resolve(testVectors.identifiers[0], {
            accept: "application/did+json",
          });
        assert.deepEqual(resolutionBeforeUpdate.didDocumentMetadata, {
          valid: true,
          immutable: false,
          deactivated: true,
          disputed: true,
        });

        const resolutionAfterUpdate = await method
          .create({
            ...config,
            // simulate activated
            documentLoader: (iri) => {
              if (iri.startsWith("ipfs://")) {
                return { document: testVectors.documents[0] };
              }
              if (["https://a.example/patches/0"].includes(iri)) {
                return { document: testVectors.patches[0] };
              }
              if (
                [
                  "https://b.example/patches/1",
                  "https://c.example/patches/2",
                ].includes(iri)
              ) {
                return { document: testVectors.patches[1] };
              }
              const message = "Unsuported IRI " + iri;
              throw new Error(message);
            },
          })
          .operations.resolve(testVectors.identifiers[0], {
            accept: "application/did+json",
          });
        assert.deepEqual(resolutionAfterUpdate.didDocumentMetadata, {
          valid: true,
          immutable: false,
          deactivated: false,
          disputed: false,
        });
      });
    });

    describe(`#deactivate`, () => {
      it("should reflect no available patches", async () => {
        const did = method.create({
          ...config,
          // simulate deactivated
          documentLoader: (iri) => {
            if (iri.startsWith("ipfs://")) {
              return { document: testVectors.documents[0] };
            }
            const message = "Unsuported IRI " + iri;
            throw new Error(message);
          },
        });
        const { didDocument, didDocumentMetadata } =
          await did.operations.resolve(testVectors.identifiers[0], {
            accept: "application/did+json",
          });
        assert(didDocument.id === testVectors.identifiers[0]);
        assert.deepEqual(didDocumentMetadata, {
          valid: true,
          immutable: false,
          deactivated: true,
          disputed: true,
        });
      });
    });
  });

  describe(`#generateTestVectors`, () => {
    it("should write test vectors to source control", async () => {
      if (REGENERATE_TEST_VECTORS) {
        fs.writeFileSync(
          "./data/test-vectors.json",
          JSON.stringify(testVectors, null, 2)
        );
      }
    });
  });
});
