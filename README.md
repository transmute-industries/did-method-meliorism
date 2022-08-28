# did:meliorism

[![Spec](https://github.com/transmute-industries/did-method-meliorism/actions/workflows/cd.yml/badge.svg)](https://github.com/transmute-industries/did-method-meliorism/actions/workflows/cd.yml)

An experimental Decentralized Identifier Method.

[Read the method specification](https://transmute-industries.github.io/did-method-meliorism/).

## Use

You will need to setup a `.env` from the given `example.env`.

Currently, only infura based configuration for IPFS is supported.

- [infura.io](https://infura.io/).

```
nvm use 18
npm i
npm t
```

### Development

The command line binary is aliased to an npm script,
so you can develop the cli locally without needing to install the package globally.

```
npm run did:meliorism -- --help
```

```
npm run did:meliorism -- --version
```

#### Create

```
npm run did:meliorism -- create --base ./data/document.json
```

```
npm run did:meliorism -- create --base ./data/document.json --no-ipfs
```

#### Resolve

```
npm run did:meliorism -- resolve did:meliorism:QmPNzsLMBsz36Bhi13B2KaWNWexdoofaZKVrEbmvsLzmiA
```

```
npm run did:meliorism -- resolve did:meliorism:eyJwYXRjaGVzIjpbImh0dHBzOi8vYS5leGFtcGxlL3BhdGNoZXMvMCIsImh0dHBzOi8vYi5leGFtcGxlL3BhdGNoZXMvMSIsImh0dHBzOi8vYy5leGFtcGxlL3BhdGNoZXMvMiJdfQ
```

#### Generate Key

```
npm run did:meliorism -- generate-key EdDSA
```

### Patches

#### Add Nothing

```
npm run did:meliorism -- update \
--no-changes \
--authorization ./data/verification-method.json
```

#### Add Verification Method

```
npm run did:meliorism -- update \
--verification-method ./data/verification-method.json \
--purpose "authentication, credentials, capabilities" \
--authorization ./data/verification-method.json
```

Publish a "no-controller" patch to IPFS:

```
npm run did:meliorism -- update \
--no-controller \
--verification-method ./data/verification-method.json \
--purpose "authentication, credentials, capabilities" \
--authorization ./data/verification-method.json \
--publish ipfs
```

```
npm run did:meliorism -- update \
--no-changes \
--no-controller \
--authorization ./data/verification-method.json \
--publish ipfs
```

These are useful when creating an immutable DID,
where the patches cannot know the controller because they are used to compute it.

For example:

```
npm run did:meliorism -- create ipfs://QmbLFwfvjFdsAsVUHg3uPB3kTDxzm7A4LiVgskZ3EW8vpf ipfs://QmVJoRQ3XA6DshUzZNF8eFRvzKtoQT9EHJXybYMPjCuSNa#0
```

```
npm run did:meliorism -- resolve did:meliorism:QmRSiZ93nduWbjHVbuLaHt4sFS9qPBCW8akjoTDwp7ZENv
```

### Immutable Example

You can chain commands by leveraging `--silent` and `jq` and redirects.

First create a "no-controller" key pair you will use to sign the `didDocument` JSON patches.

```
npm run did:meliorism --silent -- generate-key EdDSA \
--no-controller  > ./data/immutable-no-controller-key-pair.json
```

Next create and publish one or more "no-contoller" signed json patches:

```
npm run did:meliorism --silent -- update \
--no-controller \
--verification-method ./data/immutable-no-controller-key-pair.json \
--purpose "authentication, credentials, capabilities" \
--authorization ./data/immutable-no-controller-key-pair.json \
--publish ipfs
```

```
npm run did:meliorism --silent -- update \
--no-changes \
--no-controller \
--authorization ./data/immutable-no-controller-key-pair.json \
--publish data-uri
```

Finally create the identifier from the patch URLs:

```
npm run did:meliorism --silent -- create ipfs://QmTwmG3nFqtM5o2F11X9XByYwTJCHeVtPLJroyvQKEXkE3 data:application/jose,eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsImFsZyI6IkVkRFNBIiwieCI6IjlDYUxISmw0a1ZLZmN6MUN2aC1FVFhmVWYxdzBFbS0zU1RlclE0SFRKMGsifSwiYWxnIjoiRWREU0EiLCJjdHkiOiJhcHBsaWNhdGlvbi9qc29uLXBhdGNoK2pzb24ifQ.W10.F7Zm8OHhABsUZgiAUOA_VmqTpJQzVlZO1lq28BD3iTa1BxPEZVsnu03xtRhNE8BLaKQSanGAwIeq44abqxhDCg
```

```
npm run did:meliorism --silent -- resolve did:meliorism:QmR1HjCnenp76NKihLG4Av8bcf7LcLEDJQwooWaVmKgibk | jq
```

You can verify that a DID is immutable by checking its `didDocumentMetadata`:

```
npm run did:meliorism --silent -- resolve did:meliorism:QmR1HjCnenp76NKihLG4Av8bcf7LcLEDJQwooWaVmKgibk | jq '.didDocumentMetadata'
```
