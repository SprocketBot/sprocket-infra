import * as pulumi from "@pulumi/pulumi";

import {
  buildUrn,
  ConfigFile,
  TimescaleDbArgs,
  Traefik,
  URN_TYPE,
  UserPassCredential,
  Vault,
  TimescaleDb,
  Outputable,
  TimescaleVault,
} from "@sprocketbot/infra-lib";

interface BuildTimescaleArgs {
  traefik: Traefik;
  configPaths?: { "pg_hba.conf"?: string; "postgresql.conf"?: string };
  vault: Vault["provider"];
}

interface BuildTimescaleResult {
  hostname: Outputable<string>;
  port: Outputable<number>;
  provider: TimescaleDb["provider"];
  networkId: TimescaleDb["networkId"];
  serviceName: TimescaleDb["service"]["name"];
  vaultConnectionName: TimescaleVault["connection"]["name"];
  vaultRolePath: TimescaleDb["rootAcct"]["path"];
  buildConnectionString: (c: UserPassCredential) => pulumi.Output<string>;
}

export function BuildTimescale({
  traefik,
  configPaths,
  vault,
}: BuildTimescaleArgs): BuildTimescaleResult {
  // Wrap everything into a component resource so it can be depended on
  const output = new pulumi.ComponentResource(
    buildUrn(URN_TYPE.LogicalGroup, "deployed-timescale"),
    "deployed-timescale",
    {},
    {
      dependsOn: [traefik],
      providers: { vault },
    },
  );

  const configs: TimescaleDbArgs["configs"] = {};

  if (configPaths?.["pg_hba.conf"]) {
    configs["pg_hba.conf"] = new ConfigFile(
      "pg_hba.conf",
      { filepath: "./src/config/pg_hba.conf" },
      { parent: output },
    );
  }
  if (configPaths?.["postgresql.conf"]) {
    configs["postgresql.conf"] = new ConfigFile(
      "postgresql.conf",
      {
        filepath: "./src/config/postgresql.conf",
        vars: {
          hba_path: configs["pg_hba.conf"]
            ? "/etc/postgresql/pg_hba.conf"
            : "/var/lib/postgresql/data/pg_hba.conf",
        },
      },
      { parent: output },
    );
  }

  const timescale = new TimescaleDb(
    "infra-timescale",
    {
      ingressNetId: traefik.network.id,
      configs,
    },
    { parent: output },
  );

  return {
    hostname: timescale.hostname,
    port: timescale.port,
    provider: timescale.provider,
    networkId: timescale.networkId,
    serviceName: timescale.service.name,
    vaultConnectionName: timescale.vault.connection.name,
    vaultRolePath: timescale.rootAcct.pathName,
    buildConnectionString: () => {
      throw new Error("not implemented");
    },
  };
}
