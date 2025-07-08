# Sprocket Application Summaries

This document provides a summary of each application within the Sprocket monorepo, focusing on its dependencies and build process.

## `core`

*   **Description:** This is a NestJS application written in TypeScript that appears to be the primary backend service.
*   **Dependencies:**
    *   **Package Manager:** npm
    *   **Build System:** The `nest` CLI is used to build the application.
    *   **Dockerfile:** A multi-stage Dockerfile is present. It defines a `test_image` to run tests and an `app_image` that runs the final application.
    *   **Database:** It uses TypeORM with the `pg` driver, indicating a PostgreSQL database. Database migrations are located in the `migrations` directory.
    *   **Authentication:** It uses `passport` for authentication, with strategies for Discord, Google, and JWTs.
    *   **API:** It exposes a GraphQL API using `@nestjs/graphql` and `apollo-server-express`.
    *   **Job Queue:** It uses `@nestjs/bull`, a Redis-based queue system.
    *   **Other:** It has a dependency on `@sprocketbot/common`, a local package, and uses the `config` library for configuration.
*   **CI/CD:** The GitHub Actions workflow builds a Docker image for the application and deploys it with Pulumi.

## `discord-bot`

*   **Description:** This is a NestJS application written in TypeScript that connects to Discord.
*   **Dependencies:**
    *   **Package Manager:** npm
    *   **Build System:** The `nest` CLI is used to build the application.
    *   **Dockerfile:** A multi-stage Dockerfile is present. It defines a `test_image` to run tests and an `app_image` that runs the final application.
    *   **Discord:** It uses the `discord.js` library to interact with the Discord API.
    *   **Other:** It has a dependency on `@sprocketbot/common`, a local package, and uses the `config` library for configuration.
*   **CI/CD:** The GitHub Actions workflow builds a Docker image for the application and deploys it with Pulumi.

## `web`

*   **Description:** This is a SvelteKit application written in TypeScript, likely serving as the main web frontend.
*   **Dependencies:**
    *   **Package Manager:** npm
    *   **Build System:** `vite` is used to build the application.
    *   **Dockerfile:** A multi-stage Dockerfile is present. It defines a `test_image` to run tests and an `app_image` that runs the final application using `node`.
    *   **API:** It uses `@urql/core` to communicate with a GraphQL API.
    *   **Styling:** It uses `tailwindcss` and `daisyui` for styling.
*   **CI/CD:** The GitHub Actions workflow builds a Docker image for the application and deploys it with Pulumi.

## `image-generation-service`

*   **Description:** This is a NestJS application written in TypeScript that appears to be responsible for generating images.
*   **Dependencies:**
    *   **Package Manager:** npm
    *   **Build System:** The `nest` CLI is used to build the application.
    *   **Dockerfile:** A Dockerfile is present. It installs `fontconfig` and copies a `fonts.conf` file, indicating that it works with fonts. It runs the final application using `node`.
    *   **Image Manipulation:** It uses the `sharp` library for image manipulation.
    *   **Message Queue:** It uses `amqp-connection-manager` and `amqplib`, indicating that it communicates with a RabbitMQ message broker.
    *   **Storage:** It uses the `minio` library, suggesting it interacts with a Minio object storage server.
    *   **Other:** It uses the `config` library for configuration.
*   **CI/CD:** The GitHub Actions workflow builds a Docker image for the application and deploys it with Pulumi.

## `matchmaking-service`

*   **Description:** This is a NestJS application written in TypeScript that appears to be responsible for matchmaking.
*   **Dependencies:**
    *   **Package Manager:** npm
    *   **Build System:** The `nest` CLI is used to build the application.
    *   **Dockerfile:** A Dockerfile is present. It runs the final application using `node`.
    *   **Job Queue:** It uses `@nestjs/bull`, a Redis-based queue system.
    *   **Message Queue:** It uses `amqp-connection-manager` and `amqplib`, indicating that it communicates with a RabbitMQ message broker.
    *   **Other:** It has a dependency on `@sprocketbot/common`, a local package, and uses the `config` library for configuration. It also uses `ioredis`.
*   **CI/CD:** The GitHub Actions workflow builds a Docker image for the application and deploys it with Pulumi.

## `replay-parse-service`

*   **Description:** This is a Python application that appears to be responsible for parsing replay files.
*   **Dependencies:**
    *   **Package Manager:** pip
    *   **Build System:** The Dockerfile installs dependencies from `requirements.txt`.
    *   **Dockerfile:** A Dockerfile is present. It uses a `python:3.8-slim` base image and runs the application with a `start.sh` script.
    *   **Replay Parsing:** It uses `boxcars-py`, `carball`, and `python-ballchasing` to parse replay files.
    *   **Message Queue:** It uses `celery` and `amqp`, indicating that it communicates with a RabbitMQ message broker.
    *   **Storage:** It uses the `minio` library, suggesting it interacts with a Minio object storage server.
    *   **Other:** It uses `redis`, `pandas`, and `numpy`.
