import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault"
import * as postgres from "@pulumi/postgresql";
import * as random from "@pulumi/random";

import { PostgresUser } from '../../helpers/datastore/PostgresUser';
import { buildHost } from '../../helpers/buildHost';
import { UTIL_HOSTNAME } from '../../constants';
import { TraefikLabels } from '../../helpers/docker/TraefikLabels';
export interface TooljetArgs {
  providers: {
    vault: vault.Provider
    postgres: postgres.Provider
  }
  ingressNetworkId: docker.Network["id"]
  postgresNetworkId: docker.Network["id"]
  additionalNetworkIds?: docker.Network["id"][]
  postgresHostname: pulumi.Output<string> | string
  smtp: {
    host: string,
    username: string,
    password: pulumi.Output<string>,
    port: number
  }
}

export class Tooljet extends pulumi.ComponentResource {
  readonly database: postgres.Database;
  readonly dbUser: PostgresUser

  readonly network: docker.Network;
  readonly service: docker.Service;

  readonly lockboxMasterKey: random.RandomPassword;
  readonly secretKeyBase: random.RandomPassword;

  constructor(name: string, args: TooljetArgs, opts?: pulumi.ComponentResourceOptions) {
    super('SprocketBot:Services:Tooljet', name, {}, opts)

    this.network = new docker.Network(`${name}-net`, {
      driver: "overlay"
    }, { parent: this })

    this.dbUser = new PostgresUser(`${name}-user`, {
      providers: args.providers,
      username: `${name}-ser`
    }, { parent: this })

    this.database = new postgres.Database(`${name}-db`, {
      name: `${name}-db`,
      owner: this.dbUser.username
    }, { parent: this })
    this.lockboxMasterKey = new random.RandomPassword(`${name}-lockbox-master-key`, {
      length: 128
    }, { parent: this })
    this.secretKeyBase = new random.RandomPassword(`${name}-secret-key-base`, {
      length: 128
    }, {parent: this })

    const hostname = buildHost(`tooljet`, UTIL_HOSTNAME);

    this.service = new docker.Service(`${name}-service`, {
      taskSpec: {
        containerSpec: {
          image: "tooljet/tooljet-ce:latest",
          env: {
            SERVE_CLIENT: "true",
            PORT: "80",
            TOOLJET_HOST: hostname,
            LOCKBOX_MASTER_KEY: this.lockboxMasterKey.result,
            SECRET_KEY_BASE: this.secretKeyBase.result,
            ORM_LOGGING: "all",
            PG_DB: this.database.name,
            PG_USER: this.dbUser.username,
            PG_HOST: args.postgresHostname,
            PG_PASS: this.dbUser.password,
            DISABLE_APP_TELEMETRY: "true",
            ENABLE_MULTIPLAYER_EDITING: "true",
            DEPLOYMENT_PLATFORM: "docker",
            DEFAULT_FROM_EMAIL: "noreply@sprocket.gg",
            SMTP_USERNAME: args.smtp.username,
            SMTP_PASSWORD: args.smtp.password,
            SMTP_DOMAIN: args.smtp.host,
            SMTP_PORT: args.smtp.port.toString(),
          },
          commands: [
            "npm", "run", "start:prod"
          ],
          labels: [
            ...new TraefikLabels(`tooljet`)
              .tls('lets-encrypt-tls')
              .rule(`Host(\`${hostname}\`)`)
              .targetPort(80)
              .forwardAuthRule('SprocketStaff')
              .complete
          ]
        },
        networks: [
          args.postgresNetworkId,
          args.ingressNetworkId,
          ...(args.additionalNetworkIds ?? [])
        ],
      }
    }, { parent: this })
  }
}
