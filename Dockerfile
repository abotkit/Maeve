FROM node:alpine3.10

RUN apk update
RUN apk add openssl

COPY package.json /opt/abotkit-server/package.json
WORKDIR /opt/abotkit-server

RUN npm install

COPY . /opt/abotkit-server/
RUN chmod -R 777 /opt/abotkit-server/
EXPOSE 3000

ENV ABOTKIT_MAEVE_USE_KEYCLOAK=true
ENV ABOTKIT_MAEVE_KEYCLOAK_HOST=http://localhost
ENV ABOTKIT_MAEVE_KEYCLOAK_PORT=8080
ENV ABOTKIT_MAEVE_KEYCLOAK_REALM=abotkit
ENV ABOTKIT_MAEVE_KEYCLOAK_CLIENT=dolores

ENTRYPOINT ["npm", "run", "start"]