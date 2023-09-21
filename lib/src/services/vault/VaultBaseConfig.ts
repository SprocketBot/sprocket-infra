import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import { buildUrn, URN_TYPE, VaultConstants } from "../../constants";
import { VaultUtils } from "../../utils";

export type VaultBaseConfigArgs = {
  unsealKeys: pulumi.Output<string[]>;
};

export class VaultBaseConfig extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: VaultBaseConfigArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Configuration, "VaultBaseConfig"), name, {}, opts);

    const kvStore = new vault.Mount(
      "kv",
      {
        type: "kv",
        path: `/${VaultConstants.Backend.kv2}`,
        description: "Generic KeyValue store.",
        options: {
          version: "2",
        },
      },
      { parent: this },
    );

    VaultUtils.setBackend(VaultConstants.Backend.kv2, kvStore);

    const dbStore = new vault.database.SecretsMount(
      "db",
      {
        path: VaultConstants.Backend.db,
      },
      { parent: this },
    );

    VaultUtils.setBackend(VaultConstants.Backend.db, dbStore);

    const unsealKeysSecret = new vault.kv.SecretV2(
      "unseal-keys-secret",
      {
        name: "sudo/vault/unseal-keys",
        mount: `/${VaultConstants.Backend.kv2}`,
        dataJson: args.unsealKeys.apply(($keys: string[]) =>
          JSON.stringify(
            $keys.reduce(
              (a, v, i) => ({
                ...a,
                [`Unseal Token ${i}`]: v,
              }),
              {},
            ),
          ),
        ),
      },
      { parent: this },
    );
  }
}
