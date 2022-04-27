import * as pulumi from "@pulumi/pulumi"
import {ComponentResourceOptions} from "@pulumi/pulumi"
import * as docker from "@pulumi/docker"

import {DockerProvider} from "global/providers/DockerProvider"
import {ConfigFile, ConfigFileArgs} from "global/helpers/docker/ConfigFile"
import {getImageSha} from "global/helpers/docker/getImageSha"
import * as handlebars from "handlebars";

const config = new pulumi.Config();


type SecretSpec = docker.types.input.ServiceTaskSpecContainerSpecSecret[]
type EnvSpec = docker.types.input.ServiceTaskSpecContainerSpec["env"]
type ConfigSpec = docker.types.input.ServiceTaskSpecContainerSpecConfig
type LabelSpec = docker.types.input.ServiceLabel

type ConfigInput = {
    sourceFilePath: string,
    destFilePath?: string,
    transformation?: ConfigFileArgs["transformation"]
};

type AdditionalConfigInput = ConfigInput & { destFilePath: string }

export type SprocketServiceConfigTemplateValues = {
    rmq: {
        host: string,
    },
    database: {
        host: string,
        port: number,
        passwordSecretId: string,
        username: string,
        database: string
    },
    s3: {
        endpoint: string,
        port: number,
        ssl: boolean,
        accessKey: string,
        bucket: string
    },
    celery: {
        broker: string,
        backend: string,
        queue: string
    },
    bot: {
        prefix: string
    },
    gql: {
        host: string
    }
}

export type SprocketServiceArgs = {
    image: {
        namespace: string,
        repository: string,
        tag: string
    },
    platformNetworkId: docker.Network["id"],

    configFile: ConfigInput

    configValues: SprocketServiceConfigTemplateValues

    flags?: {
        database?: boolean
    },

    // Arbitrary Properties
    networks?: docker.Network["id"][],
    secrets?: SecretSpec
    env?: EnvSpec
    additionalConfigs?: AdditionalConfigInput[]
    labels?: LabelSpec[]
}

export class SprocketService extends pulumi.ComponentResource {
    private readonly service: docker.Service
    private readonly coreConfig: ConfigFile

    constructor(name: string, args: SprocketServiceArgs, opts?: ComponentResourceOptions) {
        super("SprocketBot:Application:Microservice", name, {}, opts);

        this.applyConfigurationValues = (fileContent: string) => {
            return handlebars.compile(fileContent)(args.configValues)
        }

        const secrets: docker.types.input.ServiceTaskSpecContainerSpecSecret[] = [];
        const networks: docker.Network["id"][] = [];
        const environment: EnvSpec = {}

        this.coreConfig = new ConfigFile(`${name}-config`, {
            filepath: args.configFile.sourceFilePath,
            transformation: x => args.configFile.transformation ? args.configFile.transformation(this.applyConfigurationValues(x)) : pulumi.output(this.applyConfigurationValues(x))
        }, { parent: this })

        const configs: ConfigSpec[] = [
            {
                configId: this.coreConfig.id,
                configName: this.coreConfig.name,
                fileName: args.configFile.destFilePath ?? "/app/config/production.json"
            },
            ...this.buildConfigs(args.additionalConfigs)
        ]

        if (args.flags?.database) {
            secrets.push({
                fileName: "/app/secret/db-password",
                secretId: args.configValues.database.passwordSecretId
            })
        }

        this.service = new docker.Service(`${name}-service`, {
            auth: {
                username: config.require("docker-username"),
                password: config.requireSecret("docker-access-token"),
                serverAddress: "https://docker.io"
            },
            taskSpec: {
                containerSpec: {
                    image: pulumi.all([config.require("docker-username"), config.requireSecret("docker-access-token")])
                        .apply(([username, pat]) => getImageSha(args.image.namespace, args.image.repository, args.image.tag, username, pat)),
                    secrets: [
                        ...secrets,
                        ...(args.secrets ?? [])
                    ],
                    env: {
                        ...environment,
                        ...(args.env ?? {})
                    },
                    configs
                },
                networks: [
                    args.platformNetworkId,
                    ...networks,
                    ...(args.networks ?? [])
                ]
            },
            labels: args.labels
        }, {parent: this, provider: DockerProvider})
    }

    applyConfigurationValues: (fileContent: string) => string;

    buildConfigs(configs: AdditionalConfigInput[] | undefined) {
        if (!configs) return [];

        return configs.map<ConfigSpec>(
            ({
                 sourceFilePath,
                 destFilePath,
                 transformation
             }) => {
                const filename = sourceFilePath.split("/").pop()
                const config = new ConfigFile(`${name}-${filename}`, {
                    filepath: sourceFilePath,
                    transformation: (x) => transformation ? transformation(this.applyConfigurationValues(x)) : pulumi.output(this.applyConfigurationValues(x))
                }, {parent: this})

                return {
                    configId: config.id,
                    configName: config.name,
                    fileName: destFilePath
                }
            })
    }

}