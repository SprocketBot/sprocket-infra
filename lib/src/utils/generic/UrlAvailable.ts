import { Outputable } from "../../types";
import fetch, { Response } from "node-fetch";
import * as pulumi from "@pulumi/pulumi";
import * as https from "https";
import { config } from "../../constants/pulumi";
import * as fs from "fs";

export const UrlAvailable = (
  url: Outputable<string>,
  additionalChecks?: ((r: Response) => boolean | Promise<boolean>)[],
): pulumi.Output<string> =>
  pulumi.all([url]).apply(async ([$url]) => {
    // Import the ca certificate if needed
    const agent = new https.Agent({
      ca: config.get("traefik-trust-ca")
        ? fs.readFileSync(config.require("traefik-trust-ca"))
        : undefined,
    });

    function check(): Promise<boolean> {
      return fetch($url, { agent })
        .then(async (r) => {
          if (additionalChecks) {
            for (const additionalCheck of additionalChecks) {
              if (!(await additionalCheck(r))) return false;
            }
          }
          return r.ok;
        })
        .catch((e) => {
          console.warn(e.message);
          return false;
        });
    }

    for (let i = 0; i < 20; i++) {
      if (await check()) return url;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
    throw new Error(`${url} did not become available in time.`);
  }) as pulumi.Output<string>;
