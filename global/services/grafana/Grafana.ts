import * as pulumi from "@pulumi/pulumi"
import * as docker from "@pulumi/docker";
import * as postgres from "@pulumi/postgresql";
import * as vault from "@pulumi/vault"

import {HOSTNAME} from "../../constants";
import {TraefikLabels} from "../../helpers/docker/TraefikLabels"
import DefaultLogDriver from "../../helpers/docker/DefaultLogDriver"
import {PostgresUser} from "../../helpers/datastore/PostgresUser"


export interface GrafanaArgs {
    monitoringNetworkId: docker.Network["id"],
    ingressNetworkId: docker.Network["id"],
    postgresNetworkId: docker.Network["id"],
    additionalNetwokIds?: docker.Network["id"][],
    postgresHostname: docker.Service["name"]

    providers: {
        vault: vault.Provider,
        postgres: postgres.Provider
    }
}

export class Grafana extends pulumi.ComponentResource {
    private readonly dbUser: PostgresUser

    private readonly db: postgres.Database
    private readonly service: docker.Service

    constructor(name: string, args: GrafanaArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Grafana", name, {}, opts)

        this.dbUser = new PostgresUser(`${name}-db-user`, {
            username: "Grafana",
            providers: args.providers
        }, { parent: this })

        this.db = new postgres.Database(`${name}-db`, {
            name: name,
            owner: this.dbUser.username
        }, { parent: this, provider: args.providers.postgres, dependsOn: [this.dbUser] })


        this.service = new docker.Service(`${name}-service`, {
            labels: new TraefikLabels(name)
                .rule(`Host(\`grafana.${HOSTNAME}\`)`)
                .tls("lets-encrypt-tls")
                .targetPort(3000)
                .complete,
            taskSpec: {
                placement: {
                    constraints: [
                        "node.labels.role!=ingress"
                    ]
                },
                containerSpec: {
                    image: "grafana/grafana:8.4.4",
                    env: {
                        GF_SERVER_ROOT_URL: `https://grafana.${HOSTNAME}`,
                        GF_DATABASE_TYPE: "postgres",
                        GF_DATABASE_HOST: args.postgresHostname,
                        GF_DATABASE_NAME: this.db.name,
                        GF_DATABASE_USER: this.dbUser.username,
                        GF_DATABASE_PASSWORD: this.dbUser.password
                    },
                },
                logDriver: DefaultLogDriver(name, true),
                networks: [
                    args.monitoringNetworkId,
                    args.ingressNetworkId,
                    args.postgresNetworkId,
                    ...args.additionalNetwokIds ?? []
                ]
            },
        }, { parent: this })
    }
}
