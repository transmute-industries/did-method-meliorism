import * as jose from "jose";
import * as jsonpatch from "fast-json-patch/index.mjs";
import * as ipfs from "ipfs-http-client";
import base64url from "base64url";
import Ajv from "ajv";
const methodPrefix = "did:meliorism";

const methodContext = [
  "https://www.w3.org/ns/did/v1",
  { "@vocab": "https://vocab.example#" },
];

const patchContentType = "application/json-patch+json";

const patchVocabularyType = "SignedIetfJsonPatch";

const methodBaseDidDocument = {
  verificationMethod: [],
  authentication: [],
  assertionMethod: [],
  capabilityInvocation: [],
  capabilityDelegation: [],
  keyAgreement: [],
  service: [],
};

const ajv = new Ajv();

const didDocumentSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    verificationMethod: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          controller: { type: "string" },
        },
        required: ["id", "type", "controller"],
        additionalProperties: true,
      },
    },
  },

  required: ["id"],
  additionalProperties: true,
};

const validateDidDocument = ajv.compile(didDocumentSchema);

const createIpfsClient = (config) => {
  const { host, port, protocol, apiPath, projectId, projectSecret } = config;

  let auth = undefined;

  if (projectId && projectSecret) {
    auth =
      "Basic " +
      Buffer.from(projectId + ":" + projectSecret).toString("base64");
  }

  const client = ipfs.create({
    host,
    port,
    protocol,
    apiPath,
    headers: {
      authorization: auth,
    },
  });
  return client;
};

const jwkToAlg = (jwk) => {
  if (jwk.kty === "RSA") {
    throw new Error(`RSA is not supported by ${methodPrefix}.`);
  }

  if (jwk.kty === "EC" && jwk.crv === "P-256") {
    return "ES256";
  }

  if (jwk.kty === "OKP" && jwk.crv === "Ed25519") {
    return "EdDSA";
  }
};

const sign = async (payload, privateKeyJwk) => {
  const alg = jwkToAlg(privateKeyJwk);

  const { d, ...publicKeyJwk } = privateKeyJwk;

  const jws = await new jose.CompactSign(
    new TextEncoder().encode(JSON.stringify(payload))
  )
    .setProtectedHeader({
      jwk: publicKeyJwk,
      alg,
      cty: patchContentType,
    })
    .sign(await jose.importJWK(privateKeyJwk, alg));
  return jws;
};

const verify = async (jws, publicKeyJwk) => {
  const alg = jwkToAlg(publicKeyJwk);
  const { payload, protectedHeader } = await jose.compactVerify(
    jws,
    await jose.importJWK(publicKeyJwk, alg)
  );

  return { payload, protectedHeader };
};

// find the key used to sign the most resolvable patches
// group patches concurring and dissenting with this key.
const getIdentifierPatchConsensus = async (resolvablePatches) => {
  const verifiedPatches = await Promise.all(
    resolvablePatches
      .map(async ({ patch, document }) => {
        const jws = document;
        const [encodedHeader] = jws.split(".");
        const decodedHeader = JSON.parse(Buffer.from(encodedHeader, "base64"));
        const kid = await jose.calculateJwkThumbprint(
          decodedHeader.jwk,
          "sha256"
        );
        const { payload, protectedHeader } = await verify(
          jws,
          decodedHeader.jwk
        );
        if (protectedHeader.alg === decodedHeader.alg) {
          return {
            patch,
            kid,
            jwk: decodedHeader.jwk,
            payload: JSON.parse(payload.toString()),
          };
        }
      })
      .filter((log) => {
        return log !== undefined;
      })
  );
  const verificationsPerKid = verifiedPatches.reduce(function (counts, patch) {
    if (counts[patch.kid]) {
      counts[patch.kid]++;
    } else {
      counts[patch.kid] = 1;
    }
    return counts;
  }, {});

  const [majorityKid] = Object.entries(verificationsPerKid).sort(
    (x, y) => y[1] - x[1]
  )[0];
  const concurring = verifiedPatches.filter((p) => {
    return p.kid === majorityKid;
  });
  const dissenting = verifiedPatches.filter((p) => {
    return p.kid !== majorityKid;
  });
  const mapper = (p) => {
    return { uri: p.patch, patch: p.payload };
  };
  return {
    kid: majorityKid,
    concurring: concurring.map(mapper),
    dissenting: dissenting.map(mapper),
  };
};

