# 404 Islands
#
# There is nothing to build and nothing to install: the application is static
# files plus a dependency-free Node server. The image is therefore just the
# runtime and the source.

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATA_DIR=/data

WORKDIR /srv

COPY package.json ./
COPY app ./app
COPY server ./server

# Reservations are the only state this process writes. Mount a volume here to
# keep them across deployments.
RUN mkdir -p /data && chown -R node:node /data /srv
VOLUME ["/data"]

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
