import * as pulumi from "@pulumi/pulumi";
import * as doppler from "@pulumi/doppler";

export type PlatformDopplerArgs = {
    environment: string;
    dopplerProvider: doppler.Provider;

    redis: {
        url: pulumi.Output<string>;
        password: pulumi.Output<string>;
    };
    rabbitmq: {
        url: pulumi.Output<string>;
        management: pulumi.Output<string>;
    };
    postgres: {
        url: pulumi.Output<string>;
        port: pulumi.Output<string>;
        database: pulumi.Output<string>;
    };
    postgresDataScience: {
        url: pulumi.Output<string>;
        port: pulumi.Output<string>;
        database: pulumi.Output<string>;
    };
    minio: {
        url: pulumi.Output<string>;
        accessKey: pulumi.Output<string>;
        secretKey: pulumi.Output<string>;
        bucket: pulumi.Output<string>;
        imageGenerationBucket: pulumi.Output<string>;
        replayBucket: pulumi.Output<string>;
    };
};

export class PlatformDoppler extends pulumi.ComponentResource {
    constructor(name: string, args: PlatformDopplerArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform:DopplerSync", name, {}, opts);

        const project = "sprocket"; // Or your Doppler project name

        const createSecrets = (config: string, secrets: { [key: string]: pulumi.Output<string> }) => {
            for (const [key, value] of Object.entries(secrets)) {
                new doppler.Secret(`${name}-${config}-${key}`, {
                    project: project,
                    config: args.environment,
                    name: `${config.toUpperCase()}_${key.toUpperCase()}`,
                    value: value,
                }, { parent: this, provider: args.dopplerProvider });
            }
        };

        createSecrets("redis", args.redis);
        createSecrets("rabbitmq", args.rabbitmq);
        createSecrets("postgres", args.postgres);
        createSecrets("postgres-data-science", args.postgresDataScience);
        createSecrets("minio", args.minio);
    }
}