const generateKey = async (alg, options = { controller: false }) => {
  const k = await jose.generateKeyPair(alg);
  const publicKeyJwk = await jose.exportJWK(k.publicKey);
  const privateKeyJwk = await jose.exportJWK(k.privateKey);
  const thumbprint = await jose.calculateJwkThumbprint(publicKeyJwk, "sha256");
  const id = `urn:ietf:params:oauth:jwk-thumbprint:sha-256:${thumbprint}`;
  const keyPair = {
    id,
    type: "JsonWebKey2020",
    controller: id,
    publicKeyJwk: {
      kty: publicKeyJwk.kty,
      crv: publicKeyJwk.crv,
      alg,
      x: publicKeyJwk.x,
      y: publicKeyJwk.y,
    },
    privateKeyJwk: {
      kty: privateKeyJwk.kty,
      crv: privateKeyJwk.crv,
      alg,
      x: privateKeyJwk.x,
      y: privateKeyJwk.y,
      d: privateKeyJwk.d,
    },
  };

  if (!options.controller) {
    delete keyPair.controller;
    keyPair.id = `#${thumbprint}`;
  }

  return keyPair;
};

const addVerificationMethod = async (
  verificationMethod,
  relationships,
  privateKeyJwk
) => {
  delete verificationMethod.privateKeyJwk;
  const baseDidDocument = JSON.parse(JSON.stringify(methodBaseDidDocument));
  const observer = jsonpatch.observe(baseDidDocument);
  baseDidDocument.verificationMethod.push(verificationMethod);
  relationships.forEach((vmr) => {
    baseDidDocument[vmr].push(verificationMethod.id);
  });
  const patch = jsonpatch.generate(observer);
  const jws = await sign(patch, privateKeyJwk);
  return jws;
};

const addNothing = async (privateKeyJwk) => {
  const jws = await sign([], privateKeyJwk);
  return jws;
};

const createPatchService = (id, serviceEndpoint, revoked) => {
  return JSON.parse(
    JSON.stringify({
      id,
      type: patchVocabularyType,
      revoked,
      serviceEndpoint,
    })
  );
};

// controller is required property of verification methods
// when its absent, set it to the didDocument.id
const ensureController = (didDocument) => {
  const verificationMethods = [];
  didDocument.verificationMethod.forEach((vm) => {
    if (!vm.controller) {
      vm.controller = didDocument.id;
    }
    const { id, type, controller, ...rest } = vm;
    verificationMethods.push({
      id,
      type,
      controller,
      ...rest,
    });
  });
  didDocument.verificationMethod = verificationMethods;
};

