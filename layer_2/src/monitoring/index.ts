import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";

import {Postgres} from "global/services";
import {Influx, Loki, Grafana, GrafanaArgs, Fluentd, Telegraf} from "global/services";

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
    readonly telegraf_replicated: Telegraf

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

        this.telegraf_replicated = new Telegraf("replicated-telegraf", {
            additionalNetworkIds: [
                postgres.networkId,
            ],
            postgresHost: postgres.hostname,
            configFilePath: `${__dirname}/config/telegraf.conf`,
            monitoringNetworkId: this.network.id,
            additionalEnvironmentVariables: {},
            providers,
            influxToken: this.influx.credentials.password
        }, { parent: this })
    }
}
