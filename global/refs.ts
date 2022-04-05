import * as pulumi from "@pulumi/pulumi";

export const coreStack = new pulumi.StackReference("core", {name: "core"})
export const monitoringDatastoresStack = new pulumi.StackReference("monitoring-datastores", {name: "monitoring-datastores"})
export const monitoringApplicationsStack = new pulumi.StackReference("monitoring-applications", {name: "monitoring-applications"})

export const platformDatastoresStack = new pulumi.StackReference("platform-datastores", {name: "platform-datastores"})
export const platformDevStack = new pulumi.StackReference("platform-dev", {name: "platform-dev"})
export const platformProductionStack = new pulumi.StackReference("platform-production", {name: "platform-production"})

export const vaultStack = new pulumi.StackReference("vault-policies", {name: "vault-policies"})

export const stackLocations = [
    {
        name: "core",
        workDir: `${__dirname}/../core`
    },
    {
        name: "platform-datastores",
        workDir: `${__dirname}/../platform/datastores`
    },
    {
        name: "platform-dev",
        workDir: `${__dirname}/../platform/applications`
    },
    {
        name: "platform-production",
        workDir: `${__dirname}/../platform/applications`
    },
    {
        name: "monitoring-datastores",
        workDir: `${__dirname}/../monitoring/datastores`
    },
    {
        name: "monitoring-applications",
        workDir: `${__dirname}/../monitoring/applications`
    }
]