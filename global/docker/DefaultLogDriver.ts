export default (serviceName: string, isUtil: boolean) => ({
    name: "fluentd",
    options: {
        "fluentd-async": "true",
        tag: `docker.${isUtil ? "utils" : "microservices"}.${serviceName}`
    }
})