export default (serviceName: string, isUtil: boolean) => ({
    name: "json-file",
    options: {
        "max-size": "10m",
        "max-file": "3"
    }
})