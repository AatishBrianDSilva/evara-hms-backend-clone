import { Api, StackContext } from "sst/constructs";

export function EvaraStack({ stack }: StackContext) {
  // Add your first construct

  const api = new Api(stack, "Api", {
    defaults: {
      function: {
        timeout: "60 seconds",
        permissions: ["secretsmanager", "sns", "sqs", "lambda"],
      },
    },
    routes: {
      "POST /patients/add": "packages/functions/src/addPatient.main",
    },
  });

  // Show the URLs in the output
  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
