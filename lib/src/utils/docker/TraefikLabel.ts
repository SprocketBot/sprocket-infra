import * as docker from "@pulumi/docker";
import {EntryPoint} from "../../constants/traefik";
import {config} from "../../constants/pulumi";

abstract class TraefikLabel {
    private output: docker.types.input.ServiceLabel[] = [{
        label: "traefik.enable", value: "true"
    }]

    get complete() { return this.output }

    constructor(readonly name: string) {}

    protected abstract routerPrefix: string;
    protected abstract servicePrefix: string;
    protected abstract middlewarePrefix: string;

    protected routerLabel(key: string, value: string): docker.types.input.ServiceLabel {
        return {label: `${this.routerPrefix}.${key}`, value}

    }

    protected serviceLabel(key: string, value: string): docker.types.input.ServiceLabel {
        return {label: `${this.servicePrefix}.${key}`, value}
    }

    protected middlewareLabel(key: string, value: string): docker.types.input.ServiceLabel {
        return {label: `${this.middlewarePrefix}.${key}`, value}
    }

    rule(rule: string) {
        this.output.push(this.routerLabel("rule", rule))
        return this;
    }

    service(service: string) {
        this.output.push(this.routerLabel("service", service))
        return this;
    }
    entryPoints(entryPoints: EntryPoint | EntryPoint[]) {
        this.output.push(this.routerLabel("entryPoints", Array.isArray(entryPoints) ? entryPoints.join(",") : entryPoints))
        return this;
    }
    targetPort(port: number) {
        this.output.push(this.serviceLabel("loadbalancer.server.port", port.toString()))
        return this;
    }

    tls(certResolver: string) {
        this.output.push(this.routerLabel("tls", "true"));
        if (config.getBoolean("no-tls")) return this;
        this.output.push(this.routerLabel("tls.certResolver", certResolver))
        return this;
    }

}

export class TraefikHttpLabel extends TraefikLabel {
    readonly routerPrefix = `traefik.http.routers.${this.name}`
    readonly servicePrefix = `traefik.http.services.${this.name}`
    readonly middlewarePrefix = `traefik.http.middlewares.${this.name}`


    forwardAuthRule(ruleName: string) {
        return this;
    }
}

export class TraefikTcpLabel extends TraefikLabel {
    readonly routerPrefix = `traefik.tcp.routers.${this.name}`
    readonly servicePrefix = `traefik.tcp.services.${this.name}`
    readonly middlewarePrefix = `traefik.tcp.middlewares.${this.name}`
}