import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 4000);

buildApp()
  .then((app) => app.listen({ port }))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
