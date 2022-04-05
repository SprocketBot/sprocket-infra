import * as pulumi from "@pulumi/pulumi"
import {Grafana} from "./grafana/Grafana";
import {coreStack, monitoringDatastoresStack, platformDatastoresStack} from "global/refs"
import {Fluentd} from "./fluentd/FluentD";
import {Telegraf} from "./telegraf/Telegraf";
import {VaultProvider} from "global/providers/VaultProvider"
import * as vault from "@pulumi/vault";

const monitoringNetworkId = monitoringDatastoresStack.requireOutput("monitoringNetworkId") as pulumi.Output<string>;
const postgresNetworkId = platformDatastoresStack.requireOutput("postgresNetworkId") as pulumi.Output<string>;
const postgresHostname = platformDatastoresStack.requireOutput("postgresHostname") as pulumi.Output<string>
const redisNetworkId = platformDatastoresStack.requireOutput("redisNetworkId") as pulumi.Output<string>
const redisHostname = platformDatastoresStack.requireOutput("redisHostname") as pulumi.Output<string>
const rabbitNetworkId = platformDatastoresStack.requireOutput("rabbitNetworkId") as pulumi.Output<string>
const rabbitHostname = platformDatastoresStack.requireOutput("rabbitHostname") as pulumi.Output<string>

const grafana = new Grafana("grafana", {
    monitoringNetworkId,
    ingressNetworkId: coreStack.requireOutput("ingressNetwork") as pulumi.Output<string>,
    postgresNetworkId,
})

const fluentd = new Fluentd("fluent", {
    monitoringNetworkId,
    configFilePath: `${__dirname}/config/fluentd.conf`
})

const replicatedTelegraf = new Telegraf("replicated-telegraf", {
    additionalNetworkIds: [
        postgresNetworkId,
        redisNetworkId,
        rabbitNetworkId
    ],
    postgresHost: postgresHostname,
    configFilePath: `${__dirname}/config/telegraf.conf`,
    monitoringNetworkId: monitoringNetworkId,
    additionalEnvironmentVariables: {
        RABBIT_HOST: rabbitHostname,
        REDIS_HOST: redisHostname,
        REDIS_PASSWORD: vault.generic.getSecretOutput({path: "infrastructure/redis"}, {provider: VaultProvider}).apply(s => s.data.password) as pulumi.Output<string>,
    }

})