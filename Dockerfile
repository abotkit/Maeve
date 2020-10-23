FROM node:alpine3.10

COPY package.json /opt/abotkit-server/package.json
WORKDIR /opt/abotkit-server

RUN npm install

COPY . /opt/abotkit-server/
EXPOSE 3000

ENTRYPOINT ["npm", "run", "start"]