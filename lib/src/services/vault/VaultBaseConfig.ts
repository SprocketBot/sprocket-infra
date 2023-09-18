import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import {buildUrn, URN_TYPE} from "../../constants/pulumi";
import {Backend, setBackend} from "./backends";

export type VaultBaseConfigArgs = {
    unsealKeys: pulumi.Output<string[]>
}

export class VaultBaseConfig extends pulumi.ComponentResource {
    constructor(name: string, args: VaultBaseConfigArgs, opts?: pulumi.ComponentResourceOptions) {
        super(buildUrn(URN_TYPE.Configuration, "VaultBaseConfig"), name, {}, opts);

        const kvStore = new vault.Mount("kv", {
            type: "kv",
            path: `/${Backend.kv2}`,
            description: "Generic KeyValue store.",
            options: {
                version: "2"
            }
        }, {parent: this})

        setBackend(Backend.kv2, kvStore)

        const dbStore = new vault.database.SecretsMount("db", {
            path: Backend.db,
        }, {parent: this})

        setBackend(Backend.db, dbStore)


        const unsealKeysSecret = new vault.kv.SecretV2("unseal-keys-secret", {
            mount: kvStore.path,
            name: "sudo/vault/unseal-keys",
            dataJson: args.unsealKeys.apply(($keys: string[]) => JSON.stringify($keys.reduce((a, v, i) => ({
                ...a,
                [`Unseal Token ${i}`]: v
            }), {})))
        }, {parent: this})
    }
}