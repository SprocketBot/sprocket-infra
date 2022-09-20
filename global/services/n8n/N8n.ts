import * as pulumi from '@pulumi/pulumi';
import * as docker from '@pulumi/docker';
import * as postgres from "@pulumi/postgresql";
import * as vault from "@pulumi/vault";
import { PostgresUser } from '../../helpers/datastore/PostgresUser';
import defaultLogDriver from '../../helpers/docker/DefaultLogDriver';
import { TraefikLabels } from '../../helpers/docker/TraefikLabels';
import { buildHost } from '../../helpers/buildHost';
import { UTIL_HOSTNAME } from '../../constants';

export interface N8nArgs {
  providers: {
    vault: vault.Provider,
    postgres: postgres.Provider
  },
  postgresHostname: pulumi.Output<string> | string,
  ingressNetworkId: pulumi.Output<string> | string,
  postgresNetworkId: pulumi.Output<docker.Network["id"]> | docker.Network["id"]
}

export class N8n extends pulumi.ComponentResource {
  readonly database: postgres.Database;
  readonly dbUser: PostgresUser;

  readonly network: docker.Network;
  readonly service: docker.Service;

  constructor(name: string, args: N8nArgs, opts?: pulumi.ComponentResourceOptions) {
    super('SprocketBot:Services:N8n', name, {}, opts);

    this.dbUser = new PostgresUser(`${name}-user`, {
      providers: args.providers,
      username: `${name}-user`,
    }, { parent: this})

    this.database = new postgres.Database(`${name}-db`, {
        name: `${name}-db`,
        owner: this.dbUser.username
      }, {parent: this, provider: args.providers.postgres})


    this.network = new docker.Network(`${name}-net`, { driver: 'overlay' }, { parent: this });

    const hostname = buildHost("n8n", UTIL_HOSTNAME)

    this.service = new docker.Service(`${name}-service`, {
      taskSpec: {
        containerSpec: {
          image: "n8nio/n8n",
          env: {
            DB_TYPE: 'postgres',
            DB_POSTGRESDB_DATABASE: this.database.name,
            DB_POSTGRESDB_HOST: args.postgresHostname,
            DB_POSTGRESDB_PORT: "5432",
            DB_POSTGRESDB_USER: this.dbUser.username,
            DB_POSTGRESDB_SCHEMA: "public",
            DB_POSTGRESDB_PASSWORD: this.dbUser.password,
            N8N_BASIC_AUTH_ACTIVE: "false",
            WEBHOOK_URL: hostname,
            N8N_HOST: hostname,
            N8N_PORT: "5678",
          }
        },
        logDriver: defaultLogDriver(name, true)
      },
      labels: new TraefikLabels("n8n", "http")
        .tls("lets-encrypt")
        .rule(`Host(\`${hostname}\`)`)
        .targetPort(5678)
        .forwardAuthRule("SprocketStaff")
        .complete
    }, {
      parent: this
    });

  }
}
