import { SSTConfig } from "sst";
import { MainStack } from "./stacks/MainStack";
import { PharmacyApiStack } from "./stacks/PharmacyApiStack";

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
    app.stack(MainStack).stack(PharmacyApiStack);
  },
} satisfies SSTConfig;
