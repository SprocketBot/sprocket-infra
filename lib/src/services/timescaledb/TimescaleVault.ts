import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import { buildUrn, URN_TYPE } from "../../constants/pulumi";
import { Backend, getBackend, setBackend } from "../vault/backends";

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
    connString.apply(console.log);

    // TODO: Can we auto-rotate after creation?
    this.connection = new vault.database.SecretBackendConnection(
      "connection",
      {
        backend: Backend.db,
        name: "Sprocket-Timescale",
        postgresql: {
          connectionUrl: connString,
          usernameTemplate:
            '{{ .DisplayName }}__{{ .RoleName }}__{{ .Timestamp "2006-January-02-15-23" }}',
        },
      },
      { parent: this },
    );
  }
}
