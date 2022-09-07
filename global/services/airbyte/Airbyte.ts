import * as pulumi from "@pulumi/pulumi"
import * as docker from "@pulumi/docker"
import * as vault from "@pulumi/vault"
import DefaultLogDriver from '../../helpers/docker/DefaultLogDriver';
import {
  bootloaderEnv,
  cronEnv,
  dbEnv,
  initEnv,
  serverEnv,
  temporalEnv,
  webappEnv,
  workerEnv
} from './environments/init';
import { TraefikLabels } from '../../helpers/docker/TraefikLabels';
import { HOSTNAME } from '../../constants';


export interface AirbyteArgs {
  vaultToken: string | pulumi.Output<string>,
  vaultHost: string | pulumi.Output<string>,
  ingressNetworkId: string | pulumi.Output<string>
}

export class Airbyte extends pulumi.ComponentResource {
  network: docker.Network


  services: {
    init?: docker.Service,
    bootloader?: docker.Service,
    db?: docker.Service,
    worker?: docker.Service,
    server?: docker.Service,
    webapp?: docker.Service,
    temporal?: docker.Service,
    cron?: docker.Service,
  }

  volumes: {
    workspace?: docker.Volume,
    db?: docker.Volume,
  }

  constructor(name: string, args: AirbyteArgs, opts?: pulumi.ComponentResourceOptions) {
    super("SprocketBot:Services:Airbyte", name, {}, opts)

    this.services = {}
    this.volumes = {}

    this.network = new docker.Network(`${name}-net`, {
      driver: 'overlay'
    }, { parent: this })

    this.volumes.db = new docker.Volume(`${name}-db-vol`, { }, { parent: this })
    this.volumes.workspace = new docker.Volume(`${name}-db-workspace`, { }, { parent: this })

    this.services.init = new docker.Service(`${name}-init`, {
      taskSpec: {
        containerSpec: {
          image: "airbyte/init:0.40.4",
          hostname: "init",
          commands: [
            "/bin/sh", "-c", "./scripts/create_mount_directories.sh /local_parent ${HACK_LOCAL_ROOT_PARENT} ${LOCAL_ROOT}"
          ],
          env: initEnv,
          mounts: [{
            type: "bind",
            source: initEnv.HACK_LOCAL_ROOT_PARENT,
            target: "/local_parent"
          }]
        },
        networks: [this.network.id],
        placement: {
          constraints: [
            "node.labels.role==airbyte",
          ]
        },
        logDriver: DefaultLogDriver(`${name}-init`, true),
      }
    }, { parent: this })

    this.services.db = new docker.Service(`${name}-db`, {
      taskSpec: {
        containerSpec: {
          image: "airbyte/db:0.40.4",
          hostname: "airbyte-db",
          env: dbEnv,
          mounts: [{
            type: "volume",
            source: this.volumes.db.id,
            target: "/var/lib/postgresql/data"
          }]
        },
        networks: [this.network.id],
        placement: {
          constraints: [
            "node.labels.role==airbyte",
          ]
        },
        logDriver: DefaultLogDriver(`${name}-db`, true)
      }
    }, { parent: this })

    this.services.worker = new docker.Service(`${name}-worker`, {
      taskSpec: {
        containerSpec: {
          image: "airbyte/worker:0.40.4",
          hostname: "airbyte-worker",
          env: {
            ...workerEnv,
            VAULT_AUTH_TOKEN: args.vaultToken,
            VAULT_ADDRESS: args.vaultHost
          },
          mounts: [{
            type: "bind",
            source: "/var/run/docker.sock",
            target: "/var/run/docker.sock",
          }, {
            type: "volume",
            source: this.volumes.workspace.id,
            target: workerEnv.WORKSPACE_ROOT
          }, {
            type: "bind",
            source: workerEnv.LOCAL_ROOT,
            target: workerEnv.LOCAL_ROOT
          }]
        },
        networks: [this.network.id],
        placement: {
          constraints: [
            "node.labels.role==airbyte",
          ]
        },
        logDriver: DefaultLogDriver(`${name}-worker`, true),

      }
    }, { parent: this })


    this.services.bootloader = new docker.Service(`${name}-bootloader`, {
      taskSpec: {
        containerSpec: {
          image: "airbyte/bootloader:0.40.4",
          hostname: "airbyte-bootloader",
          env: bootloaderEnv
        },
        networks: [this.network.id],
        placement: {
          constraints: [
            "node.labels.role==airbyte",
          ]
        },
        logDriver: DefaultLogDriver(`${name}-bootloader`, true),
      }
    })
    this.services.cron = new docker.Service(`${name}-cron`, {
      taskSpec: {
        containerSpec: {
          image: "airbyte/cron:0.40.4",
          hostname: "airbyte-cron",
          env: cronEnv,
          mounts: [{
            type: "volume",
            source: this.volumes.workspace.id,
            target: workerEnv.WORKSPACE_ROOT
          }]
        },
        networks: [this.network.id],
        placement: {
          constraints: [
            "node.labels.role==airbyte",
          ]
        },
        logDriver: DefaultLogDriver(`${name}-cron`, true),
      }
    })
    this.services.temporal = new docker.Service(`${name}-temporal`, {
      taskSpec: {
        containerSpec: {
          image: "airbyte/temporal:0.40.4",
          hostname: "airbyte-temporal",
          env: temporalEnv,
          mounts: [{
            type: "bind",
            source: "/opt/airbyte/temporal/dynamicconfig",
            target: "/etc/temporal/config/dynamicconfig"
          }]
        },
        networks: [this.network.id],
        placement: {
          constraints: [
            "node.labels.role==airbyte",
          ]
        },
        logDriver: DefaultLogDriver(`${name}-temporal`, true),
      }
    })
    this.services.webapp = new docker.Service(`${name}-webapp`, {
      labels: new TraefikLabels("airbyte")
        .tls("lets-encrypt-tls")
        .rule(`Host(\`airbyte.${HOSTNAME}\`)`)
        .forwardAuthRule("SprocketAdmin")
        .targetPort(8000)
        .complete,
      taskSpec: {
        containerSpec: {
          image: "airbyte/webapp:0.40.4",
          hostname: "airbyte-webapp",
          env: webappEnv,
        },
        networks: [this.network.id, args.ingressNetworkId],
        placement: {
          constraints: [
            "node.labels.role==airbyte",
          ]
        },
        logDriver: DefaultLogDriver(`${name}-webapp`, true),
      }
    })

    this.services.server = new docker.Service(`${name}-server`, {
      labels: new TraefikLabels("airbyte-server")
        .tls("lets-encrypt-tls")
        .rule(`Host(\`api.airbyte.${HOSTNAME}\`)`)
        .forwardAuthRule("SprocketAdmin")
        .targetPort(8001)
        .complete,
      taskSpec: {
        containerSpec: {
          image: "airbyte/server:0.40.4",
          hostname: "airbyte-server",
          env: {
            ...serverEnv,
            VAULT_AUTH_TOKEN: args.vaultToken,
            VAULT_ADDRESS: args.vaultHost
          }
        },
        networks: [this.network.id, args.ingressNetworkId],
        placement: {
          constraints: [
            "node.labels.role==airbyte",
          ]
        },
        logDriver: DefaultLogDriver(`${name}-server`, true),
      }
    })
  }
}
