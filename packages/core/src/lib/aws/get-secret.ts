import { SecretsManager, AWSError } from 'aws-sdk';

// Define the AWS region
const region = 'ap-south-1';

// Create a Secrets Manager client
const client = new SecretsManager({ region });

/**
 * Fetches a secret from AWS Secrets Manager.
 * @param secretName The name of the secret to retrieve.
 * @returns The secret as a string.
 * @throws Error if there is any issue in fetching the secret
 */
const getSecret = async (secretName: string): Promise<string> => {
  try {
    const data = await client
      .getSecretValue({ SecretId: secretName })
      .promise();

    if ('SecretString' in data) {
      return data.SecretString || ''; // Return the secret string or an empty string if null.
    } else if ('SecretBinary' in data) {
      // If the secret is binary, decode it
      const decodedBinarySecret = Buffer.from(
        data.SecretBinary as string,
        'base64',
      ).toString('ascii');
      return decodedBinarySecret;
    } else {
      throw new Error(
        'Secret not found or is not accessible in the expected format.',
      );
    }
  } catch (error) {
    const err = error as AWSError;
    // Customize error handling based on the error code
    switch (err.code) {
      case 'DecryptionFailureException':
        // Handle decryption failure
        throw new Error(
          'Unable to decrypt the secret with the provided KMS key.',
        );
      case 'InternalServiceErrorException':
        // Handle server-side errors
        throw new Error('An internal service error occurred.');
      case 'InvalidParameterException':
        // Handle invalid parameters
        throw new Error('Invalid parameters provided to Secrets Manager.');
      case 'InvalidRequestException':
        // Handle invalid requests
        throw new Error('Invalid request to Secrets Manager.');
      case 'ResourceNotFoundException':
        // Handle missing secrets
        throw new Error('Requested secret not found.');
      case 'AccessDeniedException':
        // Handle access denial
        throw new Error(
          'Access denied when attempting to retrieve the secret.',
        );
      default:
        // Generic error handling
        throw new Error(`An error occurred: ${err.message}`);
    }
  }
};

export default getSecret;
