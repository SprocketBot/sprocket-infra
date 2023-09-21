import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import { buildUrn, URN_TYPE } from "../../constants";
import { Outputable } from "../../types";
import { UrlAvailable } from "../../utils";

export type VaultInitializerArgs = {
  vaultImage: string;
  traefikNetId: Outputable<string>;
  vaultService: docker.Service;
  vaultEndpoint: string;
};

export class VaultInitializer extends pulumi.ComponentResource {
  readonly rootToken: string | pulumi.Output<string>;
  readonly unsealKeys: pulumi.Output<string[]>;
  readonly vaultHealthy: pulumi.Output<string>;

  constructor(
    name: string,
    args: VaultInitializerArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.OneOff, "VaultAutoInitializer"), name, {}, opts);

    const initialize = new docker.Container(
      `init`,
      {
        image: args.vaultImage,
        command: args.vaultService.name.apply(($name) => [
          "vault",
          "operator",
          "init",
          `-address=http://${$name}:8200`,
          "-key-shares=20",
          "-key-threshold=2",
        ]),
        networksAdvanced: [{ name: args.traefikNetId }],
        attach: true,
        logs: true,
        mustRun: false,
        rm: true,
      },
      {
        parent: this,
        // TODO: Ignore all changes, this should _never_ be updated.
        ignoreChanges: ["image"],
        deletedWith: args.vaultService,
        additionalSecretOutputs: ["containerLogs"],
        protect: true,
      },
    );

    // Vault should be initialized
    // Lets get the credentials from the logs
    const credentials = initialize.containerLogs.apply(($logs) => {
      const lines = $logs.split("\n");
      const unsealKeys = lines
        .filter((line) => line.includes("Unseal Key"))
        .map((line) => line.split(": ")[1]);
      const rootToken = lines
        .find((line) => line.includes("Root Token"))
        ?.split(": ")[1];

      if (!unsealKeys || !rootToken) {
        console.log({
          unsealKeys: Boolean(unsealKeys),
          rootToken: Boolean(rootToken),
        });
        throw new Error(
          "Unable to extract unseal keys and root token from Vault Auto Initialize",
        );
      }
      console.log({ rootToken });
      return { unsealKeys, rootToken };
    });

    // We have the credentials; now we can unseal the vault
    const vaultUnsealers = [];
    for (let i = 0; i < 2; i++) {
      vaultUnsealers.push(
        new docker.Container(
          `unseal-${i}`,
          {
            image: args.vaultImage,
            command: pulumi
              .all([args.vaultService.name, credentials.unsealKeys])
              .apply(([$name, $unsealKeys]) => [
                "vault",
                "operator",
                "unseal",
                `-address=http://${$name}:8200`,
                $unsealKeys[i],
              ]),
            networksAdvanced: [{ name: args.traefikNetId }],
            attach: true,
            logs: true,
            mustRun: false,
            rm: true,
          },
          { parent: this, ignoreChanges: ["image"], protect: true },
        ),
      );
    }

    // Wait for the vault unsealers to finish?? (Hooking onto logs _might_ do this)
    this.vaultHealthy = UrlAvailable(args.vaultEndpoint + "/v1/sys/health", [
      (r) => r.json().then((js: { sealed: boolean }) => !js?.sealed),
    ]).apply(() => args.vaultEndpoint);

    this.rootToken = credentials.rootToken;
    this.unsealKeys = credentials.unsealKeys;
  }
}
