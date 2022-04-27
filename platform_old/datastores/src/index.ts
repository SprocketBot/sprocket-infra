import {Postgres} from "./postgres/Postgres";
import {Redis} from "./redis/Redis";
import {RabbitMq} from "./rabbitmq/RabbitMq";


const postgres = new Postgres("postgres", {})
const redis = new Redis("redis", {
    configFilepath: `${__dirname}/config/redis.conf`
})
const rabbitmq = new RabbitMq("rabbitmq", {
    configFilepath: `${__dirname}/config/rabbitmq.conf`
})

export const postgresNetworkId = postgres.networkId
export const postgresHostname = postgres.hostname

export const redisNetworkId = redis.networkId
export const redisHostname = redis.hostname

export const rabbitNetworkId = rabbitmq.networkId
export const rabbitHostname = rabbitmq.hostname