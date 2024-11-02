import { Lambda } from 'aws-sdk';

const lambda = new Lambda({
  region: 'ap-south-1',
});

const invokeLambda = (
  functionName: string,
  payload: any,
  invocationType = undefined,
): Promise<any> => {
  let target: any = { FunctionName: functionName };
  if (invocationType) {
    target.InvocationType = invocationType;
  }

  if (typeof payload === 'object') {
    target.Payload = JSON.stringify(payload);
  } else if (typeof payload == 'string') {
    target.Payload = payload;
  }

  return new Promise((resolve, reject) => {
    lambda.invoke(target, (err: unknown, data: any) => {
      if (err) {
        reject(err);
      } else {
        data.Payload
          ? resolve(data.Payload)
          : resolve(JSON.stringify({ status: 'no-data' }));
      }
    });
  });
};

export default invokeLambda;
