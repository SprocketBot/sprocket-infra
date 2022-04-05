export class TraefikLabels {
    get routerPrefix() { return `traefik.${this.type}.routers.${this.name}` }
    get servicePrefix() { return `traefik.${this.type}.services.${this.name}` }
    
    private routerLabel(key: string, value: string): { label: string, value: string } {
        return {
            label: `${this.routerPrefix}.${key}`,
            value: value
        }
    }

    private serviceLabel(key: string, value: string): { label: string, value: string } {
        return {
            label: `${this.servicePrefix}.${key}`,
            value: value
        }
    }

    constructor(readonly name: string, readonly type: "http" = "http") {}

    private output: {label: string, value: string}[] = [{
        label: "traefik.enable", value: "true"
    }]

    get complete(): {label: string, value: string}[] {
        return this.output;
    }

    rule(rule: string): TraefikLabels {
        this.output.push(this.routerLabel("rule", rule))

        return this;
    }

    service(service: string): TraefikLabels {
        this.output.push(this.routerLabel("service", service))
        return this;
    }

    entryPoints(entryPoints: string): TraefikLabels {
        this.output.push(this.routerLabel("entryPoints", entryPoints))
        return this;
    }

    tls(certResolver: string): TraefikLabels {
        this.output.push(this.routerLabel("tls", "true"));
        this.output.push(this.routerLabel("tls.certResolver", certResolver))
        return this;
    }

    targetPort(port: number): TraefikLabels {
        this.output.push(this.serviceLabel("loadbalancer.server.port", port.toString()))
        return this;
    }
}