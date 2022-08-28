%%%
title = "Meliorism DID Method"
abbrev = "did-meliorism"
ipr= "none"
area = "Internet"
workgroup = "none"
submissiontype = "IETF"
keyword = [""]

[seriesInfo]
name = "Individual-Draft"
value = "example-spec-00"
status = "informational"

[[author]]
initials = "O."
surname = "Steele"
fullname = "Orie Steele"
#role = "editor"
organization = "Transmute"
[author.address]
email = "orie@transmute.industries"

%%%

.# Abstract

This specification defines Meliorism (did:meliorism),
a Decentralized Identifier Method (DIM), conforming to [@!DID-CORE].
Decentralized Identifiers are useful building blocks for privacy, reputation,
permission and knowledge management systems.

This document is under development, if you would like to contribute,
please visit: [github.com/transmute-industries/did-method-meliorism](https://github.com/transmute-industries/did-method-meliorism).

{mainmatter}

# Introduction

Decentralized Identifiers and Decentralized Identifier URLs
provide a mechanism for discovering relationships and capabilities
associated with identifiers that are derived from cryptographic operations.

Goals for this specification do not include representing new kinds of
cryptographic keys, certificate chains, representing new kinds of certified keys or
replacing X.509 certificates.

This specification relies on [@!RFC2397], [@!RFC6902], [@!RFC7515], [@!RFC7517], [@!RFC7638] and IANA registries
established by those specifications.

# Notational Conventions

The keywords **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**,
**SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL**, when they appear in this
document, are to be interpreted as described in [@!RFC2119].

# Terminology

## JWS

A JSON Web Signature as described in [@!RFC7515].

## JWK

A JSON Web Key as described in [@!RFC7517].

## Patch

A JSON Patch as described in [@!RFC6902]

## Signed Patch

A JWS where the payload is a JSON Patch as described in [@!RFC6902], and the decoded header looks like this:

```json
{
  "jwk": {
    "kty": "OKP",
    "crv": "Ed25519",
    "alg": "EdDSA",
    "x": "hdw9kDgv57oWdkGi1YIqdc18vYXHLMIdFZVJNv1Uzf4"
  },
  "alg": "EdDSA",
  "cty": "application/json-patch+json"
}
```

## Patch URI

A URI that resolves to either a Signed Patch or a JSON encoded array of Signed Patches.

The Patch URI Scheme MUST be either `data`, `https` or `ipfs`,

## Primary Identifier Key

The JWK that verifies the majority of the JWS encoded Patches.
The primary identifier key's `kid` computed according [@!RFC7638] is referred to as the `majority key identifier`.

## Majority Key Identifier

The primary identifier key's `kid` computed according [@!RFC7638].

## DID Controller

The entity responsible for managing the latest content of the DID Document.

See [W3C DID Controller](https://www.w3.org/TR/did-core/#did-controller).

## DID Subject

The entity identified by the DID.

It is common in custodial systems for the DID Controller to be a party trusted by the DID Subject.

It is common in non-custodial systems for the DID Subject to be the DID Controller.

See [W3C DID Subject](https://www.w3.org/TR/did-core/#did-subject).

## Trust Anchors

The entities responsible for the availability of a [Patch URI](#name-patch-uri).

In the case of content schemes such as `data` this is the content itself.

In the case of content addressing schemes such as `ipfs`, this is the network of honest nodes.

In the case of `https` scheme, this is the authority.

A trust anchor might provide services for multiple DID Controllers.

The [W3C Verifiable Data Registry](https://www.w3.org/TR/did-core/#dfn-verifiable-data-registry)
for this method is the set of trust anchors that the did controller commits to when constructing their identifier.

# Identifier Syntax

The format for the did:meliorism method conforms to the [@!DID-CORE] specification and is simple.
It consists of the did:meliorism prefix, followed by a Multihash content identifier encoded according to [@!multiformats-multihash-05] or the base64url json encoded base document.

The ABNF for the key format is described below:

```
did-meliorism-format      := did:meliorism:< base-document-content-id / base-document-content >
base-document-content-id  := *base58btc-character
base-document-content     := *base64url-character
base64url-character       := [A-Z] / [a-z] / [0-9] / "-" / "_"
base58btc-character       := [a-km-zA-HJ-NP-Z1-9]
```

# Method Operations

## Create

In order to create a new did:meliorism, a base json document:

```json
{
  "patches": [
    "https://a.example/patches/0",
    "https://b.example/patches/21#42",
    "ipfs://QmTwmG3nFqtM5o2F11X9XByYwTJCHeVtPLJroyvQKEXkE3",
    "data:application/jose,eyJqd2siOnsia3R5IjoiT0tQIiwi..."
  ]
}
```

This document MUST have a `patches` array.

The `patches` array MUST NOT be empty and all members must be string encoded URIs.

All URIs MUST start with one of the following prefixes:

- `https://`
- `ipfs://`
- `data:application/jose,`

A decentralized identifier is obtained from the base document.

There are 2 forms for any given base document.

In the short form, the identifier is based on IPFS content address for the base document:

```
did:meliorism:QmPNzsLMBsz36Bhi13B2KaWNWexdoofaZKVrEbmvsLzmiA
```

In the long form, the identifier is the base64url encoding of the base document:

```
did:meliorism:eyJwYXRjaGVzIjpbImh0dHBzOi8vYS5leGFtcGxlL3BhdGNoZXMvMCIsImh0dHBzOi8vYi5leGFtcGxlL3BhdGNoZXMvMSIsImh0dHBzOi8vYy5leGFtcGxlL3BhdGNoZXMvMiJdfQ
```

## Resolve

In order to resolve a did:meliorism identifier, first the base document must be obtained for the identifier.

If the identifier is in short form, replace `did:meliorism:` with `ipfs://` and resolve the base document from the ipfs network.

If the identifier is in long form, decode the base document from the identifier, ex: JSON.parse( BASE64_URL_DECODE( did.replace(`did:meliorism:`, '') ) )

Process each of the URLs in the `patches` member of the base json document,
yielding a collection of `resolvable` and `unresolvable` signed patches.

If a patch URI contains a fragment, the content MUST be an array and the fragment must be the string encoding of the base 10 index of the relevant signed patch.

For example: `https://a.example/patches/0#42` => [..., jws_41, `jws_42`, jws_43, ...]

If the patch URI contains no fragment, the content is MUST be either: `[jws]` or `jws`.

In all cases, dereferencing the URI MUST return a single JWS string, not an array.

From the `unresolvable` prepare an `unresolvable service object` of the following format:

```json
{
  // index of the Patch URI in the base document
  "id": "#0",
  "type": "SignedIetfJsonPatch",
  "revoked": true,
  // url of the patch from the base document
  "serviceEndpoint": "https://a.example/patches/0"
}
```

From the `resolvable` signed patches obtain the `majority key identifier` as follows:

1. Decode each JWS header, and obtain the `jwk` in the protected header.
1. Compute an index of `kid` to `jwk` where `kid` is computed according to [@!RFC7638].
1. Verify each JWS using the public key in encoded in the protected header.
1. Count the verifications for each `kid` and let the `majority key identifier` be the `kid` matching the `jwk` that was used to verify the largest number of signatures.

Filter the `resolvable signed patches` list to only patches signed by the `majority key identifier`.

Obtain the method specific `didDocumentBase` json which is:

```json
{
  "alsoKnownAs": [],
  "verificationMethod": [],
  "authentication": [],
  "assertionMethod": [],
  "capabilityInvocation": [],
  "capabilityDelegation": [],
  "keyAgreement": [],
  "service": []
}
```

Let the initial didDocument be equal to the didDocumentBase.

Apply each decoded [@!RFC6902] JSON Patch to the didDocument, and set the result to the didDocument.

For each applied patch construct a `resolvable service object` of the following format:

```json
{
  // index of the Patch URI in the base document
  "id": "#0",
  "type": "SignedIetfJsonPatch",
  // url of the patch from the base document
  "serviceEndpoint": "https://a.example/patches/0"
}
```

Combine the `resolvable` and `unresolvable` service object arrays as the `service` array.

Add the did method `@context` which is:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    {
      "@vocab": "https://vocab.example#"
    }
  ]
}
```

Add the `id` member to the `didDocument`.

Add the `service` array to the `didDocument`

Compute the `didDocumentMetadata` as follows:

`didDocumentMetadata.deactivated` is true if all service objects are revoked, and false otherwise.

`didDocumentMetadata.disputed` is true if all service objects are not revoked, and false otherwise.

`didDocumentMetadata.immutable` is true if all service objects endpoint members start with `ipfs://` or `data:application/jose,`.

`didDocumentMetadata.valid` is true if the `didDocument` JSON matches the normative requirements of [@!DID-CORE] and the JSON Schema used to validate `did:meliorism`.

The resolution response object is the `didDocument` and the `didDocumentMetadata`.

Here is an example:

```json
{
  "didDocument": {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      {
        "@vocab": "https://vocab.example#"
      }
    ],
    "id": "did:meliorism:QmPNzsLMBsz36Bhi13B2KaWNWexdoofaZKVrEbmvsLzmiA",
    "verificationMethod": [
      {
        "id": "#key-0",
        "type": "JsonWebKey2020",
        "controller": "did:meliorism:QmPNzsLMBsz36Bhi13B2KaWNWexdoofaZKVrEbmvsLzmiA",
        "publicKeyJwk": {
          "kty": "OKP",
          "crv": "Ed25519",
          "alg": "EdDSA",
          "x": "wJNLf0F065a7OnjnLKY55zgGfwgh6T8GSwAyFSD0qVI"
        }
      }
    ],
    "authentication": ["#key-0"],
    "assertionMethod": ["#key-0"],
    "capabilityDelegation": ["#key-0"],
    "capabilityInvocation": ["#key-0"],
    "keyAgreement": ["#key-0"],
    "service": [
      {
        "id": "#0",
        "type": "SignedIetfJsonPatch",
        "serviceEndpoint": "data:application/jose,eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsImFsZyI..."
      },
      {
        "id": "#1",
        "type": "SignedIetfJsonPatch",
        "serviceEndpoint": "ipfs://QmTwmG3nFqtM5o2F11X9XByYwTJCHeVtPLJroyvQKEXkE3"
      },
      {
        "id": "#2",
        "type": "SignedIetfJsonPatch",
        "revoked": true,
        "serviceEndpoint": "https://c.example/patches/2"
      }
    ]
  },
  "didDocumentMetadata": {
    "valid": true,
    "disputed": true,
    "immutable": false,
    "deactivated": false
  }
}
```

## Update

To update did:meliorism document, you must compute an [@!RFC6902] JSON Patch and sign it as a JSON payload.

The protected header MUST include the public key in `jwk` format used to verify the signature.

This JWS MUST be dereferenced from one of the [Patch URI](#name-patch-uri)s listed in the base document used to obtain the DID.

In the case that the [Patch URI](#name-patch-uri) resolves to an array, the [Patch URI](#name-patch-uri) MUST contain a fragment used to identify the correct JWS member.

In order for the update to be applied, the `jwk` used to sign the patch must be used to sign the simple majority of the other dereferenced jws json patches.

An unresolvable patch does not count towards the simple majority.

## Deactivate

A `did:meliorism` is deactivated when all [Patch URI](#name-patch-uri)s are unresolvable.

# Privacy and Security Considerations

We need to develop a complete list of security considerations.

## Herd privacy

Depending on the network, a [Patch URI](#name-patch-uri) resolution might reveal an attempt to resolve the subject identifier to a 3rd party, such as the web origin that is used to host patches.

If the [Patch URI](#name-patch-uri) resolves to multiple JWS signed json patches,
the host can not tell which specific JWS the http client is requesting, which provides a form of herd privacy.

## Phone home

If the [Patch URI](#name-patch-uri) is unique to the subject identifier and only resolves to a single JWS,
the [Patch URI](#name-patch-uri) resolution history reveals attempts to resolve the subject identifier.

## Centralization

If the [Patch URI](#name-patch-uri)s for a given identifier all rely on `https` scheme and are all under the authority of the same origin, that origin controls the identifier.

DID controllers can apply the following strategies to create more decentralized identifiers.

1. Leverage more than one top level domain when leveraging the `https` scheme.
1. Leverage more than one country or region when leveraging the `https` scheme.
1. Leverage multiple schemes.
1. Leverage a larger number of [Patch URI](#name-patch-uri)s.

## Key rotation

A DID controller can rotate the [primary identifier key](#name-primary-identifier-key) at any time.

The rotation will not be complete until the majority of the [Patch URI](#name-patch-uri)s
dereference to a [JWS](#name-jws) signed with the new [primary identifier key](#name-primary-identifier-key).

## Revision history

Use something else to manage this... like an endorsement service.

This decentralized identifier method does not support historic queries,
for example: discovering if a given key was authoritative 30 years ago.

See [@!RFC9162] for guidance on maintaining transparency.

# Test Vectors

This JSON Document contains the test vectors for this DIM.

See `./data/test-vectors.json`

# Appendix

## Relationship to did:key

This did method is better than did key, because it supports services, and builds on existing RFCs.

This method has advantages and disadvantages when compared to `did:key`.

Advantages:

- Support for service endpoints
- Support for key rotation
- Builds on existing RFCs
- Leverages content addressing

Disadvantages:

- More complicated to implement
- Requires support for multiple URI schemes

## Relationship to did:web

This did method is better than did web, becuase it does not rely on a single origin which is trivial to censor.

This method has advantages and disadvantages when compared to `did:web`.

Advantages:

- Builds on existing RFCs
- More decentralized
- Capable of surving a colluding minority of trust anchors
- Leverages digital signatures to prevent tampering by trust anchors
- Leverages content addressing

Disadvantages:

- More complicated to implement
- Requires support for multiple URI schemes

{backmatter}

<reference anchor='DID-CORE' target='https://www.w3.org/TR/did-core/'>
    <front>
        <title>Decentralized Identifiers (DIDs) v1.0</title>
        <author initials='M.' surname='Sporny' fullname='Manu Sporny'>
         <organization>Digital Bazaar</organization>
        </author>
        <author initials='D.' surname='Longley' fullname='Dave Longley'>
         <organization>Digital Bazaar</organization>
        </author>
        <author initials='M.' surname='Sabadello' fullname='Markus Sabadello'>
         <organization>Danube Tech</organization>
        </author>
        <author initials='D.' surname='Reed' fullname='Drummond Reed'>
         <organization>Evernym/Avast</organization>
        </author>
        <author initials='O.' surname='Steele' fullname='Orie Steele'>
         <organization>Transmute</organization>
        </author>
        <author initials='C.' surname='Allen' fullname='Christopher Allen'>
         <organization>Blockchain Commons</organization>
        </author>
        <date year='2022'/>
    </front>
</reference>

<reference anchor='multiformats-multihash-05' target='https://datatracker.ietf.org/doc/draft-multiformats-multihash/05/'>
    <front>
        <title>The Multihash Data Format</title>
        <author initials='J.' surname='Benet' fullname='Juan Benet'>
         <organization>Protocol Labs</organization>
        </author>
        <author initials='M.' surname='Sporny' fullname='Manu Sporny'>
         <organization>Digital Bazaar</organization>
        </author>
        <date year='2022'/>
    </front>

</reference>
