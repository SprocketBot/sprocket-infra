export default (serviceName: string, category: ) => ({
    name: "fluentd",
    options: {
        "fluentd-async": "true",
        tag: `docker.${isUtil ? "utils" : "microservices"}.${serviceName}`
    }
})