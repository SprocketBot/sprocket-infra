import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as cmd from "@pulumi/command";
import { config, buildUrn, URN_TYPE } from "../../constants";
import { Outputable } from "../../types";
import { UrlAvailable } from "../../utils";

export type VaultInitializerArgs = {
  vaultImage: Outputable<string>;
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

    const connection: cmd.types.input.remote.ConnectionArgs = {
      host: config.require("remote-host"),
      user: config.require("remote-user"),
      port: config.getNumber("remote-port") ?? 22,
    };

    const initialize = new cmd.remote.Command(
      "init-cmd",
      {
        connection: connection,
        create: pulumi
          .all([args.vaultService.name, args.traefikNetId, args.vaultImage])
          .apply(([$name, $netId, $image]) =>
            `
docker run --rm --network ${$netId} ${$image} vault operator init \
                                    -address=http://${$name}:8200 -key-shares=20 -key-threshold=2
      `.trim(),
          ),
      },
      {
        parent: this,
        deletedWith: args.vaultService,
        additionalSecretOutputs: ["stdout"],
      },
    );

    // Vault should be initialized
    // Lets get the credentials from the logs
    const credentials = initialize.stdout.apply(($logs) => {
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
      console.log({ rootToken, unsealKeys });
      return { unsealKeys, rootToken };
    });

    // We have the credentials; now we can unseal the vault
    const vaultUnsealers = [];
    for (let i = 0; i < 2; i++) {
      vaultUnsealers.push(
        new cmd.remote.Command(
          `${i}-unseal`,
          {
            connection: connection,
            create: pulumi
              .all([
                args.vaultService.name,
                args.traefikNetId,
                args.vaultImage,
                credentials.unsealKeys[i],
              ])
              .apply(([$name, $netId, $image, $key]) =>
                `
docker run --rm --network ${$netId} ${$image} vault operator unseal \
                                    -address=http://${$name}:8200 '${$key}'
      `.trim(),
              ),
          },
          {
            parent: this,
            deletedWith: args.vaultService,
            additionalSecretOutputs: ["stdout"],
          },
        ),
      );
    }
    // TODO: Set up a cron container; or use swarmcron to periodically check if the vault needs unsealing

    // Wait for the vault unsealers to finish?? (Hooking onto logs _might_ do this)
    this.vaultHealthy = UrlAvailable(args.vaultEndpoint + "/v1/sys/health", [
      (r) => r.json().then((js: { sealed: boolean }) => !js?.sealed),
    ]).apply(() => args.vaultEndpoint);

    this.rootToken = credentials.rootToken;
    this.unsealKeys = credentials.unsealKeys;
  }
}
