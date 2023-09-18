import * as vault from "@pulumi/vault";
import * as pulumi from "@pulumi/pulumi";
import * as postgres from "@pulumi/postgresql";
import { buildUrn, URN_TYPE } from "../../constants/pulumi";
import { Backend } from "../vault/backends";

export type TimescaleRoleArgs = {
  dbName: Outputable<string>;
  name: Outputable<string>;
  vaultConnName: Outputable<string>;
  static?: boolean;
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

    this.pgRole = new postgres.Role(
      "pg-role",
      {
        name: args.name,
        login: args.static,
      },
      { parent: this },
    );

    if (args.static) {
      this.vaultRole = new vault.database.SecretBackendRole(
        "vault-role",
        {
          dbName: args.vaultConnName,
          backend: Backend.db,
          creationStatements: [
            `CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';`,
            this.pgRole.name.apply(($name) => `GRANT ${$name} TO "{{name}}";`),
          ],
          revocationStatements: [`DROP ROLE "{{name}}";`],
          renewStatements: [
            `ALTER USER "{{name}}" VALID UNTIL '{{expiration}}';`,
          ],
        },
        { parent: this },
      );
    } else {
      this.vaultRole = new vault.database.SecretBackendStaticRole(
        "vault-static-role",
        {
          dbName: args.vaultConnName,
          backend: Backend.db,
          username: this.pgRole.name,
          rotationPeriod: 0, // disable credential rotation
        },
        { parent: this },
      );
    }
  }
}
