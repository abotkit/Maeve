# maeve
maeve keeps all bots together and stores it's information and also abstracts between different "species" such as rasa and robert

# Quickstart

```zsh
npm i
npm start # or npm run dev 
```

# Environment variables

|         name        |        description             |    default           |
|---------------------|--------------------------------|----------------------|
| ABOTKIT_MAEVE_PORT  | port for starting maeve        |   3000               |
| ABOTKIT_MAEVE_USE_KEYCLOAK | use keycloak as security mechanism | false |
| ABOTKIT_MAEVE_KEYCLOAK_HOST | host of a running keycloak instance | '' (e.g. http://localhost) |
| ABOTKIT_MAEVE_KEYCLOAK_PORT | port of a running keycloak instance | '' (e.g. 8080) |
| ABOTKIT_MAEVE_KEYCLOAK_REALM | your keycloak realm | '' (e.g. myrealm) |
| ABOTKIT_MAEVE_KEYCLOAK_CLIENT | your keycloak client id (name) | '' (e.g. myclient) |

# Issues

We use our [main repository](https://github.com/abotkit/abotkit) to track our issues. Please use [this site](https://github.com/abotkit/abotkit/issues) to report an issue. Thanks! :blush:
