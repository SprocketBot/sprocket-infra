import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import {buildUrn, URN_TYPE} from "../../constants/pulumi";


export type VaultBaseConfigArgs = {
    unsealKeys: pulumi.Output<string[]>
}

export class VaultBaseConfig extends pulumi.ComponentResource {
    constructor(name: string, args: VaultBaseConfigArgs, opts?: pulumi.ComponentResourceOptions) {
        super(buildUrn(URN_TYPE.Configuration, "VaultBaseConfig"), name, {}, opts);

        const kvStore = new vault.Mount("kv", {
            type: "kv",
            path: "/kv",
            description: "Generic KeyValue store."
        }, {parent: this})

        const unsealKeysSecret = new vault.kv.Secret("unseal-keys-secret", {
            path: kvStore.path.apply($path => `${$path}/admin/vault/unseal-keys`),
            dataJson: args.unsealKeys.apply(($keys: string[]) => JSON.stringify($keys.reduce((a, v, i) => ({
                ...a,
                [`Unseal Token ${i}`]: v
            }), {})))
        }, {parent: this})


    }
}