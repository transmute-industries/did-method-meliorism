#!/usr/bin/env node
import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import dotenv from "dotenv";
import method from "./index.mjs";

dotenv.config();

const config = {
  projectId: process.env.INFURA_PROJECT_ID,
  projectSecret: process.env.INFURA_PROJECT_SECRET,
  host: process.env.INFURA_HOST,
  port: process.env.INFURA_PORT,
  protocol: process.env.INFURA_PROTOCOL,
  apiPath: process.env.INFURA_API_PATH,
  gateway: process.env.INFURA_GATEWAY,
};

const client = method.create(config);

yargs(hideBin(process.argv))
  .scriptName(method.name)
  .command(
    "create",
    "create a decentralized identifier",
    () => {},
    async (argv) => {
      let document;
      if (argv.base) {
        const { base } = argv;

        try {
          document = JSON.parse(
            fs.readFileSync(path.resolve(process.cwd(), base)).toString()
          );
        } catch (e) {
          console.error("Cannot read base document from: " + base);
          process.exit(1);
        }
      } else {
        document = { patches: argv._.splice(1) };
      }
      const id = await client.operations.create(document, {
        ipfs: argv.ipfs !== undefined ? argv.ipfs : true,
      });
      console.log(JSON.stringify({ id }, null, 2));
    }
  )
  .command(
    "resolve <did>",
    "resolve a decentralized identifier",
    () => {},
    async (argv) => {
      const { did } = argv;
      const resolution = await client.operations.resolve(did, {
        accept: "application/did+json",
      });
      console.log(JSON.stringify(resolution, null, 2));
    }
  )
  .command(
    "generate-key <alg>",
    "generate a key pair",
    () => {},
    async (argv) => {
      const { alg, controller } = argv;
      const key = await method.utils.generateKey(alg, {
        controller: controller === undefined ? true : controller,
      });
      console.log(JSON.stringify(key, null, 2));
    }
  )
  .command(
    "update",
    "create a signed json patch, used to update a decentralized identifier",
    () => {},
    async (argv) => {
      const { purpose, authorization, changes } = argv;

      let verificationMethod = argv.verificationMethod;

      let authorizationKey;

      try {
        authorizationKey = JSON.parse(
          fs.readFileSync(path.resolve(process.cwd(), authorization)).toString()
        );
      } catch (e) {
        console.error("Cannot read authorization key from: " + authorization);
        process.exit(1);
      }

      let jws;

      if (changes === false) {
        jws = await method.utils.patches.addNothing(
          authorizationKey.privateKeyJwk
        );
      } else {
        try {
          verificationMethod = JSON.parse(
            fs
              .readFileSync(path.resolve(process.cwd(), verificationMethod))
              .toString()
          );
        } catch (e) {
          console.error(
            "Cannot read verification-method document from: " +
              verificationMethod
          );
          process.exit(1);
        }

        const relationships = [];

        if (purpose.includes("authentication")) {
          relationships.push("authentication");
        }

        if (purpose.includes("credentials")) {
          relationships.push("assertionMethod");
        }

        if (purpose.includes("capabilities")) {
          relationships.push("capabilityInvocation");
          relationships.push("capabilityDelegation");
        }

        if (purpose.includes("encryption")) {
          relationships.push("keyAgreement");
        }

        if (argv.controller === false) {
          delete verificationMethod.controller;
        }
        jws = await method.utils.patches.addVerificationMethod(
          verificationMethod,
          relationships,
          authorizationKey.privateKeyJwk
        );
      }

      if (argv.publish === "ipfs") {
        const cid = await client.ipfs.set([jws]);
        console.log();
        console.log("ipfs://" + cid);
        console.log();
        console.log(`${config.gateway}/ipfs/${cid}`);
      } else if (argv.publish === "data-uri") {
        console.log();
        console.log(`data:application/jose,${jws}`);
      } else {
        console.log(JSON.stringify(jws));
      }
    }
  )
  .demandCommand(1)
  .parse();
