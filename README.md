# ITMO Buddy Frontend

Студенческий веб-сервис для поиска команды, общения и мероприятий. Доступны регистрация, вход, собственный и публичный профиль, загрузка фото и редактирование анкеты со справочниками.

## Локальный запуск

Нужен Node.js 20.19+ в ветке 20 либо 22.12+ и npm. Для локального HTTPS нужен сертификат с SAN `localhost`, которому доверяет браузер. Например, при установленном mkcert:

```sh
npm ci
cp .env.example .env.local
mkdir -p .cert
mkcert -install
mkcert -cert-file .cert/localhost.pem -key-file .cert/localhost-key.pem localhost
npm run dev
```

Откройте [https://localhost:5173](https://localhost:5173). Переменные `DEV_TLS_CERT` и `DEV_TLS_KEY` задают пути к сертификату и ключу. Порт фиксирован, поскольку он входит в origin, проверяемый Backend. `VITE_API_ORIGIN` содержит публичный HTTPS origin REST API. Чтение TLS-файлов выполняется только при запуске dev-сервера.

## Backend

Контракты сверены с коммитом `6c8997b74ae2394797eb0fc1493ad2f22bd5d554` ветки `feature/IB-007`. Для Docker-запуска выполните `./scripts/dev-up.sh` из корня Backend и настройте доверие к CA Caddy по его инструкции. API по умолчанию доступен на [https://localhost:8443](https://localhost:8443), OpenAPI на [https://localhost:8443/openapi/v1.json](https://localhost:8443/openapi/v1.json). Проверьте, что в CORS разрешён `https://localhost:5173`. Используйте `localhost` для обоих сервисов. [Backend и инструкция по Docker](https://github.com/PrIIIcKoLyAZZZ/ITMO-Buddy-backend/tree/6c8997b74ae2394797eb0fc1493ad2f22bd5d554)

Access token хранится в оперативной памяти вкладки. Браузер отправляет HttpOnly refresh-cookie в credentialed запросах авторизации. При перезагрузке выполняется refresh, а параллельные ответы 401 в пределах вкладки используют один refresh-запрос. У защищённого запроса есть одна повторная попытка после refresh. При выходе очищается TanStack Query и сервер отзывает refresh-сессию. Ошибку выхода можно повторить с экрана состояния.

Если проверка сессии завершается сетевой ошибкой, проверьте готовность Backend, доверие к его CA и совпадение HTTPS origin с настройкой CORS, затем повторите запрос.

## Проверки и сборка

```sh
npm run typecheck
npm run lint
npm run build
git diff --check
```

Готовые статические файлы находятся в `dist/`. HTTPS-хостинг должен возвращать `index.html` для клиентских маршрутов. Перед сборкой задайте origin API для целевого окружения и разрешите соответствующий origin приложения в Backend.

`src/api` содержит HTTP-клиент и DTO, `src/auth` — формы и сессию, `src/components` — AppShell и общие компоненты, `src/profile` — профили, форма анкеты и справочники, `src/routes.tsx` — маршруты.

Если на macOS уже доверен сертификат ASP.NET Core для localhost, можно использовать его вместо mkcert. Выполните `dotnet dev-certs https --check --trust`, затем экспортируйте PEM командой `dotnet dev-certs https --export-path .cert/aspnet.pem --format PEM --no-password`. Ограничьте доступ к ключу командой `chmod 600 .cert/aspnet.key` и укажите оба пути в `.env.local`.
