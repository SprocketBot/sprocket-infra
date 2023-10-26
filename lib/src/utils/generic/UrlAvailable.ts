import { Outputable } from "../../types";
import fetch, { Response } from "node-fetch";
import * as pulumi from "@pulumi/pulumi";
import * as https from "https";
import { config } from "../../constants/pulumi";
import * as fs from "fs";

export const UrlAvailable = (
  url: Outputable<string>,
  additionalChecks?: ((r: Response) => boolean | Promise<boolean>)[],
  onlyAdditionalChecks = false,
  note?: string,
): pulumi.Output<string> =>
  pulumi.all([url]).apply(async ([$url]) => {
    console.log({ $url, note });
    // Skip checking for the URL when we are running a preview; otherwise previews will never work
    if (pulumi.runtime.isDryRun()) return $url;
    // Import the ca certificate if needed
    const agent = new https.Agent({
      ca: config.get("traefik-trust-ca")
        ? fs.readFileSync(config.require("traefik-trust-ca"))
        : undefined,
    });

    let i = 1;
    function check(): Promise<boolean> {
      return fetch($url, { agent })
        .then(async (r) => {
          console.log({ url: $url, attempt: i++, ok: r.ok });
          if (additionalChecks) {
            for (const additionalCheck of additionalChecks) {
              if (!(await additionalCheck(r))) return false;
            }
            // At this point no additional checks have failed, beacuse we would have returned false
            // This means we can return true
            if (onlyAdditionalChecks) return true;
          }
          return r.ok;
        })
        .catch((e) => {
          console.warn(e.message);
          return false;
        });
    }

    for (let i = 0; i < 30; i++) {
      if (await check()) return url;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
    throw new Error(`${url} did not become available in time.`);
  }) as pulumi.Output<string>;
