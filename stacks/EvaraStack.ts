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
      "POST /patients/{id}/partner/add":
        "packages/functions/src/patients/addPartner.main",
      "POST /patients/add": "packages/functions/src/patients/addPatient.main",
      "GET /patients": "packages/functions/src/patients/getPatients.main",
      "GET /patients/{id}":
        "packages/functions/src/patients/getPatientById.main",
      "PUT /patients/{id}": "packages/functions/src/patients/editPatient.main",
    },
  });

  // Show the URLs in the output
  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