*   **CI/CD:** The GitHub Actions workflow builds a Docker image for the application and deploys it with Pulumi.

## `server-analytics-service`

*   **Description:** This is a NestJS application written in TypeScript that appears to be responsible for server analytics.
*   **Dependencies:**
    *   **Package Manager:** npm
    *   **Build System:** The `nest` CLI is used to build the application.
    *   **Dockerfile:** A Dockerfile is present. It runs the final application using `node`.
    *   **Message Queue:** It uses `amqp-connection-manager` and `amqplib`, indicating that it communicates with a RabbitMQ message broker. It also lists `nats` as a dependency.
    *   **Database:** It uses `@influxdata/influxdb-client`, indicating it communicates with an InfluxDB time-series database.
    *   **Other:** It has a dependency on `@sprocketbot/common`, a local package, and uses the `config` library for configuration.
*   **CI/CD:** The GitHub Actions workflow builds a Docker image for the application and deploys it with Pulumi.

## `notification-service`

*   **Description:** This is a NestJS application written in TypeScript that appears to be responsible for sending notifications.
*   **Dependencies:**
    *   **Package Manager:** npm
    *   **Build System:** The `nest` CLI is used to build the application.
    *   **Dockerfile:** A Dockerfile is present. It runs the final application using `node`.
    *   **Other:** It has a dependency on `date-fns-tz` for time zone support.
*   **CI/CD:** The GitHub Actions workflow builds a Docker image for the application and deploys it with Pulumi.

## `submission-service`

*   **Description:** This is a NestJS application written in TypeScript that appears to be responsible for handling submissions.
*   **Dependencies:**
    *   **Package Manager:** npm
    *   **Build System:** The `nest` CLI is used to build the application.
    *   **Dockerfile:** A Dockerfile is present. It runs the final application using `node`.
    *   **Message Queue:** It uses `amqp-connection-manager` and `amqplib`, indicating that it communicates with a RabbitMQ message broker.
    *   **Other:** It has a dependency on `@sprocketbot/common`, a local package, and uses the `config` library for configuration. It also uses `ioredis`.
*   **CI/CD:** The GitHub Actions workflow builds a Docker image for the application and deploys it with Pulumi.

## `image-generation-frontend`

*   **Description:** This is a SvelteKit application written in TypeScript, likely serving as a frontend for the image generation service.
*   **Dependencies:**
    *   **Package Manager:** npm
    *   **Build System:** `vite` is used to build the application.
    *   **Dockerfile:** A multi-stage Dockerfile is present. It defines a `test_image` to run tests and an `app_image` that runs the final application using `node`.
    *   **Message Queue:** It uses `amqplib` and `nats`, indicating that it communicates with a message broker.
    *   **Storage:** It uses the `minio` library, suggesting it interacts with a Minio object storage server.
    *   **Database:** It uses `knex` and `pg`, indicating it communicates with a PostgreSQL database.
    *   **Styling:** It uses `tailwindcss`.
*   **CI/CD:** The GitHub Actions workflow builds a Docker image for the application and deploys it with Pulumi.

## Overall Architecture

*   **Monorepo:** The project is a monorepo containing multiple applications and a shared `common` library.
*   **Technology Stack:**
    *   **Backend:** The majority of the backend services are built with NestJS (TypeScript/Node.js).
    *   **Frontend:** The web frontends are built with SvelteKit (TypeScript).
    *   **Replay Parsing:** A Python service handles replay parsing.
*   **Microservices:** The application is structured as a set of microservices that communicate with each other, primarily via a RabbitMQ message broker.
*   **Containerization:** All applications are containerized using Docker. A base `node` image is used for all Node.js applications, and a `python` image is used for the replay parser.
*   **CI/CD:** GitHub Actions are used for continuous integration and deployment. The workflow builds Docker images for each service and pushes them to a container registry.
*   **Infrastructure as Code (IaC):** Deployment is handled by Pulumi, which manages the infrastructure as code. The Pulumi configuration is stored in a separate `sprocket-infra` repository.
*   **Data Stores:**
    *   **Primary Database:** PostgreSQL
    *   **Time Series:** InfluxDB
    *   **Caching & Job Queue:** Redis
    *   **Object Storage:** Minio
*   **Messaging:**
    *   **Primary Broker:** RabbitMQ (AMQP)
    *   **Secondary Broker:** NATS
*   **Authentication:** The `core` service handles authentication using Passport.js with strategies for Discord, Google, and JWT.
*   **API:** The `core` service exposes a public-facing GraphQL API.