import * as pulumi from "@pulumi/pulumi";
import * as postgres from "@pulumi/postgresql";
import * as minio from "@pulumi/minio";
import * as doppler from "@pulumi/doppler";

import { DigitalOcean } from "./DigitalOcean";
import { Platform } from "./Platform";

const config = new pulumi.Config();

// For DigitalOcean standalone deployment, we create our own providers
// instead of depending on Layer1/Layer2 stack references

const dopplerProvider = new doppler.Provider("DopplerProvider", {
    token: pulumi.secret(process.env.DOPPLER_TOKEN || config.requireSecret("doppler-token"))
});

// Create a simple DigitalOcean-only platform without layer dependencies
export class DigitalOceanPlatform extends pulumi.ComponentResource {
    public readonly digitalOcean: DigitalOcean;
    public readonly loadBalancerIp: pulumi.Output<string>;

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:DigitalOceanPlatform", name, {}, opts);

        // Create DigitalOcean infrastructure first
        this.digitalOcean = new DigitalOcean(`${name}-do`, {
            region: config.get("do-region") || "nyc3",
            managerSize: config.get("do-manager-size") || "s-4vcpu-8gb",
            workerSize: config.get("do-worker-size") || "s-2vcpu-4gb",
            workerCount: parseInt(config.get("do-worker-count") || "2"),
        }, { parent: this });

        this.loadBalancerIp = this.digitalOcean.loadBalancerIp;

        // Export important values
        this.registerOutputs({
            loadBalancerIp: this.loadBalancerIp,
            managerIp: this.digitalOcean.managerIp,
            vpcId: this.digitalOcean.vpc.id,
        });
    }
}

// Create the standalone DigitalOcean platform
export const digitalOceanPlatform = new DigitalOceanPlatform(pulumi.getStack());

// Export key outputs
export const loadBalancerIp = digitalOceanPlatform.loadBalancerIp;
export const managerIp = digitalOceanPlatform.digitalOcean.managerIp;
export const vpcId = digitalOceanPlatform.digitalOcean.vpc.id;