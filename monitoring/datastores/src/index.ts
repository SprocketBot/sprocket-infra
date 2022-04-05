import * as docker from "@pulumi/docker";
import {Influx} from "./influx/Influx";
import {Loki} from "./loki/Loki";

const monitoringNetwork = new docker.Network("monitoring-network", { driver: "overlay" })

const influxDb = new Influx("influx", {
    monitoringNetworkId: monitoringNetwork.id,
    exposeUi: true
})

const loki = new Loki("loki", {
    monitoringNetworkId: monitoringNetwork.id
})

export const monitoringNetworkId = monitoringNetwork.id