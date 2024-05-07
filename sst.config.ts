import { SSTConfig } from "sst";
import { MainStack } from "./stacks/MainStack";
import { PharmacyApiStack } from "./stacks/PharmacyApiStack";
import { MastersApiStack } from "./stacks/MastersApiStack";

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
    app.stack(MainStack).stack(PharmacyApiStack).stack(MastersApiStack);
  },
} satisfies SSTConfig;
