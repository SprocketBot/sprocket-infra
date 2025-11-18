export default (serviceName: string, isUtil: boolean) => ({
    name: "json-file",
    options: {
        "max-size": "5m",      // Reduced from 10MB to 5MB
        "max-file": "5",       // Increased from 3 to 5 files
        "compress": "true"     // Enable compression to save space
    }
})