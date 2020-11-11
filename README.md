# maeve
maeve keeps all bots together and stores it's information and also abstracts between different "species" such as rasa and robert

# quickstart

```zsh
npm i
npm start # or npm run dev 
```

# environment variables

|         name        |        description             |    default           |
|---------------------|--------------------------------|----------------------|
| ABOTKIT_MAEVE_PORT  | port for starting maeve        |   3000               |
| ABOTKIT_MAEVE_USE_KEYCLOAK | use keycloak as security mechanism | false |
| ABOTKIT_MAEVE_KEYCLOAK_HOST | host of a running keycloak instance | '' (e.g. http://localhost) |
| ABOTKIT_MAEVE_KEYCLOAK_PORT | port of a running keycloak instance | '' (e.g. 8080) |
| ABOTKIT_MAEVE_KEYCLOAK_REALM | your keycloak realm | '' (e.g. myrealm) |
| ABOTKIT_MAEVE_KEYCLOAK_CLIENT | your keycloak client id (name) | '' (e.g. myclient) |
