import * as pulumi from "@pulumi/pulumi";

declare global {
    type Outputable<T> = T | pulumi.Output<T>
}
