import * as vault from "@pulumi/vault";
import * as pulumi from "@pulumi/pulumi";
import { readFileSync } from "fs";

export interface VaultBackendArgs {
  description: string;
  path: string;
  policyContent: string;
  import?: { backend: string };
  vaultProvider: vault.Provider;
}

export class VaultBackend extends pulumi.ComponentResource {
  readonly backend: vault.Mount;
  readonly token: vault.Token;
  readonly policy: vault.Policy;

  constructor(
    name: string,
    args: VaultBackendArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("SprocketBot:VaultPolicies:Backend", name, {}, opts);

    this.backend = new vault.Mount(
      `${name}-backend`,
      {
        description: args.description,
        path: args.path,
        type: "kv",
      },
      {
        provider: args.vaultProvider,
        parent: this,
        import: args.import?.backend,
      },
    );

    this.policy = new vault.Policy(
      `${name}-policy`,
      {
        name: `${args.path}-policy`,
        policy: args.policyContent,
      },
      {
        provider: args.vaultProvider,
        parent: this,
      },
    );

    this.token = new vault.Token(
      `${name}-token`,
      {
        displayName: `${args.path}-access`,
        policies: [this.policy.name],
        noParent: true,
      },
      {
        provider: args.vaultProvider,
        additionalSecretOutputs: ["clientToken"],
        parent: this,
      },
    );
  }
}
