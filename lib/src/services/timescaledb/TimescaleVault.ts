import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import { VaultConstants, buildUrn, URN_TYPE } from "../../constants";
import { Outputable } from "../../types";
import { VaultUtils } from "../../utils";

export type TimescaleVaultArgs = {
  host: Outputable<string>;
  username: Outputable<string>;
  password: Outputable<string>;
  port: Outputable<number>;
  sslmode?: Outputable<string>;
};

export class TimescaleVault extends pulumi.ComponentResource {
  readonly connection: vault.database.SecretBackendConnection;

  constructor(
    name: string,
    args: TimescaleVaultArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Configuration, "TimescaleVault"), name, {}, opts);
    const connString = pulumi
      .all([args.host, args.username, args.password, args.port, args.sslmode])
      .apply(([$host, $username, $password, $port, $sslmode]) => {
        let out = `postgres://${$username}:${$password}@${$host}:${$port}?`;
        if ($sslmode) out += `sslmode=${$sslmode}`;
        return out;
      });

    // TODO: Can we auto-rotate after creation?
    this.connection = new vault.database.SecretBackendConnection(
      "connection",
      {
        backend: VaultConstants.Backend.db,
        name: "Sprocket-Timescale",
        allowedRoles: ["*"],
        postgresql: {
          connectionUrl: connString,
          usernameTemplate:
            '{{ .DisplayName }}__{{ .RoleName }}__{{ timestamp "2006-January-02-15-04" }}__{{random 5}}',
        },
        // This has a hack to force a dependency on the backend. Because it is only an output, we have to use it here and cannot use dependsOn
        verifyConnection: pulumi
          .output(VaultUtils.getBackend(VaultConstants.Backend.db))
          .apply(() => false),
      },
      { parent: this },
    );
  }
}
