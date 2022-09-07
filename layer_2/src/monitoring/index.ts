import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";

import {Influx, Loki, Grafana, GrafanaArgs, Fluentd, Telegraf, Postgres} from "global/services";
import {PostgresUser} from "global/helpers/datastore/PostgresUser"

export type MonitoringArgs = {
    exposeInfluxUi: boolean,
    postgres: Postgres,
    ingressNetworkId: docker.Network["id"],
    providers: GrafanaArgs["providers"]
}

export class Monitoring extends pulumi.ComponentResource {
    // Datastores
    readonly influx: Influx;
    readonly loki: Loki;

    // Applications
    readonly grafana: Grafana
    readonly fluent: Fluentd;
    readonly telegraf: Telegraf
    readonly telegrafManager: Telegraf

    readonly network: docker.Network;

    constructor(name: string, {postgres, exposeInfluxUi, ingressNetworkId, providers}: MonitoringArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Monitoring", name, {}, opts)

        this.network = new docker.Network(`${name}-network`, { driver: "overlay"}, { parent: this })

        this.influx = new Influx("influx", {
            monitoringNetworkId: this.network.id,
            exposeUi: exposeInfluxUi,
            ingressNetworkId: ingressNetworkId,
            vaultProvider: providers.vault
        }, { parent: this })

        this.loki = new Loki("loki", {
            monitoringNetworkId: this.network.id
        }, { parent: this })

        this.grafana = new Grafana("grafana", {
            monitoringNetworkId: this.network.id,
            ingressNetworkId: ingressNetworkId,
            postgresNetworkId: postgres.networkId,
            postgresHostname: postgres.hostname,
            providers
        }, { parent: this })

        this.fluent = new Fluentd("fluent", {
            monitoringNetworkId: this.network.id,
            configFilePath: `${__dirname}/config/fluentd.conf`
        }, { parent: this })


        const telegrafPgUser = new PostgresUser(`${name}-pg-user`, {
            username: `${name}-telegraf`,
            providers: { vault: providers.vault, postgres: providers.postgres}
        }, { parent: this })


        this.telegraf = new Telegraf("telegraf", {
            additionalNetworkIds: [],
            configFilePath: `${__dirname}/config/telegraf.global.conf`,
            monitoringNetworkId: this.network.id,
            additionalEnvironmentVariables: {},
            influxToken: this.influx.credentials.password,
            options: {
                isGlobal: true,
                mountDockerSocket: true
            }
        }, { parent: this })

        this.telegrafManager = new Telegraf("manager-telegraf", {
            additionalNetworkIds: [
                postgres.networkId,
            ],
            configFilePath: `${__dirname}/config/telegraf.docker-manager.conf`,
            monitoringNetworkId: this.network.id,
            additionalEnvironmentVariables: {
                POSTGRES_HOST: postgres.hostname,
                POSTGRES_USER: telegrafPgUser.username,
                POSTGRES_PASSWORD: telegrafPgUser.password,
            },
            options: {
                managerOnly: true,
                mountDockerSocket: true
            },
            influxToken: this.influx.credentials.password
        }, { parent: this })
    }
}
