import { buildApp } from "./app";
import { startDeliveryWorker } from "./delivery";

const port = Number(process.env.PORT ?? 4000);

buildApp()
  .then(async (app) => {
    await app.listen({ port });
    // Task 018: inline delivery poll (no Redis/BullMQ in this env — same
    // documented gap as 017). See apps/api/src/delivery.ts.
    startDeliveryWorker(app.log);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
