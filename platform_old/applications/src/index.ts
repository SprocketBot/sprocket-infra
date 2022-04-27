import * as pulumi from "@pulumi/pulumi";
import {SprocketMicroservice} from "./microservices/SprocketMicroservice";
import {platformDatastoresStack} from "global/refs";


const rabbitHostname = platformDatastoresStack.requireOutput("rabbitHostname") as pulumi.Output<string>;

const serverAnalyticsService = new SprocketMicroservice("ServerAnalytics", {
    image: "actualsovietshark/server-analytics-service:main"
})

const imageGenerationService = new SprocketMicroservice("ImageGeneration", {
    image: "actualsovietshark/image-generation-service:main"
})

const matchmakingService = new SprocketMicroservice("MatchmakingService", {
    image: "actualsovietshark/matchmaking-service:main"
})

const replayParseService = new SprocketMicroservice("ReplayParseService", {
    image: "actualsovietshark/replay-parse-service:main",
    configs: [{
        sourceFilePath: `${__dirname}/config/replay-parse-service/development.json`,
        destFilePath: `/app/config/development.json`,
        transformation: x => rabbitHostname.apply(h => x.replace("${{rabbitmq}}", h))
    }]
})