const resolveIdentifier = async ({ id, config }) => {
  let base = undefined;

  const contentId = id.split(":").pop();

  if (contentId.startsWith("ey")) {
    base = getBaseFromIdentifier(contentId);
  } else {
    ({ document: base } = await config.documentLoader(`ipfs://${contentId}`));
  }

  let didDocument = JSON.parse(JSON.stringify(methodBaseDidDocument));

  const resolvablePatches = [];
  const unresolvableServices = [];

  for (const patch of base.patches) {
    try {
      const { document } = await config.documentLoader(patch);

      resolvablePatches.push({ patch, document });
    } catch (e) {
      unresolvableServices.push(
        createPatchService("#" + base.patches.indexOf(patch), patch, true)
      );
    }
  }

  if (resolvablePatches.length) {
    const consensus = await getIdentifierPatchConsensus(resolvablePatches);
    consensus.concurring.forEach((d) => {
      didDocument.service.push(
        createPatchService("#" + base.patches.indexOf(d.uri), d.uri, undefined)
      );
      didDocument = jsonpatch.applyPatch(didDocument, d.patch).newDocument;
    });

    consensus.dissenting.forEach((d) => {
      didDocument.service.push(
        createPatchService("#" + base.patches.indexOf(d.uri), d.uri, true)
      );
    });
  }

  didDocument.service = [...didDocument.service, ...unresolvableServices];

  // order object.
  const {
    alsoKnownAs,
    verificationMethod,
    authentication,
    assertionMethod,
    capabilityDelegation,
    capabilityInvocation,
    keyAgreement,
    service,
    ...rest
  } = didDocument;

  didDocument = JSON.parse(
    JSON.stringify({
      "@context": methodContext,
      id,
      alsoKnownAs,
      verificationMethod,
      authentication,
      assertionMethod,
      capabilityDelegation,
      capabilityInvocation,
      keyAgreement,
      service,
      ...rest, // arbitrary json allowed... at the end.
    })
  );

  ensureController(didDocument);

  // TODO: consider injecting IPFS network / HTTPs network meta data here.
  const didDocumentMetadata = {
    valid: validateDidDocument(didDocument),
    disputed: didDocument.service.some((s) => {
      return s.revoked === true;
    }),
    immutable: didDocument.service.every((s) => {
      return (
        s.serviceEndpoint.startsWith("ipfs://") ||
        s.serviceEndpoint.startsWith("data:application/jose,")
      );
    }),
    deactivated: didDocument.service.every((s) => {
      return s.revoked === true;
    }),
  };

  return {
    didDocument,
    didDocumentMetadata,
  };
};

const getBaseFromIdentifier = (id) => {
  return JSON.parse(base64url.decode(id));
};

const encodeBaseDocumentAsIdentifier = (base) => {
  return base64url.encode(JSON.stringify(base));
};

class DIDMethodClient {
  constructor(config) {
    this.ipfs = {};
    this.ipfs.get = async (cid) => {
      const client = await createIpfsClient(config);
      const results = await client.cat(cid);
      const documents = [];
      for await (const item of results) {
        const raw = Buffer.from(item).toString("utf8");
        const parsed = JSON.parse(raw);
        documents.push(parsed);
      }
      return documents.length === 1 ? documents[0] : null;
    };

    this.ipfs.set = async (doc) => {
      const client = await createIpfsClient(config);
      const { cid } = await client.add(JSON.stringify(doc));
      const contendId = cid.toString();
      return contendId;
    };

    if (!config.documentLoader) {
      config.documentLoader = async (iri) => {
        if (iri.startsWith("ipfs://")) {
          const contentId = iri.replace("ipfs://", "").split("#")[0];
          const fragment = iri.split("#")[1];
          const patchIndex = fragment ? parseInt(fragment) : 0;
          const content = await this.ipfs.get(contentId);
          const signedPatch = Array.isArray(content)
            ? content[patchIndex]
            : content;

          return {
            document: signedPatch,
          };
        }

        if (iri.startsWith("data:application/jose,")) {
          const jws = iri.replace("data:application/jose,", "");
          const signedPatch = jws;
          return {
            document: signedPatch,
          };
        }
        const message = "Unsuported IRI " + iri;
        throw new Error(message);
      };
    }

    this.operations = {
      create: async (document, options = { ipfs: true }) => {
        if (options.ipfs) {
          const contendId = await this.ipfs.set(document);
          return `${methodPrefix}:${contendId}`;
        } else {
          const encodedBase = encodeBaseDocumentAsIdentifier(document);
          return `${methodPrefix}:${encodedBase}`;
        }
      },
      resolve: async (identifier, options) => {
        if (options.accept !== "application/did+json") {
          throw new Error(
            "Representation not supported. See https://w3c.github.io/did-spec-registries/#representationnotsupported."
          );
        }
        return resolveIdentifier({ id: identifier, config });
      },
    };
  }
}

const patches = {
  addVerificationMethod,
  addNothing,
};

const utils = {
  generateKey,
  patches,
  validateDidDocument,
};

const method = {
  name: methodPrefix,
  utils,
  create: (config) => {
    return new DIDMethodClient(config);
  },
};

export default method;
