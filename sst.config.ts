import { SSTConfig } from "sst";
import { EvaraStack } from "./stacks/EvaraStack";

export default {
  config(_input) {
    return {
      name: "evara-backend",
      region: "ap-south-1",
    };
  },
  stacks(app) {
    if (app.stage !== "prod") {
      app.setDefaultRemovalPolicy("destroy");
    }
    app.stack(EvaraStack);
  },
} satisfies SSTConfig;
