FROM openjdk:17-slim

RUN groupadd -g 1001 sandboxgroup && \
    useradd -u 1001 -g sandboxgroup -m -s /sbin/nologin sandboxuser

WORKDIR /sandbox

# Download JUnit standalone console runner
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    curl -sSL https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/1.10.1/junit-platform-console-standalone-1.10.1.jar -o /opt/junit-platform-console-standalone.jar && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

RUN chown -R sandboxuser:sandboxgroup /sandbox

USER sandboxuser

CMD ["java", "-version"]

