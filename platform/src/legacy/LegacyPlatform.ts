import * as docker from '@pulumi/docker';
import * as vault from '@pulumi/vault';
import * as pulumi from '@pulumi/pulumi';
import * as postgres from '@pulumi/postgresql';

import { Redis } from 'global/services';
import { PostgresUser } from 'global/helpers/datastore/PostgresUser';
import defaultLogDriver from 'global/helpers/docker/DefaultLogDriver';
import { getImageSha } from 'global/helpers/docker/getImageSha';
import { PlatformDatabase } from '../PlatformDatabase';
import { PlatformMinio } from '../PlatformMinio';

const config = new pulumi.Config();

export interface LegacyPlatformArgs {
  postgresNetworkId: docker.Network['id'],

  database: PlatformDatabase,
  minio: PlatformMinio

  vaultProvider: vault.Provider,
  postgresProvider: postgres.Provider
}

export class LegacyPlatform extends pulumi.ComponentResource {
  bot?: docker.Service;
  bot2?: docker.Service;
  readonly worker: docker.Service;
  readonly redis: Redis;
  readonly network: docker.Network;

  private readonly dbCredentials: PostgresUser;

  constructor(name: string, args: LegacyPlatformArgs, opts?: pulumi.ComponentResourceOptions) {
    super('SprocketBot:LegacyPlatform', name, {}, opts);

    this.dbCredentials = new PostgresUser(`${name}-db-user`, {
      providers: { postgres: args.postgresProvider, vault: args.vaultProvider },
      username: `sprocket_${pulumi.getStack()}_legacy`,
      roleArgs: {
        searchPaths: ['mledb']
      }
    }, { parent: this });
    this.network = new docker.Network(`${name}-net`, {
      driver: 'overlay'
    }, { parent: this });

    this.buildPostgresGrants(name, args);

    this.redis = new Redis(`${name}-redis`, {
      configFilepath: `${__dirname}/../config/datastores/redis.conf`,
      vaultProvider: args.vaultProvider,
      platformNetworkId: this.network.id
    }, { parent: this });

    this.worker = new docker.Service(`${name}-worker`, {
      auth: {
        username: config.require('docker-username'),
        password: config.requireSecret('docker-access-token'),
        serverAddress: 'https://docker.io'
      },
      taskSpec: {
        containerSpec: {
          image: getImageSha('asaxplayinghorse', 'worker', 'master'),
          env: {
            NODE_ENV: 'production',
            REDIS_HOST: this.redis.hostname,
            REDIS_PASSWORD: this.redis.credentials.password,
            REDIS_PORT: '6379',
            bot_token: pulumi.getStack() === "main" ? config.requireSecret('legacy-bot-token-emilia') : config.requireSecret('legacy-bot-token'),
            connstring: pulumi.all([
              this.dbCredentials.username,
              this.dbCredentials.password,
              args.database.host,
              args.database.database.name
            ])
              .apply(([dbUser, dbPass, host, db]) => `postgresql://${dbUser}:${dbPass}@${host}/${db}?sslmode=disable`),
            file_bucket: args.minio.bucket.bucket,
            file_token: args.minio.minioUser.name,
            file_token_secret: args.minio.minioUser.secret,
            SPROCKET: 'yes'
          }
        },
        logDriver: defaultLogDriver(`${name}-worker`, false),
        networks: [
          args.postgresNetworkId,
          this.network.id
        ]
      }
    }, { parent: this });

    this.buildBots(name, args);
  }


  private buildBots(name: string, args: LegacyPlatformArgs) {
    console.log(pulumi.getStack())
    if (pulumi.getStack() === 'main') {
      this.buildProductionBot(name, args);
    } else {
      this.buildStagingBot(name, args);
    }
  }

  private buildProductionBot(name: string, args: LegacyPlatformArgs) {
    this.bot = new docker.Service(`${name}-bot-service-emilio`, {
      auth: {
        username: config.require('docker-username'),
        password: config.requireSecret('docker-access-token'),
        serverAddress: 'https://docker.io'
      },
      taskSpec: {
        containerSpec: {
          image: getImageSha('asaxplayinghorse', 'bot', 'master'),
          env: {
            NODE_ENV: 'production',
            REDIS_HOST: this.redis.hostname,
            REDIS_PASSWORD: this.redis.credentials.password,
            REDIS_PORT: '6379',
            bot: 'Emilio',
            bot_token: config.requireSecret('legacy-bot-token-emilio'),
            connstring: pulumi.all([
              this.dbCredentials.username,
              this.dbCredentials.password,
              args.database.host,
              args.database.database.name
            ])
              .apply(([dbUser, dbPass, host, db]) => `postgresql://${dbUser}:${dbPass}@${host}/${db}?sslmode=disable`),
            file_bucket: args.minio.bucket.bucket,
            file_token: args.minio.minioUser.name,
            file_token_secret: args.minio.minioUser.secret,
            SPROCKET: 'yes'
          }
        },
        networks: [
          args.postgresNetworkId,
          this.network.id
        ],
        logDriver: defaultLogDriver(`${name}-emilio`, false)
      }
    }, { parent: this });
    this.bot2 = new docker.Service(`${name}-bot-service-emilia`, {
      auth: {
        username: config.require('docker-username'),
        password: config.requireSecret('docker-access-token'),
        serverAddress: 'https://docker.io'
      },
      taskSpec: {
        containerSpec: {
          image: getImageSha('asaxplayinghorse', 'bot', 'master'),
          env: {
            NODE_ENV: 'production',
            REDIS_HOST: this.redis.hostname,
            REDIS_PASSWORD: this.redis.credentials.password,
            REDIS_PORT: '6379',
            bot: 'Emilia',
            bot_token: config.requireSecret('legacy-bot-token-emilia'),
            connstring: pulumi.all([
              this.dbCredentials.username,
              this.dbCredentials.password,
              args.database.host,
              args.database.database.name
            ])
              .apply(([dbUser, dbPass, host, db]) => `postgresql://${dbUser}:${dbPass}@${host}/${db}?sslmode=disable`),
            file_bucket: args.minio.bucket.bucket,
            file_token: args.minio.minioUser.name,
            file_token_secret: args.minio.minioUser.secret,
            SPROCKET: 'yes'
          }
        },
        networks: [
          args.postgresNetworkId,
          this.network.id
        ],
        logDriver: defaultLogDriver(`${name}-emilia`, false)
      }
    }, { parent: this });

  }

  private buildStagingBot(name: string, args: LegacyPlatformArgs) {
    this.bot = new docker.Service(`${name}-bot-service`, {
      auth: {
        username: config.require('docker-username'),
        password: config.requireSecret('docker-access-token'),
        serverAddress: 'https://docker.io'
      },
      taskSpec: {
        containerSpec: {
          image: getImageSha('asaxplayinghorse', 'bot', 'master'),
          env: {
            NODE_ENV: 'production',
            REDIS_HOST: this.redis.hostname,
            REDIS_PASSWORD: this.redis.credentials.password,
            REDIS_PORT: '6379',
            bot: 'ProofOfConcept',
            bot_token: config.requireSecret('legacy-bot-token'),
            connstring: pulumi.all([
              this.dbCredentials.username,
              this.dbCredentials.password,
              args.database.host,
              args.database.database.name
            ])
              .apply(([dbUser, dbPass, host, db]) => `postgresql://${dbUser}:${dbPass}@${host}/${db}?sslmode=disable`),
            file_bucket: args.minio.bucket.bucket,
            file_token: args.minio.minioUser.name,
            file_token_secret: args.minio.minioUser.secret,
            SPROCKET: 'yes'
          }
        },
        networks: [
          args.postgresNetworkId,
          this.network.id
        ],
        logDriver: defaultLogDriver(`${name}-bot`, false)
      }
    }, { parent: this });
  }

  private buildPostgresGrants(name: string, args: LegacyPlatformArgs) {
    new postgres.Grant(`${name}-grant-usage`, {
      database: args.database.database.name,
      objectType: 'schema',
      schema: args.database.mledbSchema.name,
      privileges: ['USAGE'],
      role: this.dbCredentials.username
    }, { parent: this, provider: args.postgresProvider });
    new postgres.Grant(`${name}-grant`, {
      role: this.dbCredentials.username,
      database: args.database.database.name,
      objectType: 'table',
      schema: args.database.mledbSchema.name,
      privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    }, { parent: this, provider: args.postgresProvider });
  }
}
