import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";

import { buildUrn, URN_TYPE } from "../../constants";

export type VaultUtilitiesAuthArgs = {
  approleBackend: vault.AuthBackend;
};

export class VaultUtilitiesAuth extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: VaultUtilitiesAuthArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super(
      buildUrn(URN_TYPE.LogicalGroup, "VaultUtilitiesAuth", name),
      name,
      {},
      opts
    );

    const dsToolPolicy = new vault.Policy(
      "data-tool-policy",
      {
        policy: `
path "database/creds/*data_science*" { capabilities = ["read", "list"] }
path "database/roles/*data_science*" { capabilities = ["read", "list"] }
`,
      },
      { parent: this }
    );

    const dsApproleId = new vault.approle.AuthBackendRole(
      "data-tool-approle",
      {
        roleName: "data-tools",
        tokenPolicies: [dsToolPolicy.name],
      },
      {
        parent: this,
        dependsOn: [args.approleBackend],
      }
    );

    const dsApproleSecret = new vault.approle.AuthBackendRoleSecretId(
      "data-tool-secret",
      { roleName: dsApproleId.roleName },
      {
        parent: this,
      }
    );
  }
}
