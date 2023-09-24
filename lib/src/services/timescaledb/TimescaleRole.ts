import * as vault from "@pulumi/vault";
import * as pulumi from "@pulumi/pulumi";
import * as postgres from "@pulumi/postgresql";
import * as random from "@pulumi/random";
import { VaultConstants, buildUrn, URN_TYPE } from "../../constants";
import { Outputable } from "../../types";

export type TimescaleRoleArgs = {
  name: Outputable<string>;
  vaultConnName: Outputable<string>;
  static?: boolean;
  searchPath?: Outputable<string[]>;
  canLogIn?: boolean;
};

// TODO: Refactor this to a component resource including the actual Postgres role AND the Vault role
export class TimescaleRole extends pulumi.ComponentResource {
  readonly pgRole: postgres.Role;
  readonly vaultRole:
    | vault.database.SecretBackendRole
    | vault.database.SecretBackendStaticRole;

  constructor(
    name: string,
    args: TimescaleRoleArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(
      buildUrn(URN_TYPE.LogicalGroup, `TimescaleRole:${name}`),
      name,
      {},
      opts,
    );
    // If role is static, we must be able to log in
    if (args.static) args.canLogIn = true;

    this.pgRole = new postgres.Role(
      "pg-role",
      {
        name: args.name,
        login: args.canLogIn,
        searchPaths: args.searchPath,
        password: args.canLogIn
          ? new random.RandomPassword(
              "pw",
              { special: false, length: 32 },
              { parent: this },
            ).result
          : undefined,
      },
      { parent: this },
    );

    if (args.static) {
      this.vaultRole = new vault.database.SecretBackendStaticRole(
        "vault-static-role",
        {
          name: this.pgRole.name,
          dbName: args.vaultConnName,
          backend: VaultConstants.Backend.db,
          username: this.pgRole.name,
          rotationPeriod: 24 * 60 * 60, // 24 hours
          rotationStatements: [], // Do nothing when rotating
        },
        { parent: this },
      );
    } else {
      this.vaultRole = new vault.database.SecretBackendRole(
        "vault-role",
        {
          name: this.pgRole.name,
          dbName: args.vaultConnName,
          backend: VaultConstants.Backend.db,
          creationStatements: [
            `CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';`,
            this.pgRole.name.apply(($name) => `GRANT ${$name} TO "{{name}}";`),
            pulumi
              .output(args.searchPath)
              .apply(
                ($searchPath) =>
                  `ALTER ROLE "{{name}} SET SEARCH_PATH='${$searchPath?.join(",")}';`,
              ),
          ].filter(Boolean),
          revocationStatements: [`DROP ROLE "{{name}}";`],
          renewStatements: [
            `ALTER USER "{{name}}" VALID UNTIL '{{expiration}}';`,
          ],
        },
        { parent: this },
      );
    }
  }
}
