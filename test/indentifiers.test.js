import base64url from "base64url";
import assert from "assert";

describe("identifiers", () => {
  it("long form", () => {
    const id = base64url.encode(
      JSON.stringify({
        patches: [
          "https://a.example/patches/0",
          "https://b.example/patches/1",
          "https://c.example/patches/2",
        ],
      })
    );
    assert.equal(
      id,
      "eyJwYXRjaGVzIjpbImh0dHBzOi8vYS5leGFtcGxlL3BhdGNoZXMvMCIsImh0dHBzOi8vYi5leGFtcGxlL3BhdGNoZXMvMSIsImh0dHBzOi8vYy5leGFtcGxlL3BhdGNoZXMvMiJdfQ"
    );
  });
});
