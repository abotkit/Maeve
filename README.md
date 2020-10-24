# maeve
maeve keeps all bots together and stores it's information and also abstracts between different "species" such as rasa and robert

# quickstart

```zsh
npm i
npm start # or npm run dev 
```

# environment variables

|         name        |        description             |    default           |
|-----------------------------------------------------------------------------|
| ABOTKIT_ROBERT_PORT | port for REST server of robert |   5000               |
| ABOTKIT_ROBERT_URL  | url for reaching robert        |   http://localhost   |
| ABOTKIT_MAEVE_PORT  | port for starting maeve        |   3000               |
