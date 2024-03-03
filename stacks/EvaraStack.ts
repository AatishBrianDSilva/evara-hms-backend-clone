import { Api, StackContext } from "sst/constructs";

export function EvaraStack({ stack }: StackContext) {
  // Add your first construct

  const api = new Api(stack, "Api", {
    defaults: {
      function: {
        timeout: "60 seconds",
      },
    },
    routes: {
      "POST /patients/add": "packages/functions/src/patients/addPatient.main",
      "GET /patients": "packages/functions/src/patients/getPatients.main",
    },
  });

  // Show the URLs in the output
  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
