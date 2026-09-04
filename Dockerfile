# ─── STAGE 1: Build the React frontend ───
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json* ./

RUN npm install

COPY frontend/ .

RUN npm run build

# ─── STAGE 2: Build the Spring Boot backend ───
FROM eclipse-temurin:17-jdk-jammy AS backend-build

WORKDIR /app

COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Make the Maven wrapper executable — Git on Windows can strip the +x bit,
# which makes Render's strict Linux build fail with "Permission denied".
RUN chmod +x mvnw

RUN ./mvnw dependency:go-offline

COPY src src

COPY --from=frontend-build /frontend/dist src/main/resources/static

RUN ./mvnw package -DskipTests


# ─── STAGE 3: Runtime (minimal image) ───
FROM eclipse-temurin:17-jre-jammy AS runtime

WORKDIR /app

COPY --from=backend-build /app/target/recovery-agent-